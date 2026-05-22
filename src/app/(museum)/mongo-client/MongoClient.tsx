"use client";

import {
  useState,
  useEffect,
  useRef,
  useCallback,
  Suspense,
  ViewTransition,
  type KeyboardEvent,
} from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { ChevronDown, ChevronLeft, Loader2, Play } from "lucide-react";
import { siGithub } from "simple-icons";
import { Collapsible } from "@/components/ui/Collapsible";
import { MuseumChrome } from "@/components/ui/MuseumChrome";
import { useSession, authClient } from "@/lib/auth-client";
import {
  MONGO_ORIGINAL,
  MONGO_ENHANCED,
  type MongoProject,
  type Tier,
} from "./mongo-data";
import styles from "./MongoClient.module.css";

export type { Tier } from "./mongo-data";

/**
 * Shared shell used by /mongo-client (Original) and /mongo-client/enhanced
 * (Enhanced). Tier is fixed per route; the chrome's tier strip is a real
 * navigation. The third (Reimagined) link points to wherever JASKIS's
 * reimagined version lives — currently disabled, since no Reimagined-JASKIS
 * has shipped yet.
 *
 * The right pane is a terminal: stack of (prompt, output) blocks growing
 * downward, with an active prompt at the bottom that captures keystrokes.
 * Multi-line input via Shift+Enter; Enter executes. ↑/↓ walk history.
 */
export default function MongoClient({ tier }: { tier: Tier }) {
  return (
    <Suspense>
      <MongoClientInner tier={tier} />
    </Suspense>
  );
}

interface TranscriptEntry {
  command: string;
  /** null while pending. */
  result: ShellResult | null;
  /** Database that was current when the command was issued (for the prompt prefix). */
  db: string;
}

type ShellResult =
  | { kind: "ok"; value: unknown }
  | { kind: "cursor"; docs: unknown[]; pretty: boolean }
  | { kind: "shellInfo"; lines: string[] }
  | { kind: "error"; error: string };

