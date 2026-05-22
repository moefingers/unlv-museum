/**
 * Entry-point shim: registers the ESM CSS-stub loader. Use via
 * `node --import ./scripts/lib/css-stub-register.mjs ...`.
 *
 * Separate from the loader file because `register()` itself can't be
 * called from inside a loader; it has to run in the main thread before
 * tsx's loader chain takes over.
 */
import { register } from "node:module";

register("./css-stub-loader.mjs", import.meta.url);
