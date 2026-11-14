/**
 * HMAC-signed short-lived claim token. Generated on the museum's production
 * origin after a successful OAuth sign-in, sent to a trusted callback, which
 * POSTs it to /api/auth/claim/session to create its own local session bound
 * to the same user.
 *
 * BETTER_AUTH_SECRET is the signing key. Without one, no claim is issued or
 * accepted: a fixed fallback would let anyone who reads this file sign a
 * claim for any user (fixed 2026-11-14, as recanon's #54).
 *
 * See CONTEXT/internal_docs/auth.md §OAuth Relay.
 */

import { createHmac, timingSafeEqual } from "crypto";

const TOKEN_TTL_MS = 60_000; // 1 minute

interface ClaimPayload {
  userId: string;
  email: string;
  exp: number;
}

function secret(): string | null {
  const value = process.env.BETTER_AUTH_SECRET;
  return value ? value : null;
}

function sign(data: string, key: string): string {
  return createHmac("sha256", key).update(data).digest("base64url");
}

/** A claim for this user, or null when no signing secret is configured. */
export function generateClaimToken(
  userId: string,
  email: string,
): string | null {
  const key = secret();
  if (!key) return null;
  const payload: ClaimPayload = {
    userId,
    email,
    exp: Date.now() + TOKEN_TTL_MS,
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  return `${data}.${sign(data, key)}`;
}

export function verifyClaimToken(token: unknown): ClaimPayload | null {
  if (typeof token !== "string") return null;
  const key = secret();
  if (!key) return null;
  const parts = token.split(".");
  if (parts.length !== 2) return null;
  const [data, sig] = parts as [string, string];

  const given = Buffer.from(sig);
  const expected = Buffer.from(sign(data, key));
  // timingSafeEqual throws on buffers of different lengths; a wrong-length
  // signature is simply not a valid claim.
  if (given.length !== expected.length) return null;
  if (!timingSafeEqual(given, expected)) return null;

  try {
    const payload = JSON.parse(
      Buffer.from(data, "base64url").toString(),
    ) as ClaimPayload;
    if (typeof payload.exp !== "number" || payload.exp < Date.now())
      return null;
    if (typeof payload.userId !== "string" || !payload.userId) return null;
    return payload;
  } catch {
    // Body isn't valid JSON. HMAC already passed so this only happens on
    // corrupted base64, never on tampered-but-signed input.
    return null;
  }
}
