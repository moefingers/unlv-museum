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
import { BadgeCheck, LogOut, Loader2 } from "lucide-react";
import { siGithub } from "simple-icons";
import styles from "./SignInChip.module.css";

const PRODUCTION_HOST = "unlv-museum.infinite-syndicate.com";

/**
 * Decide between direct GitHub OAuth and the relay-through-production flow.
 *
 * GitHub's OAuth App stores exactly one callback URL — so we register only
 * production. Every other origin (localhost, LAN IPs, preview deployments)
 * relays through production via /auth/relay → /auth/claim.
 *
 * Zcanon/OutlastSite use Google, which allows multiple callbacks AND has a
 * special localhost-port-agnostic mode, so they can exempt localhost from
 * the relay. GitHub has neither, so the museum's relay gate is simpler:
 * if you're not on production, you relay.
 *
 * For automated tests / Chrome MCP / network-free local dev, use PAT
 * instead — see auth.md §PAT.
 *
 * Returns:
 *  - null for direct flow (call authClient.signIn.social) — production only
 *  - a production URL to redirect to (`<prod>/auth/relay?callback=...`)
 *    for relay flow — everywhere else
 */
function relayOriginIfNeeded(): string | null {
  if (typeof window === "undefined") return null;
  const host = window.location.hostname;
  if (host === PRODUCTION_HOST) return null;
  return `https://${PRODUCTION_HOST}`;
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
          const relayOrigin = relayOriginIfNeeded();
          if (relayOrigin) {
            // Non-canonical origin (preview / LAN) — relay through prod.
            // /auth/claim on this origin reads ?callbackURL to return the
            // user to where they were after claiming.
            const claimReturn = new URL("/auth/claim", window.location.origin);
            claimReturn.searchParams.set("callbackURL", window.location.href);
            const relayUrl = new URL("/auth/relay", relayOrigin);
            relayUrl.searchParams.set("callback", claimReturn.toString());
            window.location.assign(relayUrl.toString());
            return;
          }
          // Localhost or production — direct OAuth.
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
    <div style={{ position: "relative" }} ref={popoverRef}>
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
    </div>
  );
}
