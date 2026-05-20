/**
 * CJS preload that stubs `.css` and `.module.css` imports so tsx-driven
 * scripts can import the React-component graph from projects.tsx without
 * crashing on CSS module imports.
 *
 * Use via `node -r ./scripts/lib/register-css-stub.cjs --import tsx <script>`.
 *
 * tsx's CJS interop ultimately falls through to Node's require() chain, so
 * registering a `.css` extension hook here lets `require("foo.module.css")`
 * resolve to an empty proxy. CSS modules normally expose a className lookup
 * — the proxy returns the key as a string so `styles.foo` evaluates to
 * "foo" rather than crashing.
 */
const Module = require("node:module");

function cssLoader(module) {
  module.exports = new Proxy(
    {},
    {
      get(_, prop) {
        return typeof prop === "string" ? prop : undefined;
      },
    },
  );
}

require.extensions[".css"] = cssLoader;
require.extensions[".module.css"] = cssLoader;
