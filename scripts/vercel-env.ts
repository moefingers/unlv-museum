import { readFileSync, existsSync } from "fs";
import { resolve } from "path";

/**
 * Canonical two-way Vercel env sync. Replaces the ad-hoc curl pattern
 * documented in CONTEXT/internal_docs/vercel-env.md with a script that
 * does the right thing every time.
 *
 *   pnpm vercel:env pull        Show what's on Vercel + values (non-sensitive)
 *   pnpm vercel:env diff        Compare .env.local against Vercel; no mutations
 *   pnpm vercel:env push        Reconcile local → Vercel
 *   pnpm vercel:env consolidate Merge same-value duplicate entries
 *
 * Design invariants:
 * - Reads VERCEL_SUPER_TOKEN from user env (per-team variants supported).
 * - Reads project + team IDs from .vercel/project.json.
 * - Never echoes secret values in stdout.
 * - For each key: at most ONE entry per distinct value. If
 *   production+preview+development all share a value, one entry with
 *   target=["production","preview","development"]. Splits arise only
 *   when values genuinely differ across environments.
 * - Sensitive type: Vercel doesn't return plaintext for sensitive in
 *   bulk reads, so we can't diff. Default behavior: skip. With
 *   --include-sensitive: always re-push from local for sensitive keys.
 *
 * Annotation override in .env.local (optional, per-key):
 *
 *     # @vercel: type=encrypted target=production,preview,development
 *     ROOT_DOMAIN="zcanon.com"
 *
 * Without annotation: existing keys preserve their current Vercel
 * type+target; new keys default to type=sensitive target=production,preview.
 *
 * `--prune` removes keys present on Vercel but absent from .env.local.
 * Use carefully; some keys are managed by Vercel integrations (Marketplace
 * etc) and should never be touched. These usually have
 * `configurationId !== null` — the script skips those automatically.
 */

const VERCEL_API = "https://api.vercel.com";

type Target = "production" | "preview" | "development";
const ALL_TARGETS: readonly Target[] = ["production", "preview", "development"];
const DEFAULT_NEW_TARGETS: readonly Target[] = ["production", "preview"];

type EnvType = "system" | "secret" | "encrypted" | "plain" | "sensitive";

type VercelEnvEntry = {
  id: string;
  key: string;
  value?: string;
  type: EnvType;
  target: Target[] | string[];
  configurationId?: string | null;
  gitBranch?: string | null;
  createdAt?: number;
  updatedAt?: number;
};

type ProjectLink = {
  projectId: string;
  orgId: string; // teamId on the API
  projectName?: string;
};

type LocalEntry = {
  key: string;
  value: string;
  type?: EnvType;
  target?: Target[];
  skip?: boolean;
};

/**
 * Local-only vars that should never be pushed to Vercel, regardless of
 * whether they appear in .env.local. These are typically dev-machine
 * tokens (PAT_TOKEN), Vercel-injected runtime tokens (VERCEL_OIDC_TOKEN
 * is set automatically at deploy time and should never be stored as a
 * project env var), or third-party tooling state.
 *
 * Override per-project with `# @vercel: skip` annotation in .env.local.
 */
const BUILTIN_SKIP_KEYS = new Set([
  "PAT_TOKEN",
  "VERCEL_OIDC_TOKEN",
  "VERCEL_GIT_PREVIOUS_SHA",
  "TURBO_TOKEN",
]);

/* ───────────── token + project linkage ───────────── */

function tokenForTeam(teamSlug?: string | null): string {
  if (teamSlug) {
    const k = `VERCEL_SUPER_TOKEN_${teamSlug.toUpperCase().replace(/-/g, "_")}`;
    const v = process.env[k];
    if (v) return v;
  }
  const fallback = process.env.VERCEL_SUPER_TOKEN;
  if (!fallback) {
    throw new Error(
      "VERCEL_SUPER_TOKEN is not set. See CONTEXT/internal_docs/vercel-env.md.",
    );
  }
  return fallback;
}

