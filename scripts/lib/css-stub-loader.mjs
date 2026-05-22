/**
 * Node ESM loader hook that stubs `.css` and `.module.css` imports for
 * tsx-driven scripts that import the React-component graph from
 * projects.tsx.
 *
 * The companion CJS hook (register-css-stub.cjs) only catches
 * `require(".../*.module.css")` chains. tsx loads `.tsx` files as ESM,
 * so their `import styles from "./Foo.module.css"` bypasses the CJS
 * hook entirely — `styles` resolves to `undefined` and the script
 * crashes the moment a component reads `styles.something`.
 *
 * This loader intercepts ESM resolution of any `.css` URL and rewrites
 * it to a data: URL whose default export is a Proxy returning the
 * accessed key as a string (so `styles.foo` → "foo"). That matches what
 * a real CSS-module loader would produce in the type domain (object of
 * string lookups) and is enough for component code to execute headlessly.
 *
 * Registered via:
 *   node --import ./scripts/lib/css-stub-register.mjs \
 *        -r ./scripts/lib/register-css-stub.cjs --import tsx <script>
 */
export async function resolve(specifier, context, nextResolve) {
  if (specifier.endsWith(".css")) {
    const stub =
      "export default new Proxy({}, { get: (_, p) => typeof p === 'string' ? p : undefined });";
    return {
      shortCircuit: true,
      url: `data:text/javascript,${encodeURIComponent(stub)}`,
      format: "module",
    };
  }
  return nextResolve(specifier, context);
}
