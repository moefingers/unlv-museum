// Layer-1 theme bootstrap.
//
// Loaded synchronously from <script src="/theme-init.js"> in the root
// layout BEFORE any other resource. Browsers execute same-origin
// synchronous src-scripts in document order before paint, so the
// `dark` class and `data-theme` attribute land on <html> before
// styles compute. Eliminates the dark/light/preset FOUC.
//
// Reads museum-mode and museum-theme from localStorage. Migrates the
// older `museum-theme` key when it stored a mode value (the legacy
// inline themeScript stored "dark"/"light" under museum-theme; we've
// since split mode and theme-preset into separate keys to match
// zcanon's pattern). The migration block is safe to keep indefinitely
// — it's O(1) per load and converges to no-op once users have
// rehydrated their preference once.
//
// Why a static file + SRI instead of an inline <script
// dangerouslySetInnerHTML>: see the equivalent zcanon explanation in
// CONTEXT/internal_docs/theme.md "FOUC Prevention" — same reasoning,
// same React 19 warning, same next/script limitation.
//
// Integrity: <script integrity="sha384-..."> on the tag enforces
// that this file's content matches the hash baked into the layout
// at build time. SHA-384 SRI per the WHATWG spec.

(function () {
  try {
    var mk = "museum-mode";
    var tk = "museum-theme";
    // One-time migration: legacy museum-theme = "dark" | "light" was
    // really a mode value. Move it to museum-mode and clear the old
    // key. Real theme-preset values (anything else, e.g. "ocean")
    // stay under museum-theme.
    var legacy = localStorage.getItem(tk);
    if (legacy === "dark" || legacy === "light") {
      localStorage.setItem(mk, legacy);
      localStorage.removeItem(tk);
    }
    var mode = localStorage.getItem(mk);
    var dark =
      mode === "dark" ||
      (mode !== "light" &&
        window.matchMedia("(prefers-color-scheme: dark)").matches);
    if (dark) document.documentElement.classList.add("dark");
    var theme = localStorage.getItem(tk);
    if (theme) document.documentElement.setAttribute("data-theme", theme);
  } catch (e) {
    // localStorage blocked / SSR — accept default theme.
  }
})();
