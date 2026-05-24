// One-shot import-rewrite for the EnterPrize Historical Enhanced port.
// Runs against the freshly-copied source tree at
// src/app/(museum)/quirk-truck-enhanced/. Rewrites:
//   import ... from '@/app/<rest>'   →   relative path within the sub-tree
//   import ... from '@/auth'         →   relative path to ./lib/auth-stub
//   import ... from '@/app/icon.png' →   relative path to ./ui/icon.png
//                                        (icon moved to ui/ to dodge the
//                                        App Router favicon convention)
//
// This is a one-time mechanical pass. It is not part of the museum's
// build pipeline; once committed, the files live with relative imports.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const SUB_TREE = path.resolve('src/app/(museum)/quirk-truck-enhanced');
const ICON_REAL_PATH = path.join(SUB_TREE, 'ui/icon.png');
const AUTH_STUB_PATH = path.join(SUB_TREE, 'lib/auth-stub.ts');

/** Posix-style relative path, with leading './' enforced. */
function rel(fromFile, toFile) {
  const out = path.posix.relative(
    path.posix.dirname(toPosix(fromFile)),
    toPosix(toFile),
  );
  if (out.startsWith('.')) return out;
  return `./${out}`;
}

function toPosix(p) {
  return p.split(path.sep).join('/');
}

/** Strip the .ts/.tsx extension from a module path. */
function stripExt(p) {
  return p.replace(/\.(tsx?|jsx?)$/, '');
}

const EXTS = new Set(['.ts', '.tsx']);

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
  const src = await fs.readFile(file, 'utf8');
  let out = src;

  // 1) @/auth  →  relative path to ./lib/auth-stub (no extension)
  out = out.replace(
    /(['"])@\/auth\1/g,
    (_m, q) => {
      const r = stripExt(rel(file, AUTH_STUB_PATH));
      return `${q}${r}${q}`;
    },
  );

  // 2) @/app/icon.png  →  relative path to ui/icon.png (keep extension)
  out = out.replace(
    /(['"])@\/app\/icon\.png\1/g,
    (_m, q) => `${q}${rel(file, ICON_REAL_PATH)}${q}`,
  );

  // 3) @/app/<rest>  →  relative path to <SUB_TREE>/<rest> (drop extension)
  out = out.replace(
    /(['"])@\/app\/([^'"\n]+)\1/g,
    (_m, q, rest) => {
      const target = path.join(SUB_TREE, rest);
      const r = stripExt(rel(file, target));
      return `${q}${r}${q}`;
    },
  );

  if (out === src) return false;
  await fs.writeFile(file, out, 'utf8');
  return true;
}

const files = await walk(SUB_TREE);
let changed = 0;
for (const f of files) {
  if (await rewriteFile(f)) {
    changed++;
    console.log('patched', path.relative(SUB_TREE, f));
  }
}
console.log(`\nrewrote imports in ${changed} of ${files.length} files`);