function MongoClientInner({ tier }: { tier: Tier }) {
  const searchParams = useSearchParams();
  const { data: session, isPending: sessionPending } = useSession();
  const projects = tier === "enhanced" ? MONGO_ENHANCED : MONGO_ORIGINAL;
  const initialId = searchParams.get("project") ?? projects[0]!.id;

  const [activeId, setActiveId] = useState(
    projects.some((p) => p.id === initialId) ? initialId : projects[0]!.id,
  );
  const [draft, setDraft] = useState("");
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([]);
  const [history, setHistory] = useState<string[]>([]);
  const [historyIdx, setHistoryIdx] = useState<number | null>(null);
  const [currentDb, setCurrentDb] = useState("jaskis");
  const [running, setRunning] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [signingIn, setSigningIn] = useState(false);
  // Pretty-print toggle. Persisted so the visitor's preference survives
  // tier swaps and reloads. Default: pretty on — first-impression readability
  // matters more than authentic Mongo-shell compactness.
  const [pretty, setPretty] = useState(true);
  useEffect(() => {
    const stored = window.localStorage.getItem("mongo-client.pretty");
    if (stored !== null) setPretty(stored === "1");
  }, []);
  useEffect(() => {
    window.localStorage.setItem("mongo-client.pretty", pretty ? "1" : "0");
  }, [pretty]);

  const promptRef = useRef<HTMLTextAreaElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);
  const welcomeRef = useRef<HTMLDivElement>(null);
  // Whether the transcript scroller is at (or near) its bottom edge. The
  // floating "scroll to bottom" chip is hidden when this is true. We treat
  // anything within 32px of the bottom as "at bottom" so a rounded scroll
  // position doesn't flicker the chip on/off near the limit.
  const [atBottom, setAtBottom] = useState(true);
  const checkAtBottom = useCallback(() => {
    const el = scrollerRef.current;
    if (!el) return;
    const gap = el.scrollHeight - el.scrollTop - el.clientHeight;
    setAtBottom(gap < 32);
  }, []);

  // The welcome banner is positioned absolutely OVER the transcript, so the
  // transcript needs top-padding equal to the banner's measured height for
  // the first command not to get trapped underneath. Same for the bottom
  // edge — the floating "jump to latest" chip would otherwise occlude the
  // last visible line. We use ResizeObserver so the padding tracks the
  // banner's height across viewport changes and tier swaps.
  useEffect(() => {
    const banner = welcomeRef.current;
    const scroller = scrollerRef.current;
    if (!banner || !scroller) return;
    const apply = () => {
      const h = banner.getBoundingClientRect().height;
      scroller.style.setProperty("--welcome-h", `${Math.round(h)}px`);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(banner);
    return () => ro.disconnect();
  }, []);

  const activeProject = projects.find((p) => p.id === activeId) ?? projects[0]!;

  // Close sidebar on Esc (narrow viewports).
  useEffect(() => {
    if (!sidebarOpen) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") setSidebarOpen(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [sidebarOpen]);

  // Autoscroll transcript on new output — but only if the visitor was
  // already at the bottom. If they scrolled up to read older results, leave
  // them where they are; the floating chip lets them jump back.
  useEffect(() => {
    const el = scrollerRef.current;
    if (!el) return;
    if (atBottom) {
      el.scrollTop = el.scrollHeight;
    }
    // Recompute the flag after layout settles so the chip's visibility
    // matches reality (e.g. a new tall result block can push the bottom
    // further away even if we just autoscrolled).
    requestAnimationFrame(checkAtBottom);
  }, [transcript, running, atBottom, checkAtBottom]);

  // Focus the prompt on mount and after each run.
  useEffect(() => {
    if (!running) promptRef.current?.focus();
  }, [running]);

  const switchProject = (id: string) => {
    setActiveId(id);
    setDraft("");
    setTranscript([]);
    setSidebarOpen(false);
    const url = new URL(window.location.href);
    url.searchParams.set("project", id);
    window.history.replaceState({}, "", url.toString());
  };

  const loadExample = (cmd: string) => {
    setDraft(cmd);
    promptRef.current?.focus();
  };

  const startSignIn = useCallback(async () => {
    setSigningIn(true);
    await authClient.signIn.social({
      provider: "github",
      callbackURL: window.location.href,
    });
  }, []);

  const send = useCallback(
    async (raw: string) => {
      const command = raw.trim();
      if (!command) return;
      const entry: TranscriptEntry = { command, result: null, db: currentDb };
      setTranscript((t) => [...t, entry]);
      setHistory((h) => (h[h.length - 1] === command ? h : [...h, command]));
      setHistoryIdx(null);
      setDraft("");
      setRunning(true);

      try {
        const res = await fetch("/api/mongo-client/exec", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tier, command, currentDb }),
        });
        const data = (await res.json()) as
          | { result: ShellResult }
          | { error: string; kind: string };

        const finalResult: ShellResult =
          "error" in data ? { kind: "error", error: data.error } : data.result;

        // Track `use <db>` client-side so the prompt prefix reflects it.
        if (
          finalResult.kind === "shellInfo" &&
          finalResult.lines[0]?.startsWith("switched to db ")
        ) {
          const next = finalResult.lines[0].slice("switched to db ".length);
          setCurrentDb(next);
        }

        setTranscript((t) =>
          t.map((e, i) =>
            i === t.length - 1 ? { ...e, result: finalResult } : e,
          ),
        );
      } catch (err) {
        setTranscript((t) =>
          t.map((e, i) =>
            i === t.length - 1
              ? {
                  ...e,
                  result: {
                    kind: "error",
                    error: `network error: ${err instanceof Error ? err.message : String(err)}`,
                  },
                }
              : e,
          ),
        );
      } finally {
        setRunning(false);
      }
    },
    [tier, currentDb],
  );

  const onPromptKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (!running) void send(draft);
      return;
    }
    if (
      e.key === "ArrowUp" &&
      (e.metaKey || e.ctrlKey || !draftHasNewline(draft))
    ) {
      // Walk history backwards if cursor is on the first line or modifier held.
      if (history.length === 0) return;
      e.preventDefault();
      const next =
        historyIdx === null ? history.length - 1 : Math.max(0, historyIdx - 1);
      setHistoryIdx(next);
      setDraft(history[next] ?? "");
      return;
    }
    if (
      e.key === "ArrowDown" &&
      (e.metaKey || e.ctrlKey || !draftHasNewline(draft))
    ) {
      if (historyIdx === null) return;
      e.preventDefault();
      const next = historyIdx + 1;
      if (next >= history.length) {
        setHistoryIdx(null);
        setDraft("");
      } else {
        setHistoryIdx(next);
        setDraft(history[next] ?? "");
      }
      return;
    }
    if (e.key === "l" && (e.ctrlKey || e.metaKey)) {
      // Ctrl/Cmd-L clears the transcript like a real shell.
      e.preventDefault();
      setTranscript([]);
    }
  };

  return (
    <div className={styles.shell} data-sidebar-open={sidebarOpen}>
      <MuseumChrome
        title="Mongo Client"
        subtitle="Shell-style UNLV projects — real Mongo syntax, executed against the museum's database"
        tiers={[
          {
            label: "Original",
            href: "/mongo-client",
            current: tier === "original",
          },
          {
            label: "Enhanced",
            href: "/mongo-client/enhanced",
            current: tier === "enhanced",
          },
        ]}
      />

      <div className={styles.body}>
        <button
          type="button"
          className={styles.sidebarBackdrop}
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => setSidebarOpen(false)}
        />

        {/* Left: Knowledge Base — mirrors api-client's layout. */}
        <aside
          id="mongo-sidebar"
          className={styles.sidebar}
          aria-hidden={!sidebarOpen}
        >
          <div className={styles.sidebarHeader}>
            <p className={`text-xs ${styles.sidebarIntro}`}>
              Shell projects backed by a real database.
            </p>
          </div>
          <div>
            {projects.map((project) => (
              <ProjectEntry
                key={project.id}
                project={project}
                active={activeId === project.id}
                onSelect={() => switchProject(project.id)}
                onExample={loadExample}
              />
            ))}
          </div>

          {history.length > 0 && (
            <div className={styles.history}>
              <p className={`text-xs ${styles.historyLabel}`}>History</p>
              <div className={styles.historyList}>
                {history
                  .slice(-30)
                  .reverse()
                  .map((cmd, i) => (
                    <button
                      key={`${cmd}-${i}`}
                      type="button"
                      onClick={() => loadExample(cmd)}
                      className={`text-xs ${styles.historyItem}`}
                    >
                      {firstLine(cmd)}
                    </button>
                  ))}
              </div>
            </div>
          )}
        </aside>

        <button
          type="button"
          className={styles.sidebarToggle}
          aria-controls="mongo-sidebar"
          aria-expanded={sidebarOpen}
          aria-label={sidebarOpen ? "Close project list" : "Open project list"}
          onClick={() => setSidebarOpen((v) => !v)}
        >
          <ChevronLeft
            size={18}
            className={styles.sidebarToggleIcon}
            aria-hidden="true"
          />
        </button>

        {/* Right: terminal. Wrapped in <ViewTransition name="page-content">
            so it picks up the keyframed fade+blur+slide in globals.css
            (same treatment as every other museum route body). The other
            three call sites — landing, project-route, api-client — all
            use this wrapper; this used to be inline `style={{
            viewTransitionName }}` for the same effect, but the wrapper
            form is the canonical one and keeps the page-content
            participants consistent. */}
        <ViewTransition name="page-content">
          <main className={styles.terminal}>
            <div className={styles.terminalHeader}>
              <span className={styles.terminalProject}>
                {activeProject.title}
              </span>
              <span className={styles.terminalSeparator}>·</span>
              <span className={styles.terminalDb}>db: {currentDb}</span>
              <span className={styles.terminalSeparator}>·</span>
              <span className={styles.terminalTier} data-tier={tier}>
                {tier === "enhanced" ? "Enhanced" : "Original"} tier
              </span>
              <span className={styles.terminalGrow} />
              <button
                type="button"
                onClick={() => setPretty((v) => !v)}
                className={styles.prettyToggle}
                data-on={pretty}
                aria-pressed={pretty}
                title={
                  pretty
                    ? "Pretty output (multi-line, indented). Click for compact."
                    : "Compact output (one document per line). Click for pretty."
                }
              >
                pretty: {pretty ? "on" : "off"}
              </button>
              {!sessionPending && !session && (
                <button
                  type="button"
                  disabled={signingIn}
                  onClick={startSignIn}
                  className={`btn ${styles.signInInline}`}
                  title="Sign in with GitHub — required for writes"
                >
                  {signingIn ? (
                    <Loader2 size={12} className={styles.spin} />
                  ) : (
                    <GithubMark size={12} />
                  )}
                  Sign in to write
                </button>
              )}
              {!sessionPending && session && (
                <span className={styles.signedInBadge}>
                  <GithubMark size={11} />
                  {session.user.name}
                </span>
              )}
            </div>

            {/*
            Welcome banner overlays the top of the scrolling transcript as
            a translucent, blurred surface — visitors see the transcript
            faintly through it, signalling "this UI is layered on top of a
            scrollable region." The transcript itself owns the scroll;
            its top-padding tracks the banner's measured height so the first
            command isn't trapped under the banner.
          */}
            <WelcomeBanner
              ref={welcomeRef}
              project={activeProject}
              tier={tier}
            />
            <div
              ref={scrollerRef}
              className={styles.transcript}
              onScroll={checkAtBottom}
            >
              {transcript.map((entry, i) => (
                <TranscriptBlock key={i} entry={entry} pretty={pretty} />
              ))}
              {/* Active prompt */}
              <div className={styles.promptRow}>
                <span className={styles.promptPrefix}>
                  <span className={styles.promptDb}>{currentDb}</span>
                  <span className={styles.promptArrow}>&gt;</span>
                </span>
                <textarea
                  ref={promptRef}
                  value={draft}
                  onChange={(e) => setDraft(e.target.value)}
                  onKeyDown={onPromptKeyDown}
                  rows={Math.min(8, Math.max(1, draft.split("\n").length))}
                  className={styles.promptInput}
                  placeholder={
                    running
                      ? "..."
                      : "type a command (Enter to run, Shift+Enter for newline)"
                  }
                  spellCheck={false}
                  disabled={running}
                  aria-label="Mongo shell prompt"
                />
                <button
                  type="button"
                  onClick={() => void send(draft)}
                  disabled={running || !draft.trim()}
                  className={`btn ${styles.runButton}`}
                  aria-label="Run command"
                >
                  {running ? (
                    <Loader2 size={14} className={styles.spin} />
                  ) : (
                    <Play size={14} />
                  )}
                </button>
              </div>
            </div>

            {/*
            Floating "scroll to bottom" affordance. Sits at the lower edge
            of the terminal pane (above the transcript's last visible line)
            and is only shown when the visitor has scrolled up. The radial
            gradient backdrop (centered on the chip's bottom edge) softens
            the transition from the transcript's text into the chip itself
            — gives it a "fading up from the floor" feel rather than a hard
            floating button.
          */}
            <div
              className={styles.scrollHintWrap}
              data-visible={!atBottom}
              aria-hidden={atBottom}
            >
              <div className={styles.scrollHintGlow} />
              <button
                type="button"
                className={styles.scrollHintButton}
                onClick={() => {
                  const el = scrollerRef.current;
                  if (el)
                    el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
                }}
                tabIndex={atBottom ? -1 : 0}
                aria-label="Scroll to bottom"
              >
                <ChevronDown size={14} aria-hidden="true" />
                <span>jump to latest</span>
              </button>
            </div>
          </main>
        </ViewTransition>
      </div>
    </div>
  );
}

