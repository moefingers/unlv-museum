import { test } from "node:test";
import assert from "node:assert/strict";
import {
  isTrustedCallbackUrl,
  isTrustedRelayCallback,
} from "./callback-validation";

const env = (e: Record<string, string>) => e as NodeJS.ProcessEnv;
const DEV = env({ NODE_ENV: "development" });
const LAPTOP = env({ NODE_ENV: "development", VERCEL_ENV: "development" });
const PREVIEW = env({ NODE_ENV: "production", VERCEL_ENV: "preview" });
const PRODUCTION = env({ NODE_ENV: "production", VERCEL_ENV: "production" });
// A production build with VERCEL_ENV missing (system variables off, a
// self-hosted `next start`) or a copied value: NODE_ENV alone keeps it shut.
const PROD_NO_VERCEL_ENV = env({ NODE_ENV: "production" });
const PROD_COPIED_VERCEL_ENV = env({
  NODE_ENV: "production",
  VERCEL_ENV: "development",
});
const LOCAL = [DEV, LAPTOP];
const BUILDS = [
  PREVIEW,
  PRODUCTION,
  PROD_NO_VERCEL_ENV,
  PROD_COPIED_VERCEL_ENV,
];
const EVERYWHERE = [...LOCAL, ...BUILDS];

// ── where a browser may go after sign-in (/auth/redirect) ──

test("redirect: trusts the production host over https, everywhere", () => {
  for (const e of EVERYWHERE) {
    assert.equal(
      isTrustedCallbackUrl("https://unlv-museum.recanon.com/api-client", e),
      true,
    );
  }
});

test("redirect: refuses plain http, other hosts and look-alikes", () => {
  for (const e of EVERYWHERE) {
    for (const bad of [
      "http://unlv-museum.recanon.com/",
      "https://www.recanon.com/",
      "https://x.unlv-museum.recanon.com/",
      "https://unlv-museum.recanon.com.evil.com/",
      "https://unlv-museum.recanon.com@evil.com/",
      "https://u:p@unlv-museum.recanon.com/",
      "https://evil.vercel.app/",
      "https://unlv-museum-git-x-team.vercel.app/",
      "https://evil.vercel.dev/",
      "https://evil.vercel.sh/",
      "javascript:alert(1)",
      "ftp://unlv-museum.recanon.com/",
      "not a url",
      "",
    ]) {
      assert.equal(isTrustedCallbackUrl(bad, e), false, bad);
    }
  }
});

test("redirect: private network only in local development", () => {
  for (const e of LOCAL) {
    assert.equal(isTrustedCallbackUrl("http://localhost:3000/x", e), true);
    assert.equal(isTrustedCallbackUrl("http://192.168.1.20:3000/", e), true);
    assert.equal(isTrustedCallbackUrl("http://172.32.0.1/", e), false);
    assert.equal(isTrustedCallbackUrl("http://10.evil.com/", e), false);
  }
  for (const e of BUILDS) {
    assert.equal(isTrustedCallbackUrl("http://localhost:3000/x", e), false);
    assert.equal(isTrustedCallbackUrl("http://127.0.0.1:3000/", e), false);
    assert.equal(isTrustedCallbackUrl("http://192.168.1.20/", e), false);
    assert.equal(isTrustedCallbackUrl("http://10.0.0.5/", e), false);
  }
});

// ── where a claim may be delivered (/auth/relay, /auth/relay/complete) ──

test("relay: delivers to a local dev server's /auth/claim, exactly", () => {
  for (const e of LOCAL) {
    assert.equal(
      isTrustedRelayCallback("http://localhost:3000/auth/claim", e),
      true,
    );
    assert.equal(
      isTrustedRelayCallback("http://192.168.1.20:3000/auth/claim", e),
      true,
    );
  }
});

test("relay: refuses any other path, any query or hash", () => {
  for (const e of LOCAL) {
    for (const bad of [
      "http://localhost:3000/",
      "http://localhost:3000/auth/claim/",
      "http://localhost:3000/auth/claimx",
      "http://localhost:3000/auth/claim?callbackURL=javascript:alert(1)",
      "http://localhost:3000/auth/claim?x=1",
      "http://localhost:3000/auth/claim#x",
    ]) {
      assert.equal(isTrustedRelayCallback(bad, e), false, bad);
    }
  }
});

test("relay: never delivers to the production host or anything public", () => {
  for (const e of EVERYWHERE) {
    for (const bad of [
      "https://unlv-museum.recanon.com/auth/claim",
      "https://unlv-museum.recanon.com/auth/claim?callbackURL=javascript:alert(1)",
      "https://www.recanon.com/auth/claim",
      "https://evil.vercel.app/auth/claim",
      "javascript:alert(1)",
      "",
    ]) {
      assert.equal(isTrustedRelayCallback(bad, e), false, bad);
    }
  }
});

test("relay: a production build delivers no claim at all", () => {
  for (const e of BUILDS) {
    for (const url of [
      "http://localhost:3000/auth/claim",
      "http://127.0.0.1:3000/auth/claim",
      "http://192.168.1.20:3000/auth/claim",
    ]) {
      assert.equal(isTrustedRelayCallback(url, e), false, url);
    }
  }
});
