// The cap in front of real Better Auth (an in-memory instance with a github
// provider), the request wrapped the way Next hands a route its request. The
// unit tests can't show that what the cap rebuilds is a request Better Auth
// can read; OutlastSite's first version passed its unit tests and failed every
// POST on a deployment (OUT-1513).
import { test } from "node:test";
import assert from "node:assert/strict";
import { betterAuth } from "better-auth";
import { memoryAdapter } from "better-auth/adapters/memory";
import { AUTH_BODY_LIMIT, withBodyCap } from "./body-cap";

const BASE = "http://localhost:3000";
const auth = betterAuth({
  secret: "a-test-secret-of-more-than-32-characters",
  baseURL: BASE,
  database: memoryAdapter({
    user: [],
    session: [],
    account: [],
    verification: [],
  }),
  socialProviders: {
    github: { clientId: "test-client", clientSecret: "test-secret" },
  },
  logger: { disabled: true },
});

const asNextHandsIt = (request: Request) =>
  new Proxy(request, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

let reached = 0;
async function route(request: Request): Promise<Response> {
  const capped = await withBodyCap(request, AUTH_BODY_LIMIT);
  if (!(capped instanceof Request)) return capped;
  reached += 1;
  return auth.handler(capped);
}

const signIn = (body: string) =>
  route(
    asNextHandsIt(
      new Request(BASE + "/api/auth/sign-in/social", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body,
      }),
    ),
  );

test("a real sign-in gets its provider's address back", async () => {
  const res = await signIn(
    JSON.stringify({ provider: "github", callbackURL: "/x" }),
  );
  assert.equal(res.status, 200);
  const { url, redirect } = (await res.json()) as {
    url: string;
    redirect: boolean;
  };
  assert.equal(new URL(url).hostname, "github.com");
  assert.equal(redirect, true);
});

test("a sign-in with the longest callback a page URL allows still works", async () => {
  const callbackURL = "/x?q=" + "a".repeat(14 * 1024);
  const res = await signIn(JSON.stringify({ provider: "github", callbackURL }));
  assert.notEqual(res.status, 413);
});

test("the body reaches Better Auth's own validator: a bad one is its 400", async () => {
  const before = reached;
  const res = await signIn(
    JSON.stringify({ provider: "github", scopes: [1, 2, 3] }),
  );
  assert.equal(reached, before + 1);
  assert.equal(res.status, 400);
});

test("a scopes array over the limit is refused before Better Auth reads it", async () => {
  const before = reached;
  const scopes = Array.from({ length: 60_000 }, () => 12345);
  const body = JSON.stringify({ provider: "github", scopes });
  assert.ok(body.length > AUTH_BODY_LIMIT);
  const res = await signIn(body);
  assert.equal(res.status, 413);
  assert.equal(reached, before, "Better Auth never ran");
});