function ProjectEntry({
  project,
  active,
  onSelect,
  onExample,
}: {
  project: MongoProject;
  active: boolean;
  onSelect: () => void;
  onExample: (cmd: string) => void;
}) {
  return (
    <div className={styles.kbEntry}>
      <button
        onClick={onSelect}
        className={`${styles.kbEntryButton} ${active ? styles.kbEntryButtonActive : ""}`}
      >
        <p className={`text-sm ${styles.kbEntryTitle}`}>{project.title}</p>
        <p className={`text-xs ${styles.kbEntryTech}`}>{project.tech}</p>
      </button>
      <Collapsible open={active}>
        <div className={styles.kbDetails}>
          <p className={`text-xs ${styles.kbDescription}`}>
            {project.description}
          </p>
          <div className={styles.kbCollections}>
            <span className={`text-xs ${styles.kbCollectionsLabel}`}>
              collections
            </span>
            {project.collections.map((c) => (
              <span key={c} className={`text-xs ${styles.kbCollection}`}>
                {c}
              </span>
            ))}
          </div>
          <div className={styles.kbExamples}>
            {project.examples.map((ex, i) => (
              <button
                key={i}
                onClick={() => onExample(ex.command)}
                className={`text-xs ${styles.kbExample}`}
                title={ex.command}
              >
                <span className={styles.kbExampleLabel}>{ex.label}</span>
                <span className={styles.kbExampleDescription}>
                  {ex.description}
                </span>
              </button>
            ))}
          </div>
        </div>
      </Collapsible>
    </div>
  );
}

