import { readdirSync, readFileSync, statSync } from "node:fs";
import { createHash } from "node:crypto";
import { join, relative } from "node:path";

/**
 * Compute a deterministic content hash of a directory tree. Used as the
 * `lockHash` field in src/lib/sources.generated.json — guards against
 * accidental edits to public/originals/<slug>/ that bypass the sync workflow.
 *
 * Algorithm: walk files in sorted order, hash each file's bytes (SHA-256),
 * concatenate `<posix-path>\n<file-hash>\n` lines, hash the concatenation.
 * Path separators are normalized to POSIX so hashes are stable across
 * Windows/macOS/Linux.
 *
 * Line endings are normalized too: in a file git would treat as text, every
 * CRLF is hashed as LF. With core.autocrlf=true, git checks text files out
 * as CRLF, so a fresh clone, a worktree or a re-checkout of a submodule
 * would otherwise hash differently from the LF files the sync wrote. git
 * calls a file binary, and never converts it, when a NUL byte appears in
 * its first 8000 bytes; the same test here leaves binaries byte for byte.
 */
export function hashDir(dir: string): string {
  const files = walkFiles(dir).sort();
  const overall = createHash("sha256");
  for (const rel of files) {
    const bytes = normalizeEol(readFileSync(join(dir, rel)));
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    overall.update(`${rel.replace(/\\/g, "/")}\n${fileHash}\n`);
  }
  return `sha256:${overall.digest("hex")}`;
}

const NUL = 0x00;
const CR = 0x0d;
const LF = 0x0a;
/** How far git looks for a NUL byte when deciding a file is binary. */
const GIT_BINARY_SNIFF = 8000;

function normalizeEol(bytes: Buffer): Buffer {
  if (bytes.subarray(0, GIT_BINARY_SNIFF).includes(NUL) || !bytes.includes(CR))
    return bytes;
  const out = Buffer.allocUnsafe(bytes.length);
  let n = 0;
  for (let i = 0; i < bytes.length; i++) {
    if (bytes[i] === CR && bytes[i + 1] === LF) continue;
    out[n++] = bytes[i];
  }
  return out.subarray(0, n);
}

// Top-level directories never contribute to the content hash. `.git` because
// it captures HEAD shifts / packed-refs churn that have nothing to do with
// the source files; `node_modules` because hashing it is slow and meaningless
// (it isn't shipped). These exist primarily for backend-only recipes that
// hash submodule roots — artifact directories (public/originals/<slug>/) under
// the other recipe types never contain either of these in practice.
const EXCLUDED_TOP_LEVEL = new Set([".git", "node_modules"]);

function walkFiles(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
    if (dir === root && EXCLUDED_TOP_LEVEL.has(name)) continue;
    const full = join(dir, name);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      out.push(...walkFiles(root, full));
    } else if (stat.isFile()) {
      out.push(relative(root, full));
    }
  }
  return out;
}
