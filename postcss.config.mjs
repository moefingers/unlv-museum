/**
 * PostCSS configuration for the museum.
 *
 * THE MUSEUM DOES NOT USE TAILWIND. Styling is CSS modules + design
 * tokens (see `src/app/globals.css`). Tailwind is registered here ONLY
 * to keep one ported sub-tree's view layer rendering verbatim:
 *
 *   src/app/(museum)/quirk-truck-enhanced/ui/global.css
 *
 * That file (and only that file) contains `@import "tailwindcss"`,
 * which scopes Tailwind v4's utility emission to its stylesheet. The
 * rest of the museum is untouched by Tailwind because it never
 * imports the directive.
 *
 * Don't introduce `className="bg-blue-500 ..."` patterns in museum-
 * side code. Use CSS modules.
 */
export default {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};
