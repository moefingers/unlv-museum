/**
 * Seed data for the quirk-truck Enhanced tier (EnterPrize era).
 *
 * Strategy: rather than port the tangled original codebase
 * (`@vercel/postgres` + `@vercel/kv` + `@prisma/client` mixed in one
 * file), we capture the original's *visible features* as strong seed
 * data on the new Drizzle schema. The museum-ready/enhanced app is
 * then rewritten fresh against this data using the museum's
 * established Enhanced-tier conventions (rest-rant, admin-portal,
 * sql-demo as precedents).
 *
 * Demonstrates every EnterPrize feature visible in the source:
 *
 *   1. Admin + multi-role users (page-manager, credential-manager,
 *      audit-logs, work-orders, change-name) — proves the role
 *      system without hard-coding the role names anywhere except here.
 *   2. The pages-tree as a single `documents` row with key='pages',
 *      holding the same nested-sections shape the original used
 *      (`{<pageId>: {id, title, description, image, sections: [...]}}`)
 *      with sections recursively nesting. Three pages, the second
 *      with two top-level sections and one nested sub-section.
 *   3. Work-orders mid-flow: one needing a second signature
 *      (status='needs_signatures'), one completed.
 *   4. Audit log: every seed insert records itself, so the audit
 *      trail demo has populated history out of the box.
 *   5. One image row — a placeholder webp blob attached to a page.
 *      Client-side webp encoding is exercised in the rewrite, not
 *      here; the seed just demonstrates the schema works.
 *
 * Run via `pnpm seed:quirk-truck-enhanced` (registered in
 * package.json) after `db:push` has applied the schema. Idempotent:
 * truncates the schema's tables before inserting.
 *
 * Skips the `users.museum_user_id` FK contract — the seed creates
 * synthetic auth.user rows because the museum-OAuth bridge isn't
 * wired yet. In production, museum-OAuth flow provisions the
 * project user JIT from the GitHub session.
 */

import { config } from "dotenv";
import { resolve } from "node:path";
import { drizzle } from "drizzle-orm/neon-http";
import { neon } from "@neondatabase/serverless";
import { sql } from "drizzle-orm";
import * as bcrypt from "bcryptjs";

config({ path: resolve(process.cwd(), ".env.local") });

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error("DATABASE_URL missing — set it in .env.local");
  process.exit(1);
}

const client = neon(dbUrl);
const db = drizzle(client);

/**
 * 1x1 transparent webp generated via canvas in a browser, copy-paste
 * of the base64 — small enough to embed inline as a stand-in for the
 * image-bytes column. The real client pipeline will produce
 * ~30–80KB blobs from full-resolution sources via canvas.toBlob.
 */
const TRANSPARENT_WEBP_BASE64 =
  "UklGRiQAAABXRUJQVlA4IBgAAAAwAQCdASoBAAEAAUAmJaQAA3AA/vuUAAA=";

