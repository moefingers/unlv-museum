/**
 * Trusted callback URL validator. Used by the OAuth relay (/auth/relay and
 * /auth/relay/complete) and by /auth/redirect to decide where a signed-in
 * browser may be sent. A relay callback receives a claim token, and a claim
 * is a sign-in: whoever holds it can exchange it at /api/auth/claim/session
 * for the user's session. So only hosts the museum serves are trusted:
 *
 *  - unlv-museum.recanon.com (the canonical production host), over https;
 *  - localhost and the private network (RFC 1918, 127.x), in local
 *    development only.
 *
 * Never a shared hosting namespace such as *.vercel.app, *.vercel.dev or
 * *.vercel.sh: anyone can create a free host there, so a name in it says
 * nothing about who serves it. Trusting them let any Vercel user receive a
 * claim for whoever followed a link (fixed 2026-11-14, as recanon's #53).
 * Never a private address on a deployment: on production, a callback to
 * 192.168.x.x or 127.0.0.1 would hand the claim, over plain http, to whatever
 * machine answers there on the visitor's network (as recanon's #54).
 *
 * Anything else is rejected; the caller falls back to a safe default.
 */

import net from "node:net";

const PRODUCTION_HOST = "unlv-museum.recanon.com";

function isPrivateIp(hostname: string): boolean {
  if (hostname === "localhost") return true;
  if (net.isIP(hostname) !== 4) return false;
  const parts = hostname.split(".");
  const first = parseInt(parts[0]!, 10);
  const second = parseInt(parts[1]!, 10);
  if (first === 10) return true;
  if (first === 172 && second >= 16 && second <= 31) return true;
  if (first === 192 && second === 168) return true;
  if (first === 127) return true;
  return false;
}

// Local development: not on a Vercel deployment. `vercel env pull` writes
// VERCEL_ENV="development" for a laptop; a deployment has "preview" or
// "production".
function isLocalDevelopment(env: NodeJS.ProcessEnv): boolean {
  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

export function isTrustedCallbackUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Malformed URL: the caller falls back to the safe default.
    return false;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return false;
  if (parsed.username || parsed.password) return false;

  const hostname = parsed.hostname;
  if (isPrivateIp(hostname)) return isLocalDevelopment(env);

  // The production host only over https: a claim in a plain-http URL can be
  // read in transit.
  return parsed.protocol === "https:" && hostname === PRODUCTION_HOST;
}
