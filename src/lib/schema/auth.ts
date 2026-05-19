/**
 * Drizzle schema for Better Auth's tables. Lives under the `auth` pgSchema
 * in the museum's existing Neon project. Mirrors the canonical Better Auth
 * table shape (their plugins query these columns by exact name); deviations
 * are documented inline.
 *
 * Inline reimagined projects FK to `auth.user(id)` directly from their own
 * pgSchemas — real cross-schema foreign keys are supported within the same
 * Postgres DB. See CONTEXT/internal_docs/auth.md for the full spec.
 */

import { sql } from "drizzle-orm";
import {
  pgSchema,
  text,
  timestamp,
  boolean,
  uuid,
  jsonb,
  index,
} from "drizzle-orm/pg-core";

export const auth = pgSchema("auth");

/**
 * Better Auth's `user` table — required columns are name/email/emailVerified,
 * everything else is plugin-driven. The `verified` boolean is the museum's
 * own capability flag (NOT email verification — that's `emailVerified`);
 * it gates unlocked features in reimagined projects. See auth.md.
 */
export const user = auth.table("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("email_verified").default(false).notNull(),
  image: text("image"),
  createdAt: timestamp("created_at").defaultNow().notNull(),
  updatedAt: timestamp("updated_at")
    .defaultNow()
    .$onUpdate(() => /* @__PURE__ */ new Date())
    .notNull(),
  // Better Auth `admin` plugin fields — present so we can hand-roll
  // verification + banning later without a schema migration.
  role: text("role"),
  banned: boolean("banned").default(false),
  banReason: text("ban_reason"),
  banExpires: timestamp("ban_expires"),
  // Museum-specific: per-project feature unlocker. See auth.md §Verified-User Signal.
  verified: boolean("verified").default(false).notNull(),
});

export const session = auth.table(
  "session",
  {
    id: text("id").primaryKey(),
    expiresAt: timestamp("expires_at").notNull(),
    token: text("token").notNull().unique(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    // `admin` plugin impersonation column — kept so the plugin can attach
    // without schema migration if we ever turn it on.
    impersonatedBy: text("impersonated_by"),
  },
  (table) => [index("session_userId_idx").on(table.userId)],
);

export const account = auth.table(
  "account",
  {
    id: text("id").primaryKey(),
    accountId: text("account_id").notNull(),
    providerId: text("provider_id").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    accessToken: text("access_token"),
    refreshToken: text("refresh_token"),
    idToken: text("id_token"),
    accessTokenExpiresAt: timestamp("access_token_expires_at"),
    refreshTokenExpiresAt: timestamp("refresh_token_expires_at"),
    scope: text("scope"),
    // Better Auth's email/password plugin uses this column; harmless to keep
    // even though the museum only ships GitHub OAuth.
    password: text("password"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("account_userId_idx").on(table.userId)],
);

export const verification = auth.table(
  "verification",
  {
    id: text("id").primaryKey(),
    identifier: text("identifier").notNull(),
    value: text("value").notNull(),
    expiresAt: timestamp("expires_at").notNull(),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    updatedAt: timestamp("updated_at")
      .defaultNow()
      .$onUpdate(() => /* @__PURE__ */ new Date())
      .notNull(),
  },
  (table) => [index("verification_identifier_idx").on(table.identifier)],
);

/**
 * Personal Access Token table. Used by the patAuth plugin for Chrome MCP /
 * automated testing — POST a raw token to /api/auth/pat/session, get back
 * a session cookie. Tokens are stored hashed; the raw value is shown to the
 * user once at generation. See auth.md §PAT.
 */
export const personalAccessToken = auth.table(
  "personal_access_token",
  {
    id: text("id").primaryKey(),
    name: text("name").notNull(),
    tokenHash: text("token_hash").notNull().unique(),
    tokenPrefix: text("token_prefix").notNull(),
    userId: text("user_id")
      .notNull()
      .references(() => user.id, { onDelete: "cascade" }),
    expiresAt: timestamp("expires_at"),
    lastUsedAt: timestamp("last_used_at"),
    createdAt: timestamp("created_at").defaultNow().notNull(),
    revokedAt: timestamp("revoked_at"),
  },
  (table) => [index("pat_userId_idx").on(table.userId)],
);

/**
 * Better Auth's database-backed rate limit storage. Required for serverless —
 * see CONTEXT/internal_docs/rate-limiting.md §Layer-2.
 */
export const rateLimit = auth.table(
  "rate_limit",
  {
    id: text("id").primaryKey(),
    key: text("key"),
    count: text("count"), // Better Auth stores this as a string
    lastRequest: text("last_request"), // unix ms as string
  },
  (table) => [index("rate_limit_key_idx").on(table.key)],
);

/**
 * Identity-surface event log. Project-domain audit events (book.created,
 * score.submitted, etc.) live in each project's OWN pgSchema's audit table —
 * not here. This table is bounded to sign-in / session / security events.
 *
 * See CONTEXT/internal_docs/auth.md §Audit-Log for the helper + emission
 * conventions.
 */
export const userAuditLog = auth.table(
  "user_audit_log",
  {
    id: uuid("id").primaryKey().defaultRandom(),
    userId: text("user_id"),
    email: text("email"),
    eventType: text("event_type").notNull(),
    ipAddress: text("ip_address"),
    userAgent: text("user_agent"),
    provider: text("provider"),
    metadata: jsonb("metadata")
      .$type<Record<string, unknown>>()
      .notNull()
      .default(sql`'{}'::jsonb`),
    createdAt: timestamp("created_at", { withTimezone: true })
      .notNull()
      .defaultNow(),
  },
  (t) => [
    index("audit_event_type_created_idx").on(t.eventType, t.createdAt),
    index("audit_user_created_idx").on(t.userId, t.createdAt),
    index("audit_ip_created_idx").on(t.ipAddress, t.createdAt),
  ],
);
