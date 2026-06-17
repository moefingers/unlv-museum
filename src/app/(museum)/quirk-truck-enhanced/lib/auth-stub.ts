/**
 * Museum-OAuth bridge for the EnterPrize Historical Enhanced port.
 *
 * The original `auth.ts` used NextAuth v5 beta with Credentials + Google
 * providers. The museum-ready port replaces that with the museum's
 * Better Auth session, bridged via the `museum_user_id` FK contract
 * (see CONTEXT/internal_docs/identity-and-signup.md).
 *
 * Despite the file name (`auth-stub`, kept for the original import path
 * rewrite), this is no longer a stub. The flow:
 *
 *   1. Read the museum's Better Auth session via `auth.api.getSession`.
 *   2. Look up the corresponding `quirk_truck_enhanced.users` row
 *      where `museum_user_id = museum-session.user.id`.
 *   3. Shape the result as `CustomSession` (the source code's expected
 *      `session.user.{id,email,name,role,admin,...}` shape).
 *
 * If no project-level row exists for the museum identity, `auth()`
 * returns null — the view layer treats that as "not signed in" and the
 * dashboard's role gates will block writes. The visitor is expected to
 * hit `/quirk-truck-enhanced/login` and complete the three-factor login
 * predicate via /api/v2/quirk-truck-enhanced/authentication (or the
 * "Login with UNLV Museum" button when their museum identity is already
 * pre-bridged by an admin).
 *
 * The `signIn` / `signOut` exports remain thin wrappers so the source
 * code's `signIn('credentials', formData)` / `signOut()` call sites
 * port verbatim. `signOut` clears the museum cookie via Better Auth;
 * `signIn` POSTs to the project's three-factor login route.
 */

import { headers } from "next/headers";
import { eq } from "drizzle-orm";

import { auth as museumAuth } from "@/lib/auth";
import { db } from "@/lib/db";
import { users as projectUsers } from "@/lib/schema/quirk-truck-enhanced";
import type { CustomSession } from "./definitions";

export async function auth(): Promise<CustomSession | null> {
  const museumSession = await museumAuth.api.getSession({
    headers: await headers(),
  });
  if (!museumSession) return null;

  const [projectUser] = await db
    .select()
    .from(projectUsers)
    .where(eq(projectUsers.museumUserId, museumSession.user.id))
    .limit(1);
  if (!projectUser) return null;

  return {
    user: {
      id: projectUser.id,
      email: projectUser.email,
      name: projectUser.name,
      image: museumSession.user.image ?? null,
      emailVerified: null,
      admin: projectUser.admin,
      role: projectUser.role,
    },
    expires: new Date(Date.now() + 1000 * 60 * 60 * 24).toISOString(),
  } as CustomSession;
}

/**
 * Source-compatible `signIn(provider, formData)`. The original called
 * NextAuth with `'credentials'` and `'google'`. The museum-ready port
 * routes credentials through the three-factor login at
 * /api/v2/quirk-truck-enhanced/authentication; Google is gone, replaced
 * by the museum-OAuth button in login-form.tsx (which calls
 * `authClient.signIn.social` directly without going through this
 * function).
 *
 * Stays minimal: posts to the auth route. The route's
 * `guardMutation` enforces the museum session being present, so this
 * function being called without a museum session is a 401 (which
 * `authenticate()` in actions.ts surfaces as "Invalid credentials.").
 */
export async function signIn(
  provider?: string,
  formData?: FormData | { redirectTo?: string },
): Promise<void> {
  if (provider !== "credentials" || !(formData instanceof FormData)) {
    // Google path is removed; museum-OAuth happens client-side via
    // authClient.signIn.social, not through this server function.
    return;
  }
  // Server actions don't have window.fetch's absolute URL guess; we
  // dispatch by reading the runtime base URL.
  const baseUrl =
    process.env.BETTER_AUTH_URL ||
    (process.env.NODE_ENV === "production"
      ? "https://unlv-museum.recanon.com"
      : "http://localhost:3000");

  const res = await fetch(`${baseUrl}/api/v2/quirk-truck-enhanced/authentication`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // Forward the visitor's cookies so guardMutation sees the museum
      // session.
      cookie: (await headers()).get("cookie") ?? "",
    },
    body: JSON.stringify({
      email: formData.get("email"),
      password: formData.get("password"),
    }),
  });
  if (!res.ok) {
    // Mirrors NextAuth's CredentialsSignin throw shape — the
    // authenticate() action catches and returns "Invalid credentials.".
    throw new Error("CredentialsSignin");
  }
}

/**
 * Source-compatible `signOut()`. Clears the museum session cookie
 * (Better Auth) — the EnterPrize app didn't have its own session
 * store, so there's nothing project-side to clear.
 */
export async function signOut(_options?: {
  redirectTo?: string;
}): Promise<void> {
  await museumAuth.api.signOut({
    headers: await headers(),
  });
}