const WelcomeBanner = function WelcomeBanner({
  ref,
  project,
  tier,
}: {
  ref?: React.Ref<HTMLDivElement>;
  project: MongoProject;
  tier: Tier;
}) {
  return (
    <div ref={ref} className={styles.welcome}>
      <pre className={styles.welcomeAscii}>{`MongoDB shell (museum)`}</pre>
      <p className={styles.welcomeLine}>
        Connected to:{" "}
        <span className={styles.welcomeDb}>jaskis-museum.unlv</span>
      </p>
      <p className={styles.welcomeLine}>
        Project: <span className={styles.welcomeProject}>{project.title}</span>{" "}
        · Tier: <span className={styles.welcomeTier}>{tier}</span>
      </p>
      <p className={styles.welcomeHint}>
        Pick an example from the left, or try{" "}
        <code className={styles.welcomeCode}>db.bounties.find()</code>. Press{" "}
        <kbd className={styles.welcomeKbd}>Enter</kbd> to run,{" "}
        <kbd className={styles.welcomeKbd}>Shift+Enter</kbd> for a newline,{" "}
        <kbd className={styles.welcomeKbd}>↑/↓</kbd> for history,{" "}
        <kbd className={styles.welcomeKbd}>Ctrl+L</kbd> to clear.
      </p>
      {tier === "enhanced" && (
        <p className={styles.welcomeHint}>
          This tier exposes the{" "}
          <code className={styles.welcomeCode}>auditLog</code> collection. Every
          write across both tiers shows up there with the author&apos;s GitHub
          login.{" "}
          <Link href="/mongo-client" className={styles.welcomeLink}>
            ← Back to Original
          </Link>
        </p>
      )}
    </div>
  );
};

