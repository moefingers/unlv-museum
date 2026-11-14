/**
 * A path on this site to send the browser to, or null.
 *
 * Accepts only a same-origin path ("/projects/x?y=1"). Anything else is
 * refused: another origin, a protocol-relative "//evil.example", a backslash
 * trick ("/\evil.example"), and any scheme (javascript:, data:, https:). The
 * claim page used to pass a `callbackURL` straight to `location.assign`, so
 * `javascript:` ran on the museum's origin right after sign-in (2026-11-14).
 */
export function safeInternalPath(
  value: string | null | undefined,
  origin: string,
): string | null {
  if (!value) return null;
  if (!value.startsWith("/") || value.startsWith("//")) return null;
  if (value.includes("\\")) return null;
  let parsed: URL;
  try {
    parsed = new URL(value, origin);
  } catch {
    return null;
  }
  if (parsed.origin !== new URL(origin).origin) return null;
  return `${parsed.pathname}${parsed.search}${parsed.hash}`;
}
