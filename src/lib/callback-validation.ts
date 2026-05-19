/**
 * Trusted callback URL validator. Used by the OAuth relay to decide whether
 * a non-canonical origin is allowed to claim a session created on production.
 *
 * Trust ladder (any one match accepts):
 *  - localhost / 127.0.0.1
 *  - RFC 1918 private IPv4 (10.*, 172.16-31.*, 192.168.*)
 *  - unlv-museum.infinite-syndicate.com (the canonical production host)
 *  - *.vercel.app / *.vercel.dev / *.vercel.sh (preview deployments)
 *
 * Anything else is rejected — the caller must fall back to a safe default.
 */

import net from "node:net";

const PRODUCTION_HOST = "unlv-museum.infinite-syndicate.com";
const TRUSTED_SUFFIXES = [".vercel.app", ".vercel.dev", ".vercel.sh"];

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

export function isTrustedCallbackUrl(url: string): boolean {
  try {
    const parsed = new URL(url);
    const hostname = parsed.hostname;

    if (isPrivateIp(hostname)) return true;
    if (hostname === PRODUCTION_HOST) return true;
    if (TRUSTED_SUFFIXES.some((s) => hostname.endsWith(s))) return true;

    return false;
  } catch {
    // Malformed URL — the caller falls back to the safe default.
    return false;
  }
}
