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
      <div className="inline-flex h-9 items-center justify-center rounded-lg px-3 text-zinc-400">
        <Loader2 size={16} className="animate-spin" />
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
          await authClient.signIn.social({
            provider: "github",
            callbackURL: window.location.href,
          });
        }}
        className="inline-flex h-9 items-center gap-2 rounded-lg bg-zinc-900 px-3 text-sm font-medium text-white transition-colors hover:bg-zinc-700 disabled:opacity-50 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-zinc-300"
      >
        {signingIn ? (
          <Loader2 size={14} className="animate-spin" />
        ) : (
          <GithubMark size={14} />
        )}
        <span>Sign in</span>
      </button>
    );
  }

  const user = session.user;

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={() => setPopoverOpen((v) => !v)}
        className="group inline-flex items-center gap-2 rounded-lg p-1 transition-colors hover:bg-zinc-100 dark:hover:bg-zinc-800"
        aria-label="Account menu"
      >
        <div className="relative">
          {user.image ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={user.image}
              alt=""
              className="h-7 w-7 rounded-full ring-1 ring-zinc-200 dark:ring-zinc-700"
            />
          ) : (
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-zinc-200 text-xs font-medium text-zinc-700 ring-1 ring-zinc-300 dark:bg-zinc-700 dark:text-zinc-200 dark:ring-zinc-600">
              {user.name?.[0]?.toUpperCase() ?? "?"}
            </div>
          )}
          {/*
            Verified dot — bottom-right corner of the avatar. Reuses the
            zcanon-canonical green for verified-state signals.
          */}
          {isVerified(user) ? (
            <BadgeCheck
              size={14}
              className="absolute -right-1 -bottom-1 rounded-full bg-white text-emerald-600 dark:bg-zinc-900 dark:text-emerald-400"
              strokeWidth={2.5}
              aria-label="Verified"
            />
          ) : null}
        </div>
      </button>

      {popoverOpen && (
        <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border border-zinc-200 bg-white p-1 shadow-lg dark:border-zinc-700 dark:bg-zinc-900">
          <div className="border-b border-zinc-100 px-3 py-2 dark:border-zinc-800">
            <p className="truncate text-sm font-medium">{user.name}</p>
            <p className="flex items-center gap-1 truncate text-xs text-zinc-500">
              {user.email}
              {isVerified(user) && (
                <BadgeCheck
                  size={11}
                  className="text-emerald-600 dark:text-emerald-400"
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
            className="flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm text-zinc-700 transition-colors hover:bg-zinc-100 dark:text-zinc-300 dark:hover:bg-zinc-800"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      )}
    </div>
  );
}
