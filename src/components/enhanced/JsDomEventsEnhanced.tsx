"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./JsDomEventsEnhanced.module.css";

/**
 * Enhanced tier for js-dom-events.
 *
 * Three nested concentric circles as real DOM elements with real
 * `addEventListener` chains — clicking a layer dispatches a click
 * that the browser walks through capture phase (outer → inner),
 * fires at the target, then walks back through bubble phase
 * (inner → outer). Each ring's radial-gradient pulses as the event
 * passes through it; an event-log sidebar records the trace.
 *
 * Toggles:
 *   - stopPropagation: the clicked layer's listener calls
 *     event.stopPropagation(); the wavefront halts mid-chain.
 *   - preventDefault: a contained <a href> would navigate by default;
 *     when ON, the listener calls event.preventDefault() and the
 *     navigation is cancelled. The link gets a strikethrough.
 *
 * Three concepts (target, bubbling, capturing) get one centerpiece
 * visual; the two modifiers (stopPropagation, preventDefault) get
 * toggles + log entries. All five original-tier sub-pages collapse
 * into one polished interactive surface.
 *
 * Native event listeners (not React's synthetic system) so the
 * lifecycle is the real DOM one — eventPhase / currentTarget /
 * target are reported truthfully.
 */

type Phase = "capture" | "target" | "bubble" | "stopped" | "prevented";
type Floater = { id: number; x: number; y: number };
type RingId = "outer" | "middle" | "inner";

interface LogEntry {
  id: number;
  phase: Phase;
  ring: RingId;
  target: RingId | "link";
}

const RING_LABELS: Record<RingId, string> = {
  outer: "OUTER",
  middle: "MIDDLE",
  inner: "INNER",
};

const PHASE_CLASS: Record<Phase, string> = {
  capture: styles.logPhaseCapture!,
  target: styles.logPhaseTarget!,
  bubble: styles.logPhaseBubble!,
  stopped: styles.logPhaseStopped!,
  prevented: styles.logPhasePrevented!,
};

const PHASE_LABEL: Record<Phase, string> = {
  capture: "▼ CAPTURE",
  target: "● TARGET ",
  bubble: "▲ BUBBLE ",
  stopped: "✕ STOPPED",
  prevented: "⊘ PREVENT",
};

