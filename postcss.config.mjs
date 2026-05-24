/**
 * PostCSS configuration for the museum.
 *
 * Tailwind v4 was introduced specifically for the EnterPrize Historical
 * Enhanced port (src/app/(museum)/quirk-truck-enhanced/), which inherits
 * a Tailwind-styled view layer from the 2024 era source. Other museum
 * routes don't currently use Tailwind — and they don't need to opt out
 * either, because Tailwind v4 only emits utility CSS into stylesheets
 * that contain the `@import "tailwindcss"` directive. The museum's
 * `src/app/globals.css` doesn't, so it's unaffected.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
