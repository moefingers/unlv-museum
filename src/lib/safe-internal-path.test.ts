import { test } from "node:test";
import assert from "node:assert/strict";
import { safeInternalPath } from "./safe-internal-path";

const ORIGIN = "https://unlv-museum.recanon.com";

test("accepts a same-origin path, keeping its query and hash", () => {
  assert.equal(safeInternalPath("/", ORIGIN), "/");
  assert.equal(safeInternalPath("/api-client", ORIGIN), "/api-client");
  assert.equal(
    safeInternalPath("/projects/x?tab=2#top", ORIGIN),
    "/projects/x?tab=2#top",
  );
});

test("refuses scripts and other schemes", () => {
  for (const bad of [
    "javascript:alert(1)",
    "JavaScript:alert(1)",
    " javascript:alert(1)",
    "data:text/html,<script>1</script>",
    "vbscript:x",
  ]) {
    assert.equal(safeInternalPath(bad, ORIGIN), null, bad);
  }
});

test("refuses other origins, however they're written", () => {
  for (const bad of [
    "https://evil.example/",
    "http://unlv-museum.recanon.com/",
    "//evil.example/x",
    "/\\evil.example",
    "\\\\evil.example",
    "https://unlv-museum.recanon.com.evil.example/",
  ]) {
    assert.equal(safeInternalPath(bad, ORIGIN), null, bad);
  }
});

test("refuses nothing-at-all", () => {
  assert.equal(safeInternalPath(null, ORIGIN), null);
  assert.equal(safeInternalPath(undefined, ORIGIN), null);
  assert.equal(safeInternalPath("", ORIGIN), null);
  assert.equal(safeInternalPath("relative/path", ORIGIN), null);
});
