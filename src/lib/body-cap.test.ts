import { test } from "node:test";
import assert from "node:assert/strict";
import { AUTH_BODY_LIMIT, withBodyCap } from "./body-cap";

const URL_ = "https://example.test/api/auth/sign-in/social";
const LIMIT = 64;

// A body delivered in chunks, with no Content-Length: what a client sending
// chunked transfer encoding looks like to the route.
function streamed(chunks: Uint8Array[]): ReadableStream<Uint8Array> {
  let i = 0;
  return new ReadableStream({
    pull(controller) {
      if (i < chunks.length) controller.enqueue(chunks[i++]!);
      else controller.close();
    },
  });
}

function post(
  body: BodyInit | null,
  headers: Record<string, string> = {},
): Request {
  return new Request(URL_, {
    method: "POST",
    headers,
    body,
    // Required by Node's fetch for a stream body.
    duplex: "half",
  } as RequestInit);
}

const bytes = (n: number) => new Uint8Array(n).fill(0x61);

test("the auth limit sits above the largest real body, far below Vercel's", () => {
  // A /sign-in/social whose callbackURL is a 14 KB page URL: about 29 KB.
  assert.ok(AUTH_BODY_LIMIT >= 64 * 1024);
  assert.ok(AUTH_BODY_LIMIT <= 512 * 1024);
});

/** A route's request as Next hands it over: a Proxy, with no Request brand. */
const asNextHandsIt = (request: Request) =>
  new Proxy(request, {
    get(target, key) {
      const value = Reflect.get(target, key, target);
      return typeof value === "function" ? value.bind(target) : value;
    },
  });

test("a request as Next hands it over (a Proxy) is rebuilt, not rejected", async () => {
  const json = JSON.stringify({ provider: "google", callbackURL: "/x" });
  const out = await withBodyCap(
    asNextHandsIt(post(json, { "content-type": "application/json" })),
    LIMIT,
  );
  assert.ok(out instanceof Request);
  assert.equal(await out.text(), json);
});

test("a body that fails mid-read is a 400, not a crash", async () => {
  let sent = false;
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      if (!sent) {
        sent = true;
        controller.enqueue(bytes(4));
      } else controller.error(new Error("connection reset"));
    },
  });
  const out = await withBodyCap(post(body), LIMIT);
  assert.equal((out as Response).status, 400);
});

test("413 and 400 answer in Better Auth's error shape", async () => {
  const out = (await withBodyCap(post(bytes(LIMIT + 1)), LIMIT)) as Response;
  assert.deepEqual(await out.json(), {
    code: "BODY_TOO_LARGE",
    message: "This request is too large.",
  });
});

test("a body under the limit passes, byte for byte", async () => {
  const json = JSON.stringify({ provider: "google", callbackURL: "/x" });
  const out = await withBodyCap(
    post(json, { "content-type": "application/json" }),
    LIMIT,
  );
  assert.ok(out instanceof Request);
  assert.equal(await out.text(), json);
  assert.equal(out.method, "POST");
  assert.equal(out.url, URL_);
  assert.equal(out.headers.get("content-type"), "application/json");
  assert.equal(out.headers.get("content-length"), String(json.length));
});

test("a body of exactly the limit passes", async () => {
  const out = await withBodyCap(post(bytes(LIMIT)), LIMIT);
  assert.ok(out instanceof Request);
  assert.equal((await out.arrayBuffer()).byteLength, LIMIT);
});

test("one byte over the limit is refused with 413", async () => {
  const out = await withBodyCap(post(bytes(LIMIT + 1)), LIMIT);
  assert.ok(out instanceof Response && !(out instanceof Request));
  assert.equal(out.status, 413);
});

test("a declared length over the limit is refused before reading", async () => {
  let pulled = 0;
  // highWaterMark 0: the stream pulls only when someone reads it.
  const body = new ReadableStream<Uint8Array>(
    {
      pull(controller) {
        pulled++;
        controller.enqueue(bytes(8));
      },
    },
    { highWaterMark: 0 },
  );
  const out = await withBodyCap(
    post(body, { "content-length": String(LIMIT * 100) }),
    LIMIT,
  );
  assert.equal((out as Response).status, 413);
  assert.equal(pulled, 0, "nothing was read");
});

test("a chunked body with no length is cut off once it passes the limit", async () => {
  let pulled = 0;
  // An endless body: the cap must stop reading, not wait for the end.
  const body = new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled++;
      controller.enqueue(bytes(16));
    },
  });
  const out = await withBodyCap(post(body), LIMIT);
  assert.equal((out as Response).status, 413);
  assert.ok(pulled <= LIMIT / 16 + 2, `read ${pulled} chunks`);
});

test("an understated Content-Length doesn't get a larger body through", async () => {
  const out = await withBodyCap(
    post(streamed([bytes(40), bytes(40)]), { "content-length": "10" }),
    LIMIT,
  );
  assert.equal((out as Response).status, 413);
});

test("a chunked body under the limit is reassembled in order", async () => {
  const enc = new TextEncoder();
  const out = await withBodyCap(
    post(streamed([enc.encode("ab"), enc.encode("cd"), enc.encode("ef")])),
    LIMIT,
  );
  assert.ok(out instanceof Request);
  assert.equal(await out.text(), "abcdef");
  assert.equal(out.headers.get("content-length"), "6");
  assert.equal(out.headers.get("transfer-encoding"), null);
});

test("a malformed Content-Length is refused", async () => {
  for (const bad of ["-1", "abc", "1e9"]) {
    const out = await withBodyCap(
      post(bytes(4), { "content-length": bad }),
      LIMIT,
    );
    assert.equal((out as Response).status, 413, bad);
  }
});

test("GET and an empty POST pass through untouched", async () => {
  const get = new Request(URL_ + "?x=1");
  assert.equal(await withBodyCap(get, LIMIT), get);
  const empty = new Request(URL_, { method: "POST" });
  assert.equal(await withBodyCap(empty, LIMIT), empty);
});
