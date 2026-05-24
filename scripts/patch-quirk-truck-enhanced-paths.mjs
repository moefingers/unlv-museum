// One-shot path-prefix sweep for the EnterPrize Historical Enhanced port.
//
// The 2024 source assumed it lived at the app root (`/login`,
// `/dashboard/...`, `/api/upload-image`, etc). The museum mounts it
// under `/quirk-truck-enhanced/*` instead. This script prefixes every
// literal "/login" and "/dashboard..." with "/quirk-truck-enhanced".
// "/api/upload-image" was already deleted; the new image upload route
// lives at "/api/v2/quirk-truck-enhanced/images" and is referenced from
// lib/image-upload.ts (not via a literal in this sub-tree).
//
// This rewrites literal strings only — `redirect("/dashboard/...")`,
// `href="/dashboard/..."`, `pathName.replace("/dashboard/...")`, etc.
// It deliberately does NOT touch dynamic strings like
// `"/dashboard/credentials/" + targetUser.id` because those keep the
// leading literal segment, which IS rewritten.

import { promises as fs } from "node:fs";
import path from "node:path";

const SUB_TREE = path.resolve("src/app/(museum)/quirk-truck-enhanced");
const BASE = "/quirk-truck-enhanced";
const EXTS = new Set([".ts", ".tsx"]);

// Match literal `"/login"`, `"/dashboard"`, `"/dashboard/..."` —
// preceded by a quote, followed by a non-word char or close-quote so
// we don't accidentally hit `"/dashboard-something-else"`.
const PATTERN = /(['"`])\/(login|dashboard)(?=[/\s'"`?#)+,])/g;

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...(await walk(full)));
    } else if (EXTS.has(path.extname(entry.name))) {
      files.push(full);
    }
  }
  return files;
}

async function rewriteFile(file) {
  const src = await fs.readFile(file, "utf8");
  const out = src.replace(PATTERN, (_m, q, seg) => `${q}${BASE}/${seg}`);
  if (out === src) return false;
  await fs.writeFile(file, out, "utf8");
  return true;
}

const files = await walk(SUB_TREE);
let changed = 0;
for (const f of files) {
  if (await rewriteFile(f)) {
    changed++;
    console.log("patched", path.relative(SUB_TREE, f));
  }
}
console.log(`\nrewrote paths in ${changed} of ${files.length} files`);
