/**
 * Project + command metadata for the mongo-client viewer.
 *
 * Parallels api-client/api-data.ts but for shell-style projects whose
 * originals were never HTTP APIs — they were MongoDB shell exercises.
 * The first such project is JASKIS (animal-bounties tutorial).
 *
 * Each MongoProject lists its database, collections, and a set of
 * example shell commands the museum visitor can drop into the prompt.
 * The actual shell runtime (parsing + translation to Postgres via
 * Drizzle) lives in src/lib/mongo-shell/.
 *
 * Tier model (see memory: project_tier_definitions.md):
 *   - Original:   the shell against the same bounties data the source tutorial used
 *   - Enhanced:   same shell + an `auditLog` collection that records every
 *                 mutation across both tiers. Sign-in required for writes on
 *                 BOTH Original and Enhanced surfaces.
 *   - Reimagined: not a shell at all — that's a separate per-project route
 *                 (e.g. /jaskis as a bounty-board webapp). The MuseumChrome
 *                 tier strip's Reimagined link points there, not here.
 */

export interface MongoCommandExample {
  label: string;
  /** Multi-line is fine; preserved as-is for the prompt. */
  command: string;
  description: string;
}

export interface MongoProject {
  id: string;
  title: string;
  database: string;
  collections: string[];
  description: string;
  tech: string;
  examples: MongoCommandExample[];
}

const COMMON_EXAMPLES: MongoCommandExample[] = [
  {
    label: "Switch database",
    command: "use jaskis",
    description: "Selects the jaskis database",
  },
  {
    label: "Show collections",
    command: "show collections",
    description: "Lists every collection in the current database",
  },
  {
    label: "Find all bounties",
    command: "db.bounties.find()",
    description: "Returns every bounty in the collection",
  },
  {
    label: "Find in Grasslands",
    command: 'db.bounties.find({ location: "Grasslands" })',
    description: "Filter by an exact field match",
  },
  {
    label: "Reward >= 10000",
    command: "db.bounties.find({ reward: { $gte: 10000 } })",
    description: "Range query using the $gte operator",
  },
  {
    label: "Exclude client field",
    command: "db.bounties.find({}, { client: 0 })",
    description: "Projection — hide a field from the result",
  },
  {
    label: "Groundhog AND Woodlands",
    command:
      'db.bounties.find({ $and: [ { species: "Groundhog" }, { location: "Woodlands" } ] })',
    description: "Boolean composition with $and",
  },
  {
    label: "Insert Thanoceros",
    command: `db.bounties.insertOne({
  name: "Thanoceros",
  species: "Rhinoceros",
  location: "Grasslands",
  wantedFor: "Eating too much grass",
  client: "Songbird",
  reward: 10000,
  captured: false
})`,
    description: "Create a single bounty (sign-in required)",
  },
  {
    label: "Insert many",
    command: `db.bounties.insertMany([
  {
    name: "Lokinkajou",
    species: "Kinkajou",
    location: "Tropical rainforest",
    wantedFor: "Partying too late at night",
    client: "White tiger",
    reward: 1000,
    captured: false
  },
  {
    name: "Nebullama",
    species: "Llama",
    location: "Grasslands",
    wantedFor: "Drinking all the water from the ocean",
    client: "Songbird",
    reward: 2500,
    captured: false
  }
])`,
    description: "Bulk insert (sign-in required)",
  },
  {
    label: "Update one bounty",
    command:
      'db.bounties.updateOne({ name: "Polarwind" }, { $set: { reward: 10000 } })',
    description: "Modify a field on one match (sign-in required)",
  },
  {
    label: "Update all captured",
    command: "db.bounties.updateMany({}, { $set: { captured: true } })",
    description: "Bulk update — every document (sign-in required)",
  },
  {
    label: "Delete Lokinkajou",
    command: 'db.bounties.deleteOne({ name: "Lokinkajou" })',
    description: "Remove one bounty by name (sign-in required)",
  },
  {
    label: "Delete by client",
    command: 'db.bounties.deleteMany({ client: "Songbird" })',
    description: "Remove every bounty matching the filter (sign-in required)",
  },
  {
    label: "Count documents",
    command: "db.bounties.countDocuments()",
    description: "Returns the total number of bounties",
  },
];

const ENHANCED_AUDIT_EXAMPLES: MongoCommandExample[] = [
  {
    label: "Recent writes (audit)",
    command: "db.auditLog.find()",
    description: "Latest 50 mutations across both tiers, newest first",
  },
  {
    label: "Inserts only",
    command: 'db.auditLog.find({ op: "insertOne" })',
    description: "Filter the audit log by operation",
  },
  {
    label: "Writes by GitHub user",
    command: 'db.auditLog.find({ actorLogin: "moefingers" })',
    description: "Filter by the GitHub login that performed the write",
  },
  {
    label: "Original-tier writes",
    command: 'db.auditLog.find({ tier: "original" })',
    description: "Only writes that came through the Original tier surface",
  },
  {
    label: "Count audit entries",
    command: "db.auditLog.countDocuments()",
    description: "Total writes ever recorded across both tiers",
  },
];

export const MONGO_ORIGINAL: MongoProject[] = [
  {
    id: "jaskis",
    title: "JASKIS",
    database: "jaskis",
    collections: ["bounties"],
    description:
      "Animal-bounties registry from the original UNLV MongoDB shell exercise. Visitors type real Mongo shell commands; the museum translates them to the same data shape stored in Postgres.",
    tech: "Originally MongoDB shell exercise; museum runs the same syntax against Postgres",
    examples: COMMON_EXAMPLES,
  },
];

export const MONGO_ENHANCED: MongoProject[] = [
  {
    id: "jaskis",
    title: "JASKIS",
    database: "jaskis",
    collections: ["bounties", "auditLog"],
    description:
      "Same shell, same bounties data — plus an auditLog collection that records every mutation across both tiers (author, operation, before/after, timestamp). Anyone who writes is identifiable here. Sign-in required for writes on both tiers.",
    tech: "Postgres + Drizzle, with an audit_log table joined to auth.user",
    examples: [...COMMON_EXAMPLES, ...ENHANCED_AUDIT_EXAMPLES],
  },
];

export type Tier = "original" | "enhanced";

export function getProjectsForTier(tier: Tier): MongoProject[] {
  return tier === "enhanced" ? MONGO_ENHANCED : MONGO_ORIGINAL;
}