function TranscriptBlock({
  entry,
  pretty,
}: {
  entry: TranscriptEntry;
  pretty: boolean;
}) {
  return (
    <>
      <div className={styles.echoRow}>
        <span className={styles.promptPrefix}>
          <span className={styles.promptDb}>{entry.db}</span>
          <span className={styles.promptArrow}>&gt;</span>
        </span>
        <pre className={styles.echoCommand}>{entry.command}</pre>
      </div>
      <ResultBlock result={entry.result} pretty={pretty} />
    </>
  );
}

/**
 * Each result lands in its own bordered scroll container so a 100-doc query
 * doesn't push every earlier exchange off the screen, and a single very-wide
 * compact-format line can scroll horizontally instead of wrapping into
 * unreadable soup. The container caps height at ~30vh and scrolls; the
 * outer transcript still scrolls the page itself.
 *
 * The `pretty` flag is the global toggle from the header. The per-command
 * `.pretty()` cursor method still wins on its own line — when a cursor
 * result came back with pretty=true, we honor it regardless of the toggle,
 * so visitors who explicitly typed .pretty() still see what they asked for.
 */
function ResultBlock({
  result,
  pretty,
}: {
  result: ShellResult | null;
  pretty: boolean;
}) {
  if (result === null) {
    return (
      <div className={styles.pending}>
        <Loader2 size={12} className={styles.spin} />
        <span>running…</span>
      </div>
    );
  }
  if (result.kind === "error") {
    return (
      <div className={styles.resultBox} data-kind="error">
        <pre className={styles.error}>{result.error}</pre>
      </div>
    );
  }
  if (result.kind === "shellInfo") {
    return (
      <div className={styles.resultBox} data-kind="info">
        <pre className={styles.shellInfo}>{result.lines.join("\n")}</pre>
      </div>
    );
  }
  if (result.kind === "cursor") {
    if (result.docs.length === 0) {
      return (
        <div className={styles.resultBox} data-kind="info">
          <pre className={styles.shellInfo}>{`<no results>`}</pre>
        </div>
      );
    }
    const usePretty = result.pretty || pretty;
    const text = usePretty
      ? result.docs.map((d) => formatPretty(d)).join("\n")
      : result.docs.map((d) => formatCompact(d)).join("\n");
    return (
      <div className={styles.resultBox} data-kind="cursor">
        <span className={styles.resultMeta}>
          {result.docs.length} doc{result.docs.length === 1 ? "" : "s"}
        </span>
        <pre className={styles.cursorOutput}>{text}</pre>
      </div>
    );
  }
  return (
    <div className={styles.resultBox} data-kind="value">
      <pre className={styles.cursorOutput}>
        {pretty ? formatPretty(result.value) : formatCompact(result.value)}
      </pre>
    </div>
  );
}

function formatPretty(v: unknown): string {
  return JSON.stringify(v, null, 2);
}
function formatCompact(v: unknown): string {
  return JSON.stringify(v);
}

function draftHasNewline(d: string): boolean {
  return d.includes("\n");
}
function firstLine(s: string): string {
  const i = s.indexOf("\n");
  return i === -1 ? s : `${s.slice(0, i)} …`;
}

function GithubMark({ size = 12 }: { size?: number }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="currentColor"
      aria-hidden="true"
    >
      <path d={siGithub.path} />
    </svg>
  );
}
