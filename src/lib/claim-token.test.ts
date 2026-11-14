import { test, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import { generateClaimToken, verifyClaimToken } from "./claim-token";

let saved: string | undefined;
beforeEach(() => {
  saved = process.env.BETTER_AUTH_SECRET;
});
afterEach(() => {
  if (saved === undefined) delete process.env.BETTER_AUTH_SECRET;
  else process.env.BETTER_AUTH_SECRET = saved;
});

test("a claim made with the secret verifies, carrying its user", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
  const token = generateClaimToken("user-1", "a@example.com");
  assert.ok(token);
  const payload = verifyClaimToken(token);
  assert.equal(payload?.userId, "user-1");
  assert.equal(payload?.email, "a@example.com");
});

test("without a secret, no claim is issued or accepted", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
  const token = generateClaimToken("user-1", "a@example.com");
  delete process.env.BETTER_AUTH_SECRET;
  assert.equal(generateClaimToken("user-1", "a@example.com"), null);
  assert.equal(verifyClaimToken(token), null);
  process.env.BETTER_AUTH_SECRET = "";
  assert.equal(generateClaimToken("user-1", "a@example.com"), null);
  assert.equal(verifyClaimToken(token), null);
});

test("a claim signed with the old fixed fallback does not verify", () => {
  process.env.BETTER_AUTH_SECRET = "dev-secret";
  const forged = generateClaimToken("admin", "x@example.com");
  process.env.BETTER_AUTH_SECRET = "the-real-secret";
  assert.equal(verifyClaimToken(forged), null);
});

test("a signature of another length is refused, not thrown", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
  const token = generateClaimToken("user-1", "a@example.com")!;
  const [data] = token.split(".");
  assert.doesNotThrow(() => verifyClaimToken(`${data}.short`));
  assert.equal(verifyClaimToken(`${data}.short`), null);
  assert.equal(verifyClaimToken(`${data}.`), null);
});

test("junk and non-strings are refused", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
  for (const bad of ["", "a", "a.b.c", undefined, null, 42, {}]) {
    assert.equal(verifyClaimToken(bad), null);
  }
});

test("an expired claim is refused", () => {
  process.env.BETTER_AUTH_SECRET = "test-secret-one";
  const realNow = Date.now;
  try {
    Date.now = () => realNow() - 120_000;
    const old = generateClaimToken("user-1", "a@example.com")!;
    Date.now = realNow;
    assert.equal(verifyClaimToken(old), null);
  } finally {
    Date.now = realNow;
  }
});