function readProjectLink(cwd: string): ProjectLink {
  const path = resolve(cwd, ".vercel/project.json");
  if (!existsSync(path)) {
    throw new Error(
      `No .vercel/project.json at ${cwd}. Run \`vercel link\` first (or create the file manually with { projectId, orgId, projectName }).`,
    );
  }
  const raw = readFileSync(path, "utf-8");
  const parsed = JSON.parse(raw) as ProjectLink;
  if (!parsed.projectId || !parsed.orgId) {
    throw new Error(
      `${path} is missing projectId/orgId. Run \`vercel link\` to repopulate it.`,
    );
  }
  return parsed;
}

/* ───────────── Vercel API ───────────── */

async function vapi<T>(
  path: string,
  init: { token: string; method?: string; body?: unknown } = {} as never,
): Promise<T> {
  const res = await fetch(`${VERCEL_API}${path}`, {
    method: init.method ?? "GET",
    headers: {
      Authorization: `Bearer ${init.token}`,
      "Content-Type": "application/json",
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(
      `Vercel ${init.method ?? "GET"} ${path} → ${res.status}: ${text.slice(0, 300)}`,
    );
  }
  return (await res.json()) as T;
}

async function listVercelEnv(
  link: ProjectLink,
  token: string,
): Promise<VercelEnvEntry[]> {
  // decrypt=true is requested but Vercel's bulk endpoint typically still
  // returns the encrypted-at-rest envelope (base64 of {v,c,k}) for both
  // `sensitive` and `encrypted` types. The single-entry endpoint will
  // decrypt for an owner token, but doing that per-key is N+1 — we
  // accept the limitation and treat encrypted blobs as undiffable.
  // {@link isEncryptedBlob} detects them.
  const r = await vapi<{ envs: VercelEnvEntry[] }>(
    `/v9/projects/${link.projectId}/env?teamId=${link.orgId}&decrypt=true`,
    { token },
  );
  return r.envs ?? [];
}

/**
 * Heuristic for "this value is a Vercel-encrypted envelope, not
 * plaintext". Vercel returns base64(JSON({v,c,k,...})) for encrypted
 * entries even with decrypt=true on the bulk endpoint.
 */
function isEncryptedBlob(value: string | undefined | null): boolean {
  if (!value || value.length < 100) return false;
  try {
    const decoded = Buffer.from(value, "base64").toString("utf-8");
    if (!decoded.startsWith('{"v":')) return false;
    const parsed = JSON.parse(decoded) as Record<string, unknown>;
    return !!parsed && "v" in parsed && "c" in parsed;
  } catch {
    return false;
  }
}

async function createEnv(
  link: ProjectLink,
  token: string,
  body: { key: string; value: string; type: EnvType; target: Target[] },
): Promise<unknown> {
  return vapi(`/v10/projects/${link.projectId}/env?teamId=${link.orgId}`, {
    token,
    method: "POST",
    body: [body],
  });
}

async function patchEnv(
  link: ProjectLink,
  token: string,
  envId: string,
  body: Partial<{ value: string; target: Target[]; type: EnvType }>,
): Promise<unknown> {
  return vapi(
    `/v9/projects/${link.projectId}/env/${envId}?teamId=${link.orgId}`,
    { token, method: "PATCH", body },
  );
}

async function deleteEnv(
  link: ProjectLink,
  token: string,
  envId: string,
): Promise<unknown> {
  return vapi(
    `/v9/projects/${link.projectId}/env/${envId}?teamId=${link.orgId}`,
    { token, method: "DELETE" },
  );
}

/* ───────────── local .env parsing ───────────── */

function parseLocalEnv(cwd: string): Map<string, LocalEntry> {
  const path = resolve(cwd, ".env.local");
  if (!existsSync(path)) return new Map();
  const text = readFileSync(path, "utf-8");
  const out = new Map<string, LocalEntry>();
  let pendingAnnotation: {
    type?: EnvType;
    target?: Target[];
    skip?: boolean;
  } | null = null;

  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line) {
      pendingAnnotation = null;
      continue;
    }
    if (line.startsWith("#")) {
      const m = line.match(/@vercel:\s*(.*)$/);
      if (m && m[1]) {
        pendingAnnotation = parseAnnotation(m[1]);
      }
      continue;
    }
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const key = line.slice(0, eq).trim();
    let value = line.slice(eq + 1).trim();
    // Strip enclosing quotes
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!key) continue;
    out.set(key, {
      key,
      value,
      type: pendingAnnotation?.type,
      target: pendingAnnotation?.target,
      skip: pendingAnnotation?.skip ?? BUILTIN_SKIP_KEYS.has(key),
    });
    pendingAnnotation = null;
  }
  return out;
}

