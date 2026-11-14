/**
 * Where a signed-in browser may be sent after sign-in (/auth/redirect).
 *
 * unlv-museum.recanon.com over https, and localhost or the private network
 * in local development only.
 *
 * Never a shared hosting namespace such as *.vercel.app: anyone can create a
 * free host there (fixed 2026-11-14, as recanon's #53). Never a private
 * address outside local development: on a deployment, 192.168.x.x or
 * 127.0.0.1 is whatever machine answers there on the visitor's network (as
 * recanon's #54, #57).
 *
 * The museum used to run an OAuth relay here as well, which handed a signed
 * sign-in claim to another origin. It is gone (2026-11-14): a claim was a
 * bearer sign-in, and even a developer's own `next dev` relay would deliver
 * one over plain http to any machine on their network. GitHub sign-in off
 * production returns only with an attested relay. See auth.md
 * §Sign-in off production.
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

// Local development: `next dev` (NODE_ENV "development"), not on a Vercel
// deployment. Both must hold. On Vercel, the runtime sets NODE_ENV to
// "production" for every deployment, whatever VERCEL_ENV says, so a missing
// VERCEL_ENV (system variables turned off) or a copied one can't make a
// deployment trust private addresses. A self-hosted server started with
// `NODE_ENV=development next start` and no VERCEL_ENV would count as local
// development; the museum is never hosted that way.
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
