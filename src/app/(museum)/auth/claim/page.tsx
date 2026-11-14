"use client";

/**
 * Claim landing on the non-canonical origin. Posts the HMAC-signed claim
 * token from the URL to /api/auth/claim/session — the patAuth plugin's
 * /claim/session endpoint verifies the signature, looks up the user, and
 * sets a Better Auth session cookie on THIS origin. The user is now signed
 * in here, with a session bound to the same user as production.
 *
 * On success: go to callbackURL if it is a same-origin path, else `/`.
 * On failure: show a recoverable error.
 */

import { Suspense, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { safeInternalPath } from "@/lib/safe-internal-path";

export default function AuthClaim() {
  return (
    <Suspense>
      <AuthClaimInner />
    </Suspense>
  );
}

function AuthClaimInner() {
  const searchParams = useSearchParams();
  const [error, setError] = useState("");

  useEffect(() => {
    const claim = searchParams.get("claim");
    // Where to go afterwards: a same-origin path only. Never a scheme such
    // as javascript:, never another origin (2026-11-14).
    const next =
      safeInternalPath(
        searchParams.get("callbackURL"),
        window.location.origin,
      ) ?? "/";
    // Take the claim out of the address bar before anything else runs, so
    // nothing on the page (or in history) can read it.
    window.history.replaceState(null, "", window.location.pathname);
    if (!claim) {
      window.location.assign("/");
      return;
    }

    fetch("/api/auth/claim/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: claim }),
    }).then((res) => {
      if (res.ok) {
        window.location.assign(next);
      } else {
        setError(
          "Invalid or expired claim. Try signing in again from this page.",
        );
      }
    });
  }, [searchParams]);

  if (error) {
    return (
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "60vh",
          gap: "1rem",
          color: "var(--foreground)",
          fontFamily: "var(--font-mono, ui-monospace, monospace)",
          fontSize: "0.875rem",
        }}
      >
        <p>{error}</p>
        <Link href="/" style={{ opacity: 0.7, textDecoration: "underline" }}>
          Back to museum
        </Link>
      </div>
    );
  }

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        minHeight: "60vh",
        color: "var(--foreground)",
        fontFamily: "var(--font-mono, ui-monospace, monospace)",
        fontSize: "0.875rem",
        opacity: 0.7,
      }}
    >
      Claiming session…
    </div>
  );
}
