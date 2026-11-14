/**
 * Where a signed-in browser may be sent, and where the OAuth relay may
 * deliver a claim.
 *
 * Two checks, because the two answers differ:
 *
 *  - `isTrustedCallbackUrl` (/auth/redirect): where a browser may go after
 *    sign-in. unlv-museum.recanon.com over https, and localhost or the
 *    private network in local development only.
 *
 *  - `isTrustedRelayCallback` (/auth/relay, /auth/relay/complete): where a
 *    claim may be delivered. A claim is a sign-in: whoever holds it can
 *    exchange it at /api/auth/claim/session for the user's session. So a
 *    claim goes only to a local development server's /auth/claim, exactly
 *    that path with no query, and never anywhere from a production build.
 *    Production needs no claim for itself (the user already has the
 *    session), and previews no longer get one. So on production the relay
 *    delivers nothing until an attested relay is ported (OutlastSite's or
 *    zcanon's: the callback host proven by a Vercel OIDC token, the claim a
 *    single-use database row).
 *
 * Never a shared hosting namespace such as *.vercel.app: anyone can create a
 * free host there (fixed 2026-11-14, as recanon's #53). Never a private
 * address on a production build: a callback to 192.168.x.x or 127.0.0.1
 * would hand the claim, over plain http, to whatever machine answers there
 * on the visitor's network (as recanon's #54, #57).
 */

import net from "node:net";

const PRODUCTION_HOST = "unlv-museum.recanon.com";
const CLAIM_PATH = "/auth/claim";

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

// Local development: `next dev` (NODE_ENV "development"), not on a Vercel
// deployment. Both must hold. Every `next build` output has NODE_ENV
// "production" whatever else is set, so a missing VERCEL_ENV (system
// variables turned off, a self-hosted `next start`) or a copied one can't
// make production trust private addresses.
function isLocalDevelopment(env: NodeJS.ProcessEnv): boolean {
  if (env.NODE_ENV !== "development") return false;
  return env.VERCEL_ENV === undefined || env.VERCEL_ENV === "development";
}

function parse(url: string): URL | null {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    // Malformed URL: the caller falls back to the safe default.
    return null;
  }
  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") return null;
  if (parsed.username || parsed.password) return null;
  return parsed;
}

export function isTrustedCallbackUrl(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  const parsed = parse(url);
  if (!parsed) return false;
  if (isPrivateIp(parsed.hostname)) return isLocalDevelopment(env);
  // The production host only over https.
  return parsed.protocol === "https:" && parsed.hostname === PRODUCTION_HOST;
}

export function isTrustedRelayCallback(
  url: string,
  env: NodeJS.ProcessEnv = process.env,
): boolean {
  if (!isLocalDevelopment(env)) return false;
  const parsed = parse(url);
  if (!parsed) return false;
  if (!isPrivateIp(parsed.hostname)) return false;
  return parsed.pathname === CLAIM_PATH && !parsed.search && !parsed.hash;
}
