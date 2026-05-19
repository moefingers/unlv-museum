/**
 * Generate a Personal Access Token for a museum user.
 *
 *   pnpm pat:generate                              # for default email
 *   pnpm pat:generate --email someone@example.com  # for another user
 *   pnpm pat:generate --var MUSEUM_PAT             # write to a custom env var
 *
 * Inserts a hashed PAT row into auth.personal_access_token, prints the raw
 * token once (it cannot be recovered later), and writes it to .env.local
 * under PAT_TOKEN (or --var name). Idempotent — re-running generates a new
 * token; old tokens stay valid until revoked.
 *
 * See CONTEXT/internal_docs/auth.md §PAT.
 */

import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { readFileSync, writeFileSync } from "fs";
import { resolve } from "path";
import * as schema from "../src/lib/schema/auth";

const sql = neon(process.env.DATABASE_URL!);
const db = drizzle(sql, { schema });

const args = process.argv.slice(2);
function getFlag(name: string, fallback: string): string {
  const idx = args.indexOf(`--${name}`);
  return idx !== -1 && args[idx + 1] ? args[idx + 1]! : fallback;
}

const EMAIL = getFlag(
  "email",
  process.env.PAT_USER_EMAIL || "mbzuiter@gmail.com",
);
const PREFIX = "museum";
const envFile = resolve(getFlag("env", ".env.local"));
const varName = getFlag("var", "PAT_TOKEN");
const afterVar = getFlag("after", "BETTER_AUTH_URL");

function writeToEnv(value: string) {
  let content: string;
  try {
    content = readFileSync(envFile, "utf-8");
  } catch {
    content = "";
  }
  const regex = new RegExp(`^${varName}=.*$`, "m");
  const line = `${varName}="${value}"`;

  if (regex.test(content)) {
    content = content.replace(regex, line);
    console.log(`Updated ${varName} in ${envFile}`);
  } else if (afterVar) {
    const afterRegex = new RegExp(`^${afterVar}=.*$`, "m");
    const match = afterRegex.exec(content);
    if (match) {
      const insertAt = match.index + match[0].length;
      content =
        content.slice(0, insertAt) +
        "\n\n# Personal Access Token (dev / Chrome MCP)\n" +
        line +
        content.slice(insertAt);
      console.log(`Inserted ${varName} after ${afterVar} in ${envFile}`);
    } else {
      content =
        content.trimEnd() +
        "\n\n# Personal Access Token (dev / Chrome MCP)\n" +
        line +
        "\n";
      console.log(`${afterVar} not found; appended ${varName} to ${envFile}`);
    }
  } else {
    content =
      content.trimEnd() +
      "\n\n# Personal Access Token (dev / Chrome MCP)\n" +
      line +
      "\n";
    console.log(`Appended ${varName} to ${envFile}`);
  }
  writeFileSync(envFile, content, "utf-8");
}

async function generate() {
  const users = await db
    .select({ id: schema.user.id, email: schema.user.email })
    .from(schema.user)
    .where(eq(schema.user.email, EMAIL))
    .limit(1);

  if (users.length === 0) {
    console.error(
      `User ${EMAIL} not found. Sign in via GitHub at least once first.`,
    );
    process.exit(1);
  }

  const user = users[0]!;
  const raw = `${PREFIX}_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");

  await db.insert(schema.personalAccessToken).values({
    id: crypto.randomUUID(),
    name: "Dev / Chrome MCP",
    tokenHash,
    tokenPrefix: raw.slice(0, 14),
    userId: user.id,
    createdAt: new Date(),
  });

  writeToEnv(raw);

  console.log(`\nPAT generated for ${user.email}`);
  console.log(`Token: ${raw}`);
  console.log(`\nUsage (Chrome MCP / fetch):`);
  console.log(`  fetch("/api/auth/pat/session", {`);
  console.log(`    method: "POST",`);
  console.log(`    headers: { "Content-Type": "application/json" },`);
  console.log(`    body: JSON.stringify({ token: "${raw.slice(0, 20)}..." }),`);
  console.log(`  })`);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
