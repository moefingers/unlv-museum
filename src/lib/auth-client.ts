/**
 * Browser-side Better Auth client. Use this for sign-in, sign-out, and
 * `useSession()` in client components.
 *
 *     import { authClient } from "@/lib/auth-client";
 *     await authClient.signIn.social({ provider: "github", callbackURL });
 *     await authClient.signOut();
 *     const { data: session } = authClient.useSession();
 */

import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  // baseURL is inferred from window.location.origin when omitted.
});

export const { signIn, signOut, useSession, getSession } = authClient;
