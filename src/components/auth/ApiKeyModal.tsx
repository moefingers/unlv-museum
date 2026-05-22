"use client";

/**
 * Modal that issues + displays a fresh personal API key. Opened from the
 * SignInChip's "Request / refresh API key" dropdown row. Per the museum
 * convention (memory: project_enhanced_api_conventions.md): the API key
 * is for EXTERNAL tools (Postman, curl, a separate app's fetch). The
 * api-client UI inside the museum just uses the cookie session
 * transparently — no key-attachment plumbing required here.
 *
 * Surface:
 *   - On open: POST /api/user/api-key, render the raw token with a copy
 *     button and a worked usage example
 *   - "Issue a new key" button: re-POSTs to issue another one (old keys
 *     stay valid until revoked, matching the CLI's `pat:generate` behavior)
 *   - Esc closes; click-outside closes
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Copy, Check, X, KeyRound, Loader2 } from "lucide-react";
import styles from "./ApiKeyModal.module.css";

interface ApiKeyResponse {
  token: string;
  prefix: string;
  issued_to: { login: string; id: string };
  usage_example: {
    exchange: string;
    bearer: string;
  };
  warnings: string[];
}

export function ApiKeyModal({ onClose }: { onClose: () => void }) {
  const [state, setState] = useState<
    | { kind: "loading" }
    | { kind: "ok"; data: ApiKeyResponse }
    | { kind: "err"; message: string }
  >({ kind: "loading" });
  const [copied, setCopied] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  // Guard: only auto-issue once per modal mount. React 19 lint disallows
  // setState directly inside an effect body, so we trigger the fetch via
  // this ref instead of a state-flag setter.
  const autoIssuedRef = useRef(false);

  const issue = useCallback(async () => {
    setState({ kind: "loading" });
    setCopied(false);
    try {
      const res = await fetch("/api/user/api-key", { method: "POST" });
      if (!res.ok) {
        const body = (await res.json().catch(() => ({}))) as {
          message?: string;
        };
        setState({
          kind: "err",
          message:
            body.message ??
            `Couldn't issue an API key (status ${res.status}). Try signing out and back in.`,
        });
        return;
      }
      const data = (await res.json()) as ApiKeyResponse;
      setState({ kind: "ok", data });
    } catch (err) {
      setState({
        kind: "err",
        message: err instanceof Error ? err.message : "Network error",
      });
    }
  }, []);

  // Auto-issue when the modal opens — the visitor clicked "Request /
  // refresh API key" specifically to get one, so don't make them click
  // again. The state changes inside issue() are async (microtask after
  // the fetch resolves), not synchronous in the effect's render path,
  // but the React 19 lint is conservative and flags the call site
  // anyway. The auto-fetch IS the UX intent here; suppress for this line.
  useEffect(() => {
    if (autoIssuedRef.current) return;
    autoIssuedRef.current = true;
     
    void issue();
  }, [issue]);

  // Esc to close, click-outside to close.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    window.addEventListener("keydown", onKey);
    // Defer click-outside binding so the same click that OPENED the
    // modal doesn't immediately close it.
    const t = setTimeout(() => {
      document.addEventListener("mousedown", onClick);
    }, 0);
    return () => {
      window.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
      clearTimeout(t);
    };
  }, [onClose]);

  const copy = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      // Clipboard API can fail in iframes / insecure contexts —
      // visitors can still select+copy from the textarea manually.
    }
  };

  // Skip rendering during SSR — `document` doesn't exist server-side
  // and `createPortal` would throw. The "use client" boundary on this
  // file already ensures we're in a browser-bound bundle, but the
  // server still does an initial render pass.
  if (typeof document === "undefined") return null;

  // Render via portal directly under document.body so the modal escapes
  // any ancestor whose transform/filter/contain creates a new containing
  // block — that's what was anchoring the scrim to the SignInChip wrapper
  // (upper-right of the chrome) instead of the viewport.
  return createPortal(
    <div className={styles.scrim}>
      <div ref={ref} className={styles.modal}>
        <header className={styles.head}>
          <h2 className={styles.title}>
            <KeyRound size={16} aria-hidden="true" />
            Your API key
          </h2>
          <button
            type="button"
            onClick={onClose}
            className={styles.closeButton}
            aria-label="Close"
          >
            <X size={14} />
          </button>
        </header>

        {state.kind === "loading" && (
          <div className={styles.loading}>
            <Loader2 size={18} className={styles.spin} aria-hidden="true" />
            <span>Issuing a fresh key…</span>
          </div>
        )}

        {state.kind === "err" && (
          <div className={styles.error}>
            <p>{state.message}</p>
            <button
              type="button"
              onClick={issue}
              className={`btn ${styles.retry}`}
            >
              Try again
            </button>
          </div>
        )}

        {state.kind === "ok" && (
          <div className={styles.body}>
            <p className={styles.intro}>
              Use this token to authenticate API requests from{" "}
              <strong>external tools</strong> (Postman, curl, scripts). Inside
              the museum&apos;s own request builder, your session cookie does
              the same job automatically — you don&apos;t need to paste the
              token there.
            </p>

            <label className={styles.tokenLabel}>API key</label>
            <div className={styles.tokenRow}>
              <input
                readOnly
                value={state.data.token}
                className={`text-mono ${styles.tokenInput}`}
                onFocus={(e) => e.currentTarget.select()}
              />
              <button
                type="button"
                onClick={() => copy(state.data.token)}
                className={`btn ${styles.copy}`}
                title="Copy to clipboard"
              >
                {copied ? <Check size={14} /> : <Copy size={14} />}
                {copied ? "Copied" : "Copy"}
              </button>
            </div>

            <details className={styles.example}>
              <summary>Worked example — exchange for a session cookie</summary>
              <pre className={`text-mono ${styles.code}`}>
                {state.data.usage_example.exchange}
              </pre>
            </details>

            <details className={styles.example}>
              <summary>
                Worked example — Authorization: Bearer (no cookie needed)
              </summary>
              <pre className={`text-mono ${styles.code}`}>
                {state.data.usage_example.bearer}
              </pre>
            </details>

            <ul className={styles.warnings}>
              {state.data.warnings.map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>

            <div className={styles.footer}>
              <button
                type="button"
                onClick={issue}
                className={`btn ${styles.reissue}`}
              >
                Issue another key
              </button>
              <button
                type="button"
                onClick={onClose}
                className={`btn btn-primary ${styles.done}`}
              >
                Done
              </button>
            </div>
          </div>
        )}
      </div>
    </div>,
    document.body,
  );
}
