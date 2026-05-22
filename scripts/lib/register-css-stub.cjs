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
  // Stub a CSS-modules object whose every key lookup returns the key
  // itself as a string — so `styles.foo` evaluates to "foo", which is
  // close enough to a real CSS-module class lookup for component code
  // to run headlessly in a tsx-driven script.
  //
  // CRITICAL: `__esModule` must explicitly return undefined. The
  // catch-all `get` trap would otherwise return the string "__esModule"
  // (truthy), making esbuild's `__toESM` interop helper take the
  // "already-ESM" branch — which trusts the source to have its own
  // `default` own-property. Our proxy has no own properties, so that
  // branch produces a namespace with no `default`, and the consumer's
  // `styles.default.foo` access crashes with "Cannot read properties
  // of undefined". Returning undefined here keeps `__toESM` on the
  // "CJS-shim" branch where it synthesizes `default = <proxy>`.
  module.exports = new Proxy(
    {},
    {
      get(_, prop) {
        if (prop === "__esModule") return undefined;
        return typeof prop === "string" ? prop : undefined;
      },
    },
  );
}

require.extensions[".css"] = cssLoader;
require.extensions[".module.css"] = cssLoader;
