import { test } from "node:test";
import assert from "node:assert/strict";
import { isTrustedCallbackUrl } from "./callback-validation";

const LOCAL = {} as NodeJS.ProcessEnv;
const LAPTOP = { VERCEL_ENV: "development" } as NodeJS.ProcessEnv;
const PREVIEW = { VERCEL_ENV: "preview" } as NodeJS.ProcessEnv;
const PRODUCTION = { VERCEL_ENV: "production" } as NodeJS.ProcessEnv;
const EVERYWHERE = [LOCAL, LAPTOP, PREVIEW, PRODUCTION];

test("trusts the production host over https, everywhere", () => {
  for (const env of EVERYWHERE) {
    assert.equal(
      isTrustedCallbackUrl("https://unlv-museum.recanon.com/auth/claim", env),
      true,
    );
  }
});

test("refuses the production host over plain http", () => {
  for (const env of EVERYWHERE) {
    assert.equal(
      isTrustedCallbackUrl("http://unlv-museum.recanon.com/auth/claim", env),
      false,
    );
  }
});

test("refuses shared hosting namespaces anyone can claim a host in", () => {
  for (const env of EVERYWHERE) {
    assert.equal(
      isTrustedCallbackUrl("https://evil.vercel.app/auth/claim", env),
      false,
    );
    assert.equal(
      isTrustedCallbackUrl("https://unlv-museum-git-x-team.vercel.app/", env),
      false,
    );
    assert.equal(isTrustedCallbackUrl("https://evil.vercel.dev/", env), false);
    assert.equal(isTrustedCallbackUrl("https://evil.vercel.sh/", env), false);
  }
});

test("refuses other recanon.com hosts and look-alikes", () => {
  for (const env of EVERYWHERE) {
    assert.equal(isTrustedCallbackUrl("https://www.recanon.com/", env), false);
    assert.equal(
      isTrustedCallbackUrl("https://x.unlv-museum.recanon.com/", env),
      false,
    );
    assert.equal(
      isTrustedCallbackUrl("https://unlv-museum.recanon.com.evil.com/", env),
      false,
    );
    assert.equal(
      isTrustedCallbackUrl("https://unlv-museum.recanon.com@evil.com/", env),
      false,
    );
    assert.equal(
      isTrustedCallbackUrl("https://u:p@unlv-museum.recanon.com/", env),
      false,
    );
  }
});

test("trusts this machine and the private network only in local development", () => {
  for (const env of [LOCAL, LAPTOP]) {
    assert.equal(
      isTrustedCallbackUrl("http://localhost:3000/auth/claim", env),
      true,
    );
    assert.equal(isTrustedCallbackUrl("http://127.0.0.1:3000/", env), true);
    assert.equal(isTrustedCallbackUrl("http://192.168.1.20:3000/", env), true);
    assert.equal(isTrustedCallbackUrl("http://10.0.0.5/", env), true);
    assert.equal(isTrustedCallbackUrl("http://172.16.0.1/", env), true);
    assert.equal(isTrustedCallbackUrl("http://172.32.0.1/", env), false);
    assert.equal(isTrustedCallbackUrl("http://10.evil.com/", env), false);
  }
});

test("refuses this machine and the private network on any deployment", () => {
  for (const env of [PREVIEW, PRODUCTION]) {
    assert.equal(
      isTrustedCallbackUrl("http://localhost:3000/auth/claim", env),
      false,
    );
    assert.equal(isTrustedCallbackUrl("https://localhost/", env), false);
    assert.equal(isTrustedCallbackUrl("http://127.0.0.1:3000/", env), false);
    assert.equal(isTrustedCallbackUrl("http://192.168.1.20/", env), false);
    assert.equal(isTrustedCallbackUrl("http://10.0.0.5/", env), false);
  }
});

test("refuses other schemes and junk", () => {
  for (const env of EVERYWHERE) {
    assert.equal(isTrustedCallbackUrl("javascript:alert(1)", env), false);
    assert.equal(
      isTrustedCallbackUrl("ftp://unlv-museum.recanon.com/", env),
      false,
    );
    assert.equal(isTrustedCallbackUrl("not a url", env), false);
    assert.equal(isTrustedCallbackUrl("", env), false);
  }
});
