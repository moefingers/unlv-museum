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
import { readFileSync, readdirSync } from "node:fs";
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
    { id: "seed-quirktruck-workordermgr", name: "Work Order Manager", email: "workorder@quirktruck.seed" },
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

  // Column is `role` (singular text[]) per CustomSession.user.role and
  // the view-layer's `session.user.role.includes(...)` calls. The five
  // canonical non-admin roles are defined in the source's
  // app/lib/definitions.ts `roleLookUp`: page-manager,
  // credential-manager, change-name, audit-logs, work-orders.
  const adminRes = await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
    VALUES
      ('seed-quirktruck-admin', 'Quirk Truck Admin', 'admin@quirktruck.seed', ${pwHash}, true, ARRAY[]::text[])
    RETURNING id
  `);
  const adminId = (adminRes.rows[0] as { id: string }).id;

  const pagemgrRes = await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
    VALUES
      ('seed-quirktruck-pagemgr', 'Page Manager', 'pagemgr@quirktruck.seed', ${pwHash}, false, ARRAY['page-manager','change-name'])
    RETURNING id
  `);
  const pagemgrId = (pagemgrRes.rows[0] as { id: string }).id;

  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
    VALUES
      ('seed-quirktruck-credmgr', 'Credential Manager', 'credmgr@quirktruck.seed', ${pwHash}, false, ARRAY['credential-manager','change-name'])
  `);
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
    VALUES
      ('seed-quirktruck-auditor', 'Audit Reader', 'auditor@quirktruck.seed', ${pwHash}, false, ARRAY['audit-logs'])
  `);
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
    VALUES
      ('seed-quirktruck-workordermgr', 'Work Order Manager', 'workorder@quirktruck.seed', ${pwHash}, false, ARRAY['work-orders'])
  `);
  await db.execute(sql`
    INSERT INTO quirk_truck_enhanced.users
      (museum_user_id, name, email, password, admin, role)
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

  // Bulk-load the Original QuirkTruck's Box 3 photo assets. The
  // Original CRA app shipped them under `src/img/trucks/box3/*.webp`
  // and referenced them from `data/trucks.json` by relative path
  // (`./trucks/box3/oil.webp`). The museum Enhanced port stores image
  // bytes in `quirk_truck_enhanced.images` and serves them through
  // `/api/v2/quirk-truck-enhanced/images/<uuid>`. Here we insert each
  // .webp's raw bytes (no re-compression needed; they're already
  // hand-prepared small assets) and build a {filename: url} map so
  // the section seed can reference them by their original names.
  console.log("[seed] quirk-truck-enhanced: uploading Box 3 photo assets");
  const box3ImageDir = resolve(
    process.cwd(),
    ".sources/quirkTruck/src/img/trucks/box3",
  );
  const box3Files = readdirSync(box3ImageDir).filter((f) => f.endsWith(".webp"));
  const box3ImageUrls: Record<string, string> = {};
  for (const filename of box3Files) {
    const bytes = readFileSync(resolve(box3ImageDir, filename));
    const base64 = bytes.toString("base64");
    const res = await db.execute(sql`
      INSERT INTO quirk_truck_enhanced.images
        (owner_user_id, mime, bytes, width, height)
      VALUES
        (${adminId}, 'image/webp', decode(${base64}, 'base64'), NULL, NULL)
      RETURNING id
    `);
    const id = (res.rows[0] as { id: string }).id;
    box3ImageUrls[filename] = `/api/v2/quirk-truck-enhanced/images/${id}`;
  }
  /** Resolve a list of Original-style refs like `./trucks/box3/oil.webp`
   *  to museum URLs. Skips any ref we don't have bytes for (Truck 801
   *  was referenced in JSON but the .webp files weren't checked into
   *  the source repo). */
  const resolveBox3 = (refs: string[]): string[] =>
    refs
      .map((ref) => box3ImageUrls[ref.split("/").pop() || ""])
      .filter((u): u is string => Boolean(u));

  console.log("[seed] quirk-truck-enhanced: inserting pages tree (single jsonb doc)");
  // Pages use `id` + `title` (source's actions.ts mutates by `title`,
  // routes by id-slug). Sections use `name` per the source's `section`
  // type in definitions.ts — the lineage walker keys off `section.name`.
  // We add `id` to sections as a soft improvement so future code can
  // reference sections by stable id without breaking the name-keyed
  // walker.
  // Trucks Overview is seeded from the Original QuirkTruck catalog
  // (`.sources/quirkTruck/src/data/trucks.json`) so the Enhanced demo
  // ships with the same fleet a visitor would see in the Original tier.
  // Each top-level section is a truck; each truck's `preTrip`,
  // `postTrip`, `quirks` are nested sections under it. The Original
  // referenced images by relative paths into `public/img/trucks/...`;
  // the museum port leaves those image refs as bare strings for now
  // (the URL guard in PageCard skips them — only museum-issued
  // `/api/v2/.../images/<uuid>` URLs render). When a visitor uploads
  // real bytes, the new URL replaces the seed string.
  // Section structure follows the source's `section` type
  // (definitions.ts): `name`, `id?`, `description?`, `notes?`,
  // `image?`, `images?`, `tags?`, `sections?`. `page-sections.tsx`
  // surfaces `description` and `notes` as text content under the
  // collapsible header, and `images[]` as inline thumbnails above
  // it. `tags[]` renders as a row of pill chips. Ported verbatim
  // from `.sources/quirkTruck/src/data/trucks.json`; image refs
  // resolved through `resolveBox3()` so only Box 3 (the only truck
  // whose .webp files were checked into the source repo) renders
  // images. Truck 801 / Devestator / Lego entries kept their text
  // content but ship without images — the Original's JSON referenced
  // them but the bytes never made it into the repo.
  const trucks = [
    {
      id: "truck-801",
      name: "Truck 801",
      description:
        "A big truck with a side tipper and tail gate + raise bed to dump. Used for: glass, food waste.",
      images: [],
      sections: [
        {
          id: "801-pre-trip",
          name: "Pre-Trip",
          description: "Pre-trip checklist for Truck 801.",
          images: [],
          sections: [
            { id: "801-oil", name: "Oil", description: "Type: 69W-420.", notes: "Do not overfill.", images: [], sections: [] },
            { id: "801-transmission", name: "Transmission Fluid", description: "Type: green-monster brand, extra scary type.", notes: "Must be checked when transmission system is at full operating temperature.", images: [], sections: [] },
            { id: "801-coolant", name: "Coolant", description: "Type: RED YOU MUST USE RED PLEASE.", notes: "Make sure to taste it before filling.", images: [], sections: [] },
            { id: "801-tires", name: "Tires", description: "Rated pressure: 100 psi.", notes: "The inner tires can be checked and filled through the outers.", images: [], sections: [] },
            {
              id: "801-lights",
              name: "Lights",
              description: "Front, top, side, and rear light groups.",
              images: [],
              sections: [
                { id: "801-front-lights", name: "Front Lights", notes: "High beam, low beam, running light, signals.", images: [], sections: [] },
                { id: "801-top-lights", name: "Top Lights", notes: "Running lights on or near top on front, back, and sides.", images: [], sections: [] },
                { id: "801-side-lights", name: "Side Lights", notes: "Type and location, IE side lights found on side.", images: [], sections: [] },
                { id: "801-rear-lights", name: "Rear Lights", notes: "Brake, tail, reverse, signal, strobe.", images: [], sections: [] },
              ],
            },
          ],
        },
        {
          id: "801-post-trip",
          name: "Post-Trip",
          description: "Post-trip checklist for Truck 801.",
          images: [],
          sections: [
            { id: "801-air-tanks", name: "Air Tanks", notes: "On colder days, air tanks should be emptied at end of shift by turning valves.", images: [], sections: [] },
            { id: "801-cng", name: "CNG", notes: "This is a CNG truck. Please fill in front or on side.", images: [], sections: [] },
          ],
        },
        {
          id: "801-quirks",
          name: "Quirks",
          description: "Operator quirks for Truck 801.",
          images: [],
          sections: [
            { id: "801-hold-breath", name: "Hold Breath", description: "You have to hold your breath when you start it.", tags: ["operation"], images: [], sections: [] },
            { id: "801-tipper", name: "Tipper", description: "Make sure the latch is fixed on the crossbar before raising the tipper all the way up or you'll end up with a bin in truck.", tags: ["operation", "prevention", "safety"], images: [], sections: [] },
            { id: "801-magic-words", name: "Magic Words", description: "You have to say the magic words when using the PTO or it will explode.", tags: ["operation", "truckDamage", "safety"], images: [], sections: [] },
          ],
        },
      ],
    },
    {
      id: "truck-box3",
      name: "Box 3",
      description: "Box truck, shorter than box 4 but wider. Used for: utility.",
      images: [],
      sections: [
        {
          id: "box3-pre-trip",
          name: "Pre-Trip",
          description: "Pre-trip checklist for Box 3.",
          images: [],
          sections: [
            { id: "box3-raise-cab", name: "Raise Cab", description: "Driver side to the right of door.", notes: "From the first image, pull handle in yellow circle, at the same time pull the handle in the red circle. Then, pull the flat silver handle and use the black handle to raise the cab.", images: resolveBox3(["raiseCab1.webp", "raiseCab2.webp"]), sections: [] },
            { id: "box3-oil", name: "Oil", description: "Type: 10W-30. Passenger side when cab is lifted. Search 'Raise Cab' for more details.", notes: "Yellow circle highlights dipstick. Red circle highlights fill port.", images: resolveBox3(["oil.webp"]), sections: [] },
            { id: "box3-transmission", name: "Transmission Fluid", description: "Type: Dexron 6 Transmission Fluid. Passenger side when cab is lifted. Search 'Raise Cab' for more details.", notes: "Must be checked when transmission system is at full operating temperature, after driving for an hour.", images: resolveBox3(["transmissionFluid.webp"]), sections: [] },
            { id: "box3-fuel", name: "Fuel", description: "Type: Unleaded (Gasoline). On driver side of truck.", notes: "Sometimes a pump may stop before it is full. Fill more slowly if necessary.", images: resolveBox3(["fuelPort.webp"]), sections: [] },
            { id: "box3-coolant", name: "Coolant", description: "Type: RED! YOU MUST USE RED, PLEASE! Found on right side of truck between cab and box.", images: resolveBox3(["coolant.webp"]), sections: [] },
            { id: "box3-tires", name: "Tires", description: "Type: 80 psi.", notes: "The inner tires can be checked and filled from through the outers.", images: resolveBox3(["tireInner.webp", "tireOuter.webp", "tire.webp"]), sections: [] },
            { id: "box3-battery", name: "Battery", description: "Two batteries, group 31. Wired in parallel for 12 V system. Passenger side, low, to the left of steer axle.", notes: "Check for signs of corrosion around contacts.", images: resolveBox3(["battery.webp"]), sections: [] },
            { id: "box3-wiper-fluid", name: "Wiper Fluid", description: "Open passenger door. On side of glove box.", notes: "Make sure cap is secured after filling.", images: resolveBox3(["wiperFluid.webp"]), sections: [] },
            {
              id: "box3-lights",
              name: "Lights",
              description: "Front, top, side-rear-top, rear, and license-plate light groups.",
              images: [],
              sections: [
                { id: "box3-front", name: "Front", notes: "Light on the left is a headlight. Both lights on the right are clearance lights, one of which is a turn-signal as well.", images: resolveBox3(["headLight.webp"]), sections: [] },
                { id: "box3-top", name: "Top", notes: "DRL — (5) lights on top of cab, (2) lights on top corners.", images: resolveBox3(["topFront.webp"]), sections: [] },
                { id: "box3-side-rear-top", name: "Side Rear Top", notes: "On each side, in the top rear corner.", images: resolveBox3(["sideRearTop.webp"]), sections: [] },
                { id: "box3-rear", name: "Rear", notes: "Shared brake, tail, signal lights. Separate reverse in white. (5) running lights on top.", images: resolveBox3(["rear.webp", "reverseLight.webp"]), sections: [] },
                { id: "box3-license-light", name: "License Plate Light", notes: "On the inner edge by the license plate.", images: resolveBox3(["licenseLight.webp"]), sections: [] },
              ],
            },
          ],
        },
        {
          id: "box3-post-trip",
          name: "Post-Trip",
          description: "Post-trip checklist for Box 3.",
          images: [],
          sections: [
            { id: "box3-example", name: "An Example", notes: "This is something you should check in your post trip.", images: [], sections: [] },
          ],
        },
        {
          id: "box3-quirks",
          name: "Quirks",
          description: "Operator quirks for Box 3.",
          images: [],
          sections: [
            { id: "box3-lift-gate", name: "Lift Gate", description: "To operate lift gate, it must be turned on. Then after using switch to lower all the way, unfold it, and unfold it again.", tags: ["operation"], images: resolveBox3(["lampAndLiftSwitch.webp", "liftGateSwitch.webp", "liftGateUnfold1.webp", "liftGateUnfold2.webp"]), sections: [] },
            { id: "box3-locked-ignition", name: "Can't turn key", description: "If you cannot turn the key, jerk the steering wheel rapidly back and forth while turning the key.", tags: ["operation"], images: resolveBox3(["ignition.webp"]), sections: [] },
          ],
        },
      ],
    },
    {
      id: "truck-devestator",
      name: "Devestator",
      description: "A really destructive truck. Used for: devestation.",
      images: [],
      sections: [
        {
          id: "devestator-quirks",
          name: "Quirks",
          description: "Operator quirks for the Devestator.",
          images: [],
          sections: [
            { id: "devestator-destruction", name: "Pure Destruction", description: "If you're not careful, then you'll get destroyed. This thing is not safe.", tags: ["operation", "safety", "prevention"], images: [], sections: [] },
          ],
        },
      ],
    },
    {
      id: "truck-lego",
      name: "Lego Truck",
      description: "We use this truck to play. Used for: play-time, utility.",
      images: [],
      sections: [
        {
          id: "lego-quirks",
          name: "Quirks",
          description: "Operator quirks for the Lego Truck.",
          images: [],
          sections: [
            { id: "lego-play-value", name: "Play Value", description: "Just saying this truck isn't good for anything other than play time.", tags: ["operation", "safety", "prevention"], images: [], sections: [] },
          ],
        },
      ],
    },
  ];

  const pagesTree = {
    "trucks-overview": {
      id: "trucks-overview",
      title: "Trucks Overview",
      description: "Top-level catalog of our trucks — ported from the Original QuirkTruck CRA app's `trucks.json` so the Enhanced demo carries the same fleet visitors see in the Original tier.",
      image: null,
      sections: trucks,
    },
    "maintenance-log": {
      id: "maintenance-log",
      title: "Maintenance Log",
      description: "Service records by truck and by date.",
      image: null,
      sections: [
        {
          id: "march-2024",
          name: "March 2024",
          description: "Two oil changes, one transmission service.",
          images: [],
          sections: [
            {
              id: "truck-801",
              name: "Truck 801",
              description: "Oil change on 2024-03-12. Synthetic 5W-30.",
              images: [],
              sections: [],
            },
          ],
        },
        {
          id: "april-2024",
          name: "April 2024",
          description: "Quiet month — one tire rotation.",
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
