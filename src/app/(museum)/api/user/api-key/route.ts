/**
 * /api/user/api-key — issue a fresh personal API key for the signed-in user.
 *
 *   POST /api/user/api-key
 *     → 200: { token: "museum_...", prefix: "museum_abc1234", usage_example: {...} }
 *     → 401 if no session
 *
 * Mirrors `scripts/generate-pat.ts` exactly — generates a 64-char hex
 * payload prefixed with "museum_", hashes it with SHA-256, stores the
 * hash + prefix in `auth.personal_access_token`, returns the raw token
 * ONCE. The raw token is unrecoverable after this response is sent.
 *
 * Old tokens stay valid until manually revoked. Re-calling this route
 * issues an additional token without invalidating prior ones.
 *
 * Surfaced in the UI via the SignInChip dropdown → ApiKeyModal: visitors
 * who sign in via GitHub OAuth can click their avatar and choose
 * "Request / refresh API key" to land here.
 */

import crypto from "node:crypto";
import { auth } from "@/lib/auth";
import { db } from "@/lib/db";
import { personalAccessToken } from "@/lib/schema/auth";
import { NextResponse } from "next/server";

export async function POST(request: Request) {
  const session = await auth.api.getSession({ headers: request.headers });
  if (!session) {
    return NextResponse.json(
      {
        error: "unauthorized",
        message:
          "Sign in with GitHub first; API keys are only issued to authenticated users.",
      },
      { status: 401 },
    );
  }

  // Mirror the CLI script's token shape so visitors can use the same
  // `museum_<hex>` form whether they got it from `pnpm pat:generate` or
  // this UI route.
  const raw = `museum_${crypto.randomBytes(32).toString("hex")}`;
  const tokenHash = crypto.createHash("sha256").update(raw).digest("hex");
  const prefix = raw.slice(0, 14);

  await db.insert(personalAccessToken).values({
    id: crypto.randomUUID(),
    name: `API key (UI-issued, ${new Date().toISOString().slice(0, 10)})`,
    tokenHash,
    tokenPrefix: prefix,
    userId: session.user.id,
    createdAt: new Date(),
  });

  return NextResponse.json({
    token: raw,
    prefix,
    issued_to: {
      login: session.user.name,
      id: session.user.id,
    },
    usage_example: {
      // The PAT exchange shape from auth.md §PAT — visitors trade the
      // raw token for a session cookie via this POST, then use the
      // cookie for subsequent calls.
      exchange: `await fetch("/api/auth/pat/session", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({ token: "${raw}" }),
})`,
      // Or: send the PAT as a Bearer token on every request if the
      // visitor's tool can't store cookies (some Postman setups).
      bearer: `curl -X POST https://unlv-museum.recanon.com/api/v2/music-tour/bands \\
  -H "Content-Type: application/json" \\
  -H "Authorization: Bearer ${raw}" \\
  -d '{ "name": "...", "genre": "...", "availableStartTime": "...", "endTime": "..." }'`,
    },
    warnings: [
      "This token is shown once. Store it somewhere safe (a password manager or .env file).",
      "Old tokens stay valid after this issuance — revoke them manually if you suspect compromise.",
    ],
  });
}
