import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrustedCallbackUrl } from "./callback-validation";

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

const PRIVATE = [
  "http://localhost:3000/x",
  "https://localhost/",
  "http://127.0.0.1:3000/",
  "http://192.168.1.20:3000/",
  "http://10.0.0.5/",
  "http://172.16.0.1/",
  "http://172.31.255.254/",
];

test("redirect: private network only in local development", () => {
  for (const e of LOCAL) {
    for (const url of PRIVATE) {
      assert.equal(isTrustedCallbackUrl(url, e), true, url);
    }
    // Just outside 172.16/12, and a public name that starts like 10.x.
    assert.equal(isTrustedCallbackUrl("http://172.15.0.1/", e), false);
    assert.equal(isTrustedCallbackUrl("http://172.32.0.1/", e), false);
    assert.equal(isTrustedCallbackUrl("http://10.evil.com/", e), false);
  }
  for (const e of BUILDS) {
    for (const url of PRIVATE) {
      assert.equal(isTrustedCallbackUrl(url, e), false, url);
    }
  }
});
