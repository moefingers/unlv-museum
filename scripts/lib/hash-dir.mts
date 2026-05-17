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
 */
export function hashDir(dir: string): string {
  const files = walkFiles(dir).sort();
  const overall = createHash("sha256");
  for (const rel of files) {
    const bytes = readFileSync(join(dir, rel));
    const fileHash = createHash("sha256").update(bytes).digest("hex");
    overall.update(`${rel.replace(/\\/g, "/")}\n${fileHash}\n`);
  }
  return `sha256:${overall.digest("hex")}`;
}

function walkFiles(root: string, dir = root): string[] {
  const out: string[] = [];
  for (const name of readdirSync(dir).sort()) {
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
