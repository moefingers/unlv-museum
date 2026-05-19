import "server-only";
import { createHash } from "crypto";
import { readFileSync } from "fs";
import { join } from "path";

/**
 * Subresource Integrity (SRI) hash of public/theme-init.js.
 *
 * Computed once at module load on the server and embedded into the
 * `<script integrity="..." crossOrigin="anonymous">` tag in the root
 * layout. The browser refuses to execute the script if the fetched
 * file's content doesn't match this hash.
 *
 * Read from disk at module load so editing public/theme-init.js
 * updates the integrity automatically on next server start — no
 * drift between the file and the tag.
 *
 * Mirrors zcanon's src/lib/theme-script.ts verbatim; see
 * CONTEXT/internal_docs/theme.md "FOUC Prevention" for the full
 * rationale (React 19 inline-script warning, next/script
 * beforeInteractive limitation, CSP nonce vs SRI trade-off).
 */
function readThemeInit(): string {
  return readFileSync(join(process.cwd(), "public", "theme-init.js"), "utf8");
}

export const THEME_INIT_INTEGRITY = `sha384-${createHash("sha384")
  .update(readThemeInit())
  .digest("base64")}`;