function parseAnnotation(s: string): {
  type?: EnvType;
  target?: Target[];
  skip?: boolean;
} {
  const out: { type?: EnvType; target?: Target[]; skip?: boolean } = {};
  for (const pair of s.split(/\s+/)) {
    if (pair === "skip") {
      out.skip = true;
      continue;
    }
    const [k, v] = pair.split("=");
    if (!k || !v) continue;
    if (k === "type") {
      if (["encrypted", "plain", "sensitive"].includes(v)) {
        out.type = v as EnvType;
      }
    } else if (k === "target") {
      const targets = v
        .split(",")
        .filter((t): t is Target => ALL_TARGETS.includes(t as Target));
      if (targets.length > 0) out.target = targets;
    }
  }
  return out;
}

/* ───────────── reconciliation ───────────── */

type Plan = {
  creates: Array<{
    key: string;
    value: string;
    type: EnvType;
    target: Target[];
    reason: string;
  }>;
  updates: Array<{
    entryId: string;
    key: string;
    newValue?: string;
    newTarget?: Target[];
    reason: string;
  }>;
  deletes: Array<{ entryId: string; key: string; reason: string }>;
  consolidations: Array<{
    key: string;
    deleteIds: string[];
    createTarget: Target[];
    value: string;
    type: EnvType;
    reason: string;
  }>;
  skipped: Array<{ key: string; reason: string }>;
};

function emptyPlan(): Plan {
  return {
    creates: [],
    updates: [],
    deletes: [],
    consolidations: [],
    skipped: [],
  };
}

type PlanOpts = {
  prune: boolean;
  includeSensitive: boolean;
};

function planChanges(
  local: Map<string, LocalEntry>,
  vercel: VercelEnvEntry[],
  opts: PlanOpts,
): Plan {
  const plan = emptyPlan();
  const byKey = new Map<string, VercelEnvEntry[]>();
  for (const v of vercel) {
    // Vercel-managed integrations: never touch.
    if (v.configurationId) {
      plan.skipped.push({
        key: v.key,
        reason: `integration-managed (configurationId=${v.configurationId})`,
      });
      continue;
    }
    if (v.type === "system") {
      plan.skipped.push({ key: v.key, reason: "system var" });
      continue;
    }
    if (!byKey.has(v.key)) byKey.set(v.key, []);
    byKey.get(v.key)!.push(v);
  }

  // 1. Consolidation: same key, multiple entries, all with identical
  //    values → merge into one with combined target.
  for (const [key, entries] of byKey.entries()) {
    if (entries.length <= 1) continue;
    // Only consolidate when values can be compared (non-sensitive) or
    // when explicitly opted in for sensitive (then assume "same value").
    const sensitive = entries.every((e) => e.type === "sensitive");
    if (sensitive && !opts.includeSensitive) {
      plan.skipped.push({
        key,
        reason: `${entries.length} sensitive entries — re-run with --include-sensitive to consolidate`,
      });
      continue;
    }
    const valueGroups = new Map<string, VercelEnvEntry[]>();
    for (const e of entries) {
      const v = e.value ?? "<sensitive>";
      if (!valueGroups.has(v)) valueGroups.set(v, []);
      valueGroups.get(v)!.push(e);
    }
    for (const [val, group] of valueGroups.entries()) {
      if (group.length <= 1) continue;
      // Combine target sets
      const combined: Target[] = [];
      for (const e of group) {
        for (const t of e.target as Target[]) {
          if (!combined.includes(t)) combined.push(t);
        }
      }
      plan.consolidations.push({
        key,
        deleteIds: group.map((g) => g.id),
        createTarget: combined,
        value: val,
        type: group[0]!.type,
        reason: `${group.length} entries with identical value → 1 entry targeting ${combined.join("+")}`,
      });
    }
  }

  // 2. Apply local truth on remaining
  const consolidationDeleteIds = new Set(
    plan.consolidations.flatMap((c) => c.deleteIds),
  );
  for (const [key, localEntry] of local.entries()) {
    if (localEntry.skip) {
      plan.skipped.push({
        key,
        reason: "local-only (skip annotation or built-in skip list)",
      });
      continue;
    }
    const remoteEntries = (byKey.get(key) ?? []).filter(
      (e) => !consolidationDeleteIds.has(e.id),
    );

    if (remoteEntries.length === 0) {
      // New key — create.
      const type: EnvType = localEntry.type ?? "sensitive";
      // Sensitive can't target development per Vercel policy.
      let target = localEntry.target ?? [...DEFAULT_NEW_TARGETS];
      if (type === "sensitive") {
        target = target.filter((t) => t !== "development");
        if (target.length === 0) target = ["production", "preview"];
      }
      plan.creates.push({
        key,
        value: localEntry.value,
        type,
        target,
        reason: "new (not on Vercel)",
      });
      continue;
    }

    // Existing key — update value(s) where they differ. Preserve target set.
    for (const r of remoteEntries) {
      const undiffable =
        r.type === "sensitive" ||
        r.value === undefined ||
        r.value === null ||
        isEncryptedBlob(r.value);
      if (undiffable) {
        if (opts.includeSensitive) {
          plan.updates.push({
            entryId: r.id,
            key,
            newValue: localEntry.value,
            reason: `${r.type} — value forced from local`,
          });
        } else {
          plan.skipped.push({
            key,
            reason: `${r.type} — Vercel doesn't return plaintext in bulk; run with --include-sensitive to re-push`,
          });
        }
        continue;
      }
      const remoteValue: string = r.value ?? "";
      if (remoteValue !== localEntry.value) {
        plan.updates.push({
          entryId: r.id,
          key,
          newValue: localEntry.value,
          reason: `value differs (target=${(r.target as Target[]).join("+")}, local=${localEntry.value.length}c, remote=${remoteValue.length}c)`,
        });
      }
    }
  }

  // 3. Prune: keys on Vercel but not in local
  if (opts.prune) {
    for (const [key, entries] of byKey.entries()) {
      if (local.has(key)) continue;
      for (const e of entries) {
        if (consolidationDeleteIds.has(e.id)) continue;
        plan.deletes.push({
          entryId: e.id,
          key,
          reason: "absent from .env.local (--prune)",
        });
      }
    }
  }

  return plan;
}

