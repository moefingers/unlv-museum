"use client";

/**
 * Museum-wide auth chip. Shows "Sign in with GitHub" when signed out;
 * shows the user's avatar + verified-badge dot when signed in. Clicking
 * the avatar opens a popover with sign-out.
 *
 * Spec: CONTEXT/internal_docs/auth.md §Sign-In Surface
 */

import { useState, useRef, useEffect } from "react";
import { authClient, useSession } from "@/lib/auth-client";
import { BadgeCheck, KeyRound, LogOut, Loader2 } from "lucide-react";
import { siGithub } from "simple-icons";
import { ApiKeyModal } from "./ApiKeyModal";
import styles from "./SignInChip.module.css";

const PRODUCTION_HOST = "unlv-museum.recanon.com";

/**
 * GitHub sign-in runs on production only. The museum's GitHub OAuth App
 * registers production's callback, and the relay that used to carry a
 * sign-in from production to other origins is gone (2026-11-14): it handed
 * out bearer claims. See auth.md §Sign-in off production.
 *
 * Off production (previews, LAN, localhost) the chip sends the browser to the
 * same page on production, where it can sign in. To be signed in on the
 * other origin itself (Chrome MCP, automated tests, local work), use a PAT:
 * auth.md §PAT.
 *
 * Returns the same page on production, or null when already there.
 */
function productionPageIfElsewhere(): string | null {
  if (typeof window === "undefined") return null;
  const { hostname, pathname, search, hash } = window.location;
  if (hostname === PRODUCTION_HOST) return null;
  return `https://${PRODUCTION_HOST}${pathname}${search}${hash}`;
}

// The Better Auth `User` type doesn't include our custom `verified` field
// (it's a column we added to the schema, not a plugin field), so narrow it
// at the boundary instead of fighting the type at every read site.
function isVerified(user: unknown): boolean {
  return (
    typeof user === "object" &&
    user !== null &&
    "verified" in user &&
    user.verified === true
  );
}

// Inline GitHub mark using simple-icons' CC0 path. lucide-react 1.x didn't
// include a Github glyph; rendering the path directly keeps us off a new dep.
function GithubMark({ size = 14 }: { size?: number }) {
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

export function SignInChip() {
  const { data: session, isPending } = useSession();
  const [signingIn, setSigningIn] = useState(false);
  const [popoverOpen, setPopoverOpen] = useState(false);
  const [apiKeyOpen, setApiKeyOpen] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Click-outside to close popover.
  useEffect(() => {
    if (!popoverOpen) return;
    const onClick = (e: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(e.target as Node)
      ) {
        setPopoverOpen(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, [popoverOpen]);

  if (isPending) {
    return (
      <div className={styles.loadingChip}>
        <Loader2 size={16} className={styles.loadingSpinner} />
      </div>
    );
  }

  if (!session) {
    return (
      <button
        type="button"
        disabled={signingIn}
        onClick={async () => {
          setSigningIn(true);
          const productionPage = productionPageIfElsewhere();
          if (productionPage) {
            window.location.assign(productionPage);
            return;
          }
          // Production: direct OAuth.
          await authClient.signIn.social({
            provider: "github",
            callbackURL: window.location.href,
          });
        }}
        className={`btn btn-primary ${styles.signInButton}`}
      >
        {signingIn ? (
          <Loader2 size={14} className={styles.loadingSpinner} />
        ) : (
          <GithubMark size={14} />
        )}
        <span>Sign in</span>
      </button>
    );
  }

  const user = session.user;

  return (
    <div className={styles.signedInWrap} ref={popoverRef}>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className={styles.avatarButton}
        aria-label="Account menu"
      >
        <div className={styles.avatarWrap}>
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={user.image} alt="" className={styles.avatarImg} />
          ) : (
            <div className={`text-xs ${styles.avatarFallback}`}>
              {user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {/*
            Verified dot — bottom-right corner of the avatar. Reuses zcanon's
            --success token for verified-state signaling.
          */}
          {isVerified(user) ? (
            <BadgeCheck
              size={14}
              className={styles.verifiedBadge}
              strokeWidth={2.5}
              aria-label="Verified"
            />
          ) : null}
        </div>
      </button>

      {popoverOpen && (
        <div className={styles.popover}>
          <div className={styles.popoverHeader}>
            <p className={`text-sm ${styles.popoverName}`}>{user.name}</p>
            <p className={`text-xs ${styles.popoverEmail}`}>
              {user.email}
              {isVerified(user) && (
                <BadgeCheck
                  size={11}
                  className={styles.popoverEmailBadge}
                  strokeWidth={2.5}
                />
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setPopoverOpen(false);
              setApiKeyOpen(true);
            }}
            className={`text-sm ${styles.popoverAction}`}
          >
            <KeyRound size={14} />
            Request / refresh API key
          </button>
          <button
            type="button"
            onClick={async () => {
              setPopoverOpen(false);
              await authClient.signOut();
              window.location.reload();
            }}
            className={`text-sm ${styles.popoverAction}`}
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
      {apiKeyOpen && <ApiKeyModal onClose={() => setApiKeyOpen(false)} />}
    </div>
  );
}
