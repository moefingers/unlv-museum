"use client";

/**
 * Client-side trigger for Better Auth's GitHub OAuth flow. Fired by /auth/relay
 * after stashing the original callback in a cookie. Better Auth handles the
 * redirect to GitHub; on success we land at /auth/relay/complete with a session.
 */

import { useEffect } from "react";
import { authClient } from "@/lib/auth-client";

export default function RelayStart() {
  useEffect(() => {
    authClient.signIn.social({
      provider: "github",
      callbackURL: "/auth/relay/complete",
    });
  }, []);

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
      Redirecting to GitHub…
    </div>
  );
}