/* ───────────── apply ───────────── */

async function applyPlan(
  plan: Plan,
  link: ProjectLink,
  token: string,
): Promise<void> {
  for (const c of plan.consolidations) {
    for (const id of c.deleteIds) {
      await deleteEnv(link, token, id);
    }
    await createEnv(link, token, {
      key: c.key,
      value: c.value,
      type: c.type,
      target: c.createTarget,
    });
    console.log(`  consolidated ${c.key} → target=${c.createTarget.join("+")}`);
  }
  for (const c of plan.creates) {
    await createEnv(link, token, {
      key: c.key,
      value: c.value,
      type: c.type,
      target: c.target,
    });
    console.log(`  created ${c.key} (${c.type}, target=${c.target.join("+")})`);
  }
  for (const u of plan.updates) {
    const body: Partial<{ value: string; target: Target[] }> = {};
    if (u.newValue !== undefined) body.value = u.newValue;
    if (u.newTarget !== undefined) body.target = u.newTarget;
    await patchEnv(link, token, u.entryId, body);
    console.log(`  updated ${u.key}`);
  }
  for (const d of plan.deletes) {
    await deleteEnv(link, token, d.entryId);
    console.log(`  deleted ${d.key}`);
  }
}

/* ───────────── print ───────────── */

function printPlan(plan: Plan): void {
  const total =
    plan.consolidations.length +
    plan.creates.length +
    plan.updates.length +
    plan.deletes.length;
  if (total === 0) {
    console.log("No changes needed.");
  } else {
    if (plan.consolidations.length) {
      console.log(`\nConsolidate (${plan.consolidations.length}):`);
      for (const c of plan.consolidations)
        console.log(`  ${c.key}  ${c.reason}`);
    }
    if (plan.creates.length) {
      console.log(`\nCreate (${plan.creates.length}):`);
      for (const c of plan.creates)
        console.log(
          `  ${c.key}  ${c.type}  target=${c.target.join("+")}  (${c.reason})`,
        );
    }
    if (plan.updates.length) {
      console.log(`\nUpdate (${plan.updates.length}):`);
      for (const u of plan.updates) console.log(`  ${u.key}  ${u.reason}`);
    }
    if (plan.deletes.length) {
      console.log(`\nDelete (${plan.deletes.length}):`);
      for (const d of plan.deletes) console.log(`  ${d.key}  ${d.reason}`);
    }
  }
  if (plan.skipped.length) {
    console.log(`\nSkipped (${plan.skipped.length}):`);
    for (const s of plan.skipped) console.log(`  ${s.key}  ${s.reason}`);
  }
}

