/**
 * HMAC-signed short-lived claim token. Generated on the museum's production
 * origin after a successful OAuth sign-in, sent to a non-canonical environment
 * (preview, LAN) which POSTs it to /api/auth/claim/session to create its own
 * local session bound to the same user.
 *
 * BETTER_AUTH_SECRET is the signing key; production and local share the
 * same value via .env.local so signatures verify across environments.
 *
 * See CONTEXT/internal_docs/auth.md §OAuth Relay.
 */

import { createHmac, timingSafeEqual } from "crypto";

const SECRET = process.env.BETTER_AUTH_SECRET || "dev-secret";
const TOKEN_TTL_MS = 60_000; // 1 minute

interface ClaimPayload {
  userId: string;
  email: string;
  exp: number;
}

export function generateClaimToken(userId: string, email: string): string {
  const payload: ClaimPayload = {
    userId,
    email,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", SECRET).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyClaimToken(token: string): ClaimPayload | null {
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts as [string, string];

  const expected = createHmac("sha256", SECRET)
    .update(data)
    .digest("base64url");
  if (!timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString(),
    ) as ClaimPayload;
    if (payload.exp < Date.now()) return null;
    return payload;
  } catch {
    // Body isn't valid JSON. HMAC already passed so this only happens on
    // corrupted base64, never on tampered-but-signed input.
    return null;
  }
}
