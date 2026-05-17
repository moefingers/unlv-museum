/**
 * Scans public/verified-banner-experiments/ for *.svg and rewrites the
 * `files` array in its index.html.
 *
 * Usage: pnpm tsx scripts/verified-banner-experiments/update-index.mts
 */
import { readdir, readFile, writeFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { dirname, join, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const dir = resolve(here, "..", "..", "public", "verified-banner-experiments");
const indexPath = join(dir, "index.html");

const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: "base" });

const entries = await readdir(dir, { withFileTypes: true });
const svgs = entries
  .filter((e) => e.isFile() && e.name.toLowerCase().endsWith(".svg"))
  .map((e) => e.name)
  .sort((a, b) => collator.compare(a, b));

const html = await readFile(indexPath, "utf8");
const arrayLiteral = `const files = [\n${svgs.map((n) => `        ${JSON.stringify(n)},`).join("\n")}\n      ];`;

const pattern = /const files = \[[\s\S]*?\];/;
if (!pattern.test(html)) {
  console.error(`could not find \`const files = [...]\` in ${indexPath}`);
  process.exit(1);
}

const next = html.replace(pattern, arrayLiteral);
if (next === html) {
  console.log(`no change — ${svgs.length} SVGs already listed`);
} else {
  await writeFile(indexPath, next);
  console.log(`updated ${indexPath} — ${svgs.length} SVGs listed`);
}