export function JsDomEventsEnhanced() {
  const outerRef = useRef<HTMLDivElement>(null);
  const middleRef = useRef<HTMLDivElement>(null);
  const innerRef = useRef<HTMLDivElement>(null);
  const linkRef = useRef<HTMLAnchorElement>(null);

  const [log, setLog] = useState<LogEntry[]>([]);
  const [floaters, setFloaters] = useState<Floater[]>([]);
  const [stopProp, setStopProp] = useState(false);
  const [preventDef, setPreventDef] = useState(false);

  const spawnFloater = useCallback((x: number, y: number) => {
    setFloaters((prev) => [
      ...prev,
      { id: (prev[prev.length - 1]?.id ?? 0) + 1, x, y },
    ]);
  }, []);

  // Floaters self-clean after the rise-and-fade animation completes.
  // The animation duration matches the .floater keyframe in CSS; we
  // sweep the array on the same cadence to keep state bounded across
  // rapid clicks.
  useEffect(() => {
    if (floaters.length === 0) return;
    const oldest = floaters[0]!;
    const timer = setTimeout(() => {
      setFloaters((prev) => prev.filter((f) => f.id !== oldest.id));
    }, 1400);
    return () => clearTimeout(timer);
  }, [floaters]);

  const append = useCallback((entry: Omit<LogEntry, "id">) => {
    // Derive id inside the updater so React's concurrent re-invocation
    // (strict mode dev, or batched setState replay) can't produce two
    // entries sharing the same id. The id is just the position-stamp
    // — last entry's id + 1 — so it stays unique-per-commit.
    setLog((prev) => [
      ...prev,
      { id: (prev[prev.length - 1]?.id ?? 0) + 1, ...entry },
    ]);
  }, []);

  const reset = () => setLog([]);

  // Bind native capture + bubble listeners on each ring. The ref to
  // the toggles lives in a closure-stable Ref so the handlers don't
  // need to be rebound when toggles change.
  const stopPropRef = useRef(stopProp);
  const preventDefRef = useRef(preventDef);
  useEffect(() => {
    stopPropRef.current = stopProp;
  }, [stopProp]);
  useEffect(() => {
    preventDefRef.current = preventDef;
  }, [preventDef]);

  // Pulse the named ring by toggling .wavePulse off and on. We remove
  // the class first so re-clicking the same ring restarts the animation
  // (otherwise the existing class wouldn't retrigger the keyframes).
  const pulse = (ring: RingId) => {
    const el = ringRefByName(ring, {
      outer: outerRef,
      middle: middleRef,
      inner: innerRef,
    });
    if (!el) return;
    el.classList.remove(styles.wavePulse!);
    // Force reflow so the browser sees the class as truly removed
    // before re-adding. void el.offsetWidth is the standard idiom.
    void el.offsetWidth;
    el.classList.add(styles.wavePulse!);
  };

  useEffect(() => {
    const outer = outerRef.current;
    const middle = middleRef.current;
    const inner = innerRef.current;
    const link = linkRef.current;
    if (!outer || !middle || !inner || !link) return;

    const rings: Array<{ el: HTMLElement; id: RingId }> = [
      { el: outer, id: "outer" },
      { el: middle, id: "middle" },
      { el: inner, id: "inner" },
    ];

    function classify(target: EventTarget | null): RingId | "link" {
      if (target === link) return "link";
      for (const r of rings) if (target === r.el) return r.id;
      return "outer";
    }

    /*
     * Visual stagger: a real DOM click dispatches all listeners
     * synchronously (within the same microtask), so without help the
     * wavefront appears as a single simultaneous flash across rings
     * instead of a traveling wave. We delay the *visual* side-effects
     * (log + pulse) by a per-phase amount so visitors see the order:
     *
     *   outer-capture  (t=0)
     *   middle-capture (t=STAGGER)
     *   target         (t=2*STAGGER)
     *   middle-bubble  (t=3*STAGGER)
     *   outer-bubble   (t=4*STAGGER)
     *
     * The event-mechanic side-effects (stopPropagation, preventDefault)
     * still fire SYNCHRONOUSLY inside the listener — calling them
     * after a setTimeout would be too late; the event would already
     * have propagated. So we split: spec-changing actions sync, visual
     * narration staggered. The log narrates what the synchronous
     * dispatch is actually doing, just stretched out in time.
     *
     * `phaseIndexRef` counts listener-fires within a single dispatch.
     * It resets on each new dispatch via the trailing-edge teardown
     * (queued at delay 999 * STAGGER, comfortably after the last
     * phase has rendered).
     */
    const STAGGER_MS = 280;
    let phaseIndex = 0;
    let resetQueued = false;

    function scheduleReset() {
      if (resetQueued) return;
      resetQueued = true;
      // Reset on the next macrotask after all sync listeners have
      // fired but before the next click can begin a new dispatch.
      // queueMicrotask would run BEFORE the staggered visuals, so we
      // use setTimeout(0) which lands after the dispatch returns.
      setTimeout(() => {
        phaseIndex = 0;
        resetQueued = false;
      }, 0);
    }

    function makeHandler(ringId: RingId, capture: boolean) {
      return (e: Event) => {
        const targetId = classify(e.target);
        scheduleReset();

        // preventDefault on the link: fire it on the FIRST listener
        // we see in the dispatch (which is outer-capture, since it
        // sits highest in the chain). preventDefault works from any
        // listener in the chain — calling it once is enough to
        // cancel the default action across the whole dispatch. We
        // gate on `ringId === "outer" && capture` so this only fires
        // once per dispatch, not five times.
        const isLinkTargeted = targetId === "link";
        const shouldPrevent =
          preventDefRef.current &&
          isLinkTargeted &&
          ringId === "outer" &&
          capture;
        if (shouldPrevent) {
          e.preventDefault();
          if (e instanceof MouseEvent) {
            spawnFloater(e.clientX, e.clientY);
          }
          const slot = phaseIndex; // log the prevention at the current slot
          setTimeout(() => {
            append({ phase: "prevented", ring: ringId, target: targetId });
          }, slot * STAGGER_MS);
        }

        if (e.eventPhase === Event.AT_TARGET) {
          if (capture) return;
          // SYNCHRONOUS: stopPropagation must fire inside the listener
          // call or it's too late to affect the dispatch. (preventDefault
          // for the link is handled above on the outer-capture pass.)
          if (stopPropRef.current) {
            e.stopPropagation();
          }
          // STAGGERED: visual narration, queued at the target's slot.
          const slot = phaseIndex++;
          const wasStopped = stopPropRef.current;
          setTimeout(() => {
            append({ phase: "target", ring: ringId, target: targetId });
            pulse(ringId);
            if (wasStopped) {
              append({ phase: "stopped", ring: ringId, target: targetId });
            }
          }, slot * STAGGER_MS);
          return;
        }

        // Non-target listener (capture or bubble through an ancestor).
        // When the target is the link (no listener attached to it
        // directly), the AT_TARGET branch never fires — so we apply
        // stopPropagation at the link's deepest ring ancestor (inner)
        // on the BUBBLE pass, mirroring the "halt at target" semantics
        // visitors expect when toggling stopPropagation. Capture pass
        // is preserved so visitors see the full inward wavefront; only
        // the bubble pass is suppressed.
        const phase: Phase = capture ? "capture" : "bubble";
        const isLinkAtInnerBubble =
          isLinkTargeted && ringId === "inner" && !capture;
        if (stopPropRef.current && isLinkAtInnerBubble) {
          e.stopPropagation();
        }
        const slot = phaseIndex++;
        const wasStoppedHere = stopPropRef.current && isLinkAtInnerBubble;
        setTimeout(() => {
          append({ phase, ring: ringId, target: targetId });
          pulse(ringId);
          if (wasStoppedHere) {
            append({ phase: "stopped", ring: ringId, target: targetId });
          }
        }, slot * STAGGER_MS);
      };
    }

    // Each ring gets two listeners — one with capture=true, one with
    // capture=false. The browser dispatches in spec-defined order:
    // outer-capture → middle-capture → (target's capture & bubble)
    // → middle-bubble → outer-bubble.
    const bindings = rings.flatMap((r) => [
      { ring: r, capture: true, h: makeHandler(r.id, true) },
      { ring: r, capture: false, h: makeHandler(r.id, false) },
    ]);

    for (const b of bindings) {
      b.ring.el.addEventListener("click", b.h, b.capture);
    }
    return () => {
      for (const b of bindings) {
        b.ring.el.removeEventListener("click", b.h, b.capture);
      }
    };
  }, [append, spawnFloater]);

  return (
    <div className={styles.shell}>
      <div className={styles.header}>
        <p className={`text-sm ${styles.title}`}>Event lifecycle playground</p>
        <p className={`text-xs ${styles.subtitle}`}>
          Click any ring (or the link) to dispatch a click through the DOM. The
          wavefront pulses each ancestor as the event passes through capture →
          target → bubble.
        </p>
      </div>

      <div className={styles.stage}>
        <div className={styles.circles}>
          {/*
            Three nested divs — outer is the deepest ancestor, inner
            is the innermost child. Clicks on inner walk through
            outer → middle → inner (capture) → inner → middle → outer
            (bubble). The link sits inside inner so clicking it
            dispatches through the same chain plus the anchor target.
          */}
          <div ref={outerRef} className={`${styles.ring} ${styles.ringOuter}`}>
            <span className={styles.ringLabel}>OUTER</span>
            <div
              ref={middleRef}
              className={`${styles.ring} ${styles.ringMiddle}`}
            >
              <span className={styles.ringLabel}>MIDDLE</span>
              <div
                ref={innerRef}
                className={`${styles.ring} ${styles.ringInner}`}
              >
                <span className={styles.ringLabel}>INNER</span>
                {/*
                  Link sits INSIDE inner so clicking it dispatches a
                  real click event through the full DOM chain (outer →
                  middle → inner → link).

                  href is a fragment ID; the browser's default action
                  on click is to update the URL with that fragment.
                  The modal element below uses the `:target` CSS
                  pseudo-class to become visible when its id is the
                  active fragment, so the browser's default action
                  IS the modal-open — no JS modal trigger needed,
                  and preventDefault genuinely cancels the open by
                  cancelling the URL update.

                  When preventDefault fires we spawn a "Default
                  prevented!" floater at the click point so visitors
                  see the suppression land instead of just-nothing-
                  happening.
                */}
                <a
                  ref={linkRef}
                  href="#js-dom-events-modal"
                  className={styles.linkBait}
                  style={
                    preventDef ? { textDecoration: "line-through" } : undefined
                  }
                >
                  click me
                </a>
              </div>
            </div>
          </div>
        </div>

        <div className={styles.sidebar}>
          <div className={styles.controls}>
            <p className={`text-xs ${styles.controlsHeader}`}>Modifiers</p>
            <div className={styles.toggleRow}>
              <div>
                <span className={`text-xs ${styles.toggleLabel}`}>
                  stopPropagation()
                </span>
                <p className={`text-xs ${styles.toggleLabelHint}`}>
                  Halt the wavefront at the target.
                </p>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${stopProp ? styles.toggleActive : ""}`}
                aria-pressed={stopProp}
                onClick={() => setStopProp((v) => !v)}
              >
                {stopProp ? "ON" : "OFF"}
              </button>
            </div>
            <div className={styles.toggleRow}>
              <div>
                <span className={`text-xs ${styles.toggleLabel}`}>
                  preventDefault()
                </span>
                <p className={`text-xs ${styles.toggleLabelHint}`}>
                  Cancel the link&apos;s default navigation.
                </p>
              </div>
              <button
                type="button"
                className={`${styles.toggle} ${preventDef ? styles.toggleActive : ""}`}
                aria-pressed={preventDef}
                onClick={() => setPreventDef((v) => !v)}
              >
                {preventDef ? "ON" : "OFF"}
              </button>
            </div>
            <button
              type="button"
              className={`text-xs ${styles.reset}`}
              onClick={reset}
            >
              Reset log
            </button>
          </div>

          <div className={styles.log} aria-live="polite">
            {log.length === 0 ? (
              <p className={styles.logEmpty}>
                Click a ring to begin. The trace will appear here.
              </p>
            ) : (
              log.map((entry) => (
                <div key={entry.id} className={styles.logEntry}>
                  <span
                    className={`${styles.logPhase} ${PHASE_CLASS[entry.phase]}`}
                  >
                    {PHASE_LABEL[entry.phase]}
                  </span>
                  <span>
                    on {RING_LABELS[entry.ring]} · target=
                    {entry.target === "link"
                      ? "LINK"
                      : RING_LABELS[entry.target]}
                  </span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>

      {/*
        Modal via the :target CSS pseudo-class. The link's
        href="#js-dom-events-modal" updates the URL fragment on
        default click; the modal's :target style takes over and
        becomes visible. No JS open/close — the browser's default
        action drives the entire modal lifecycle. preventDefault
        on the click cancels the URL update, which is what cancels
        the modal opening. That's the spec-correct demonstration
        the original chapter-5.6 demo taught.

        Backdrop is a sibling <a href=""> with no fragment — clicking
        it clears the hash and the modal closes (browser default
        action: navigate to bare URL). No JS dismiss handler.
      */}
      <a href="#" className={styles.modalBackdrop} aria-label="Close modal" />
      <div
        id="js-dom-events-modal"
        className={styles.modal}
        role="dialog"
        aria-modal="true"
        aria-labelledby="js-dom-events-modal-title"
        tabIndex={-1}
      >
        <a href="#" className={styles.modalClose} aria-label="Close modal">
          ×
        </a>
        <h2 id="js-dom-events-modal-title" className={styles.modalTitle}>
          The link did its job
        </h2>
        <p className={styles.modalBody}>
          You clicked the link inside the inner ring. The browser&apos;s default
          click action — navigate to the URL fragment{" "}
          <code>#js-dom-events-modal</code> — ran, which made this modal appear
          (a CSS <code>:target</code> selector watches for that fragment in the
          URL).
        </p>
        <p className={styles.modalBody}>
          Toggle <strong>preventDefault</strong> on and click the link again.
          The fragment never updates, this modal never opens, and a small
          &ldquo;Default prevented!&rdquo; floater rises from your click point
          as visible confirmation that the browser&apos;s default was cancelled.
        </p>
        <p className={styles.modalBody}>
          The event listeners on the rings still fire either way — the capture /
          target / bubble trace in the log doesn&apos;t care whether the default
          action was prevented. Only the browser&apos;s default behavior is
          suppressed by <code>preventDefault()</code>.
        </p>
      </div>

      {/*
        Click-floaters: rise-and-fade text spawned at the cursor
        position whenever preventDefault actually fires. Position:
        fixed (viewport coords from the click event) so they float
        over the playground regardless of scroll position. Each
        floater self-cleans via the spawnFloater effect timer.
      */}
      {floaters.map((f) => (
        <span
          key={f.id}
          className={styles.floater}
          style={{ left: f.x, top: f.y }}
          aria-hidden="true"
        >
          Default prevented!
        </span>
      ))}
    </div>
  );
}

function ringRefByName(
  name: RingId,
  refs: {
    outer: React.RefObject<HTMLDivElement | null>;
    middle: React.RefObject<HTMLDivElement | null>;
    inner: React.RefObject<HTMLDivElement | null>;
  },
) {
  if (name === "outer") return refs.outer.current;
  if (name === "middle") return refs.middle.current;
  return refs.inner.current;
}