function printPull(vercel: VercelEnvEntry[]): void {
  // Group by key for readability
  const byKey = new Map<string, VercelEnvEntry[]>();
  for (const v of vercel) {
    if (!byKey.has(v.key)) byKey.set(v.key, []);
    byKey.get(v.key)!.push(v);
  }
  const keys = [...byKey.keys()].sort();
  for (const k of keys) {
    const entries = byKey.get(k)!;
    for (const e of entries) {
      const tag = e.configurationId
        ? " [integration]"
        : e.type === "system"
          ? " [system]"
          : "";
      const tail =
        e.type === "sensitive"
          ? "(sensitive)"
          : e.value && e.value.length > 60
            ? `${e.value.slice(0, 30)}…(${e.value.length} chars)`
            : (e.value ?? "(no value)");
      console.log(
        `  ${k} [${e.type}, ${(e.target as Target[]).join("+")}]${tag}  = ${tail}`,
      );
    }
  }
  console.log(`\n${vercel.length} total entries`);
}

/* ───────────── main ───────────── */

async function main() {
  const [cmd, ...rest] = process.argv.slice(2);
  const cwd = process.cwd();
  const link = readProjectLink(cwd);
  const token = tokenForTeam(undefined); // personal-scoped default; vercel-env.md notes per-team variant lookup

  const opts: PlanOpts = {
    prune: rest.includes("--prune"),
    includeSensitive: rest.includes("--include-sensitive"),
  };

  if (!cmd || cmd === "diff") {
    const [vercel, local] = await Promise.all([
      listVercelEnv(link, token),
      Promise.resolve(parseLocalEnv(cwd)),
    ]);
    const plan = planChanges(local, vercel, opts);
    console.log(`Project: ${link.projectName ?? link.projectId}`);
    printPlan(plan);
    return;
  }

  if (cmd === "pull") {
    const vercel = await listVercelEnv(link, token);
    console.log(`Project: ${link.projectName ?? link.projectId}\n`);
    printPull(vercel);
    return;
  }

  if (cmd === "push") {
    const [vercel, local] = await Promise.all([
      listVercelEnv(link, token),
      Promise.resolve(parseLocalEnv(cwd)),
    ]);
    const plan = planChanges(local, vercel, opts);
    console.log(`Project: ${link.projectName ?? link.projectId}`);
    printPlan(plan);
    const total =
      plan.consolidations.length +
      plan.creates.length +
      plan.updates.length +
      plan.deletes.length;
    if (total === 0) return;
    if (!rest.includes("--yes") && !rest.includes("-y")) {
      console.log(`\nRe-run with --yes to apply.`);
      return;
    }
    console.log(`\nApplying…`);
    await applyPlan(plan, link, token);
    console.log(`Done.`);
    return;
  }

  if (cmd === "consolidate") {
    const vercel = await listVercelEnv(link, token);
    // Build plan with empty local (so no creates/updates/deletes — only consolidations fire)
    const plan = planChanges(new Map(), vercel, opts);
    plan.creates = [];
    plan.updates = [];
    plan.deletes = [];
    console.log(`Project: ${link.projectName ?? link.projectId}`);
    printPlan(plan);
    if (plan.consolidations.length === 0) return;
    if (!rest.includes("--yes") && !rest.includes("-y")) {
      console.log(`\nRe-run with --yes to apply.`);
      return;
    }
    console.log(`\nApplying…`);
    await applyPlan(plan, link, token);
    console.log(`Done.`);
    return;
  }

  console.error(
    `Usage: pnpm vercel:env <pull|diff|push|consolidate> [--yes] [--prune] [--include-sensitive]`,
  );
  process.exit(2);
}

main()
  .then(() => process.exit(0))
  .catch((e: unknown) => {
    console.error(e instanceof Error ? e.message : String(e));
    process.exit(1);
  });