async function main() {
  console.log("[seed] quirk-truck-enhanced: clearing existing data");

  // Truncate in FK-safe order — work_orders / images / users all reference
  // auth.user; users.image_id references images; work_orders.requester_id
  // references users. The CASCADE on the museum_user_id FK means deleting
  // synthetic auth.user rows would cascade-delete the project users, which
  // we don't want — so we delete project tables first, leave auth.user
  // alone (it's shared museum infrastructure).
  await db.execute(sql`TRUNCATE quirk_truck_enhanced.audit_log RESTART IDENTITY CASCADE`);
  await db.execute(sql`TRUNCATE quirk_truck_enhanced.work_orders CASCADE`);
  await db.execute(sql`TRUNCATE quirk_truck_enhanced.documents CASCADE`);
  await db.execute(sql`DELETE FROM quirk_truck_enhanced.users`);
  await db.execute(sql`DELETE FROM quirk_truck_enhanced.images`);

  // Create synthetic auth.user rows for the seed. In production these
  // come from the museum-OAuth bridge (GitHub sign-in). We mark them
  // with a `seed-` prefix on the id so they're trivially identifiable.
  const seedAuthUsers = [
    { id: "seed-quirktruck-admin", name: "Quirk Truck Admin", email: "admin@quirktruck.seed" },
    { id: "seed-quirktruck-pagemgr", name: "Page Manager", email: "pagemgr@quirktruck.seed" },
    { id: "seed-quirktruck-credmgr", name: "Credential Manager", email: "credmgr@quirktruck.seed" },
    { id: "seed-quirktruck-auditor", name: "Audit Reader", email: "auditor@quirktruck.seed" },
    { id: "seed-quirktruck-worker", name: "Regular User", email: "worker@quirktruck.seed" },
  ];

  for (const u of seedAuthUsers) {
    await db.execute(sql`
      INSERT INTO auth."user" (id, name, email, email_verified, created_at, updated_at, verified)
      VALUES (${u.id}, ${u.name}, ${u.email}, true, NOW(), NOW(), true)
      ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, email = EXCLUDED.email
    `);
  }

  console.log("[seed] quirk-truck-enhanced: inserting users");
  const pwHash = await bcrypt.hash("demo-password", 10);

  const adminRes = await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, roles)
    VALUES
      ('seed-quirktruck-admin', 'Quirk Truck Admin', 'admin@quirktruck.seed', ${pwHash}, true, ARRAY[]::text[])
    RETURNING id
  `);
  const adminId = (adminRes.rows[0] as { id: string }).id;

  const pagemgrRes = await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, roles)
    VALUES
      ('seed-quirktruck-pagemgr', 'Page Manager', 'pagemgr@quirktruck.seed', ${pwHash}, false, ARRAY['page-manager','change-name'])
    RETURNING id
  `);
  const pagemgrId = (pagemgrRes.rows[0] as { id: string }).id;

  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, roles)
    VALUES
      ('seed-quirktruck-credmgr', 'Credential Manager', 'credmgr@quirktruck.seed', ${pwHash}, false, ARRAY['credential-manager','change-name'])
  `);
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, roles)
    VALUES
      ('seed-quirktruck-auditor', 'Audit Reader', 'auditor@quirktruck.seed', ${pwHash}, false, ARRAY['audit-logs'])
  `);
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, roles)
    VALUES
      ('seed-quirktruck-worker', 'Regular User', 'worker@quirktruck.seed', ${pwHash}, false, ARRAY[]::text[])
  `);

  console.log("[seed] quirk-truck-enhanced: inserting placeholder image");
  const imgRes = await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.images
      (owner_user_id, mime, bytes, width, height)
    VALUES
      (${adminId}, 'image/webp', decode(${TRANSPARENT_WEBP_BASE64}, 'base64'), 1, 1)
    RETURNING id
  `);
  const imgId = (imgRes.rows[0] as { id: string }).id;

  console.log("[seed] quirk-truck-enhanced: inserting pages tree (single jsonb doc)");
  const pagesTree = {
    "trucks-overview": {
      id: "trucks-overview",
      title: "Trucks Overview",
      description: "Top-level catalog of our trucks.",
      image: imgId,
      sections: [
        {
          id: "fleet-status",
          title: "Fleet Status",
          content: "Eight trucks in active service.",
          images: [imgId],
          sections: [],
        },
      ],
    },
    "maintenance-log": {
      id: "maintenance-log",
      title: "Maintenance Log",
      description: "Service records by truck and by date.",
      image: null,
      sections: [
        {
          id: "march-2024",
          title: "March 2024",
          content: "Two oil changes, one transmission service.",
          images: [],
          sections: [
            {
              id: "truck-801",
              title: "Truck 801",
              content: "Oil change on 2024-03-12. Synthetic 5W-30.",
              images: [],
              sections: [],
            },
          ],
        },
        {
          id: "april-2024",
          title: "April 2024",
          content: "Quiet month — one tire rotation.",
          images: [],
          sections: [],
        },
      ],
    },
    "drivers": {
      id: "drivers",
      title: "Drivers",
      description: "Driver assignments and credentials.",
      image: null,
      sections: [],
    },
  };

  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.documents (key, data)
    VALUES ('pages', ${JSON.stringify(pagesTree)}::jsonb)
    ON CONFLICT (key) DO UPDATE SET data = EXCLUDED.data, updated_at = NOW()
  `);

  console.log("[seed] quirk-truck-enhanced: inserting work-orders");
  // One mid-flow: needs second signature to promote pagemgr → admin.
  // One completed: a finished name-change request.
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.work_orders
      (status, summary, action, data, required_roles, required_signature_count, signature_list, requester_id, requester_name, assignee_id, assignee_name)
    VALUES
      (
        'needs_signatures',
        'Promote Page Manager to Admin',
        'promote-to-admin',
        ${JSON.stringify({ targetUserId: pagemgrId, targetName: "Page Manager" })}::jsonb,
        ${JSON.stringify([["admin"]])}::jsonb,
        2,
        ARRAY[${adminId}]::text[],
        ${adminId},
        'Quirk Truck Admin',
        NULL,
        NULL
      )
  `);

  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.work_orders
      (status, summary, action, data, required_roles, required_signature_count, signature_list, requester_id, requester_name, assignee_id, assignee_name)
    VALUES
      (
        'completed',
        'Change name: Page Manager → Pat M.',
        'change-name',
        ${JSON.stringify({ targetUserId: pagemgrId, oldName: "Page Manager", newName: "Pat M." })}::jsonb,
        ${JSON.stringify([["change-name"], ["admin"]])}::jsonb,
        1,
        ARRAY[${adminId}]::text[],
        ${pagemgrId},
        'Page Manager',
        ${adminId},
        'Quirk Truck Admin'
      )
  `);

  console.log("[seed] quirk-truck-enhanced: inserting audit log");
  // Standard Enhanced-tier shape — every mutation that happened above
  // records here. For the seed we just write summary rows; the
  // rewrite's `audit()` helper writes per-mutation in production.
  const auditRows = [
    { op: "insertMany", coll: "users", login: "admin", summary: "seeded 5 users" },
    { op: "insertOne", coll: "images", login: "admin", summary: "seeded placeholder image" },
    { op: "insertOne", coll: "documents", login: "admin", summary: "seeded pages tree" },
    { op: "insertOne", coll: "work_orders", login: "admin", summary: "promote-to-admin work order opened" },
    { op: "workOrderCompleted", coll: "work_orders", login: "admin", summary: "change-name work order completed" },
  ];

  for (const r of auditRows) {
    await db.execute(sql`
      INSERT INTO quirk_truck_enhanced.audit_log
        (actor_id, actor_login, collection, op, tier, before, after)
      VALUES
        ('seed-quirktruck-admin', ${r.login}, ${r.coll}, ${r.op}, 'enhanced', NULL,
         ${JSON.stringify({ summary: r.summary })}::jsonb)
    `);
  }

  console.log("[seed] quirk-truck-enhanced: done.");
  console.log(`[seed]   admin user id:   ${adminId}`);
  console.log(`[seed]   pagemgr user id: ${pagemgrId}`);
  console.log(`[seed]   image id:        ${imgId}`);
}

main().catch((err) => {
  console.error("[seed] failed:", err);
  process.exit(1);
});
