# Originals

## Philosophy

Originals are time capsules. Fix only what's broken. Don't modernize, refactor, or improve. The code quality IS the point — it shows where the developer was at that time.

## Hosting

All originals are self-hosted in `public/originals/`. Served via iframes using the `OriginalFrame` component. The iframe has `sandbox="allow-scripts allow-same-origin allow-popups"` and `bg-white` to prevent dark mode bleed.

## Common fixes applied

| Fix                                                | Reason                                                                           |
| -------------------------------------------------- | -------------------------------------------------------------------------------- |
| `import assert` → `import with`                    | Browser spec changed from `assert` to `with` for JSON imports                    |
| `BrowserRouter` → `HashRouter`                     | BrowserRouter can't match routes inside an iframe at `/originals/*/index.html`   |
| `PUBLIC_URL=.` rebuild                             | CRA apps had hardcoded absolute paths from their `homepage` field                |
| Geolocation fallback                               | `navigator.geolocation` blocked by iframe sandbox — fallback to UNLV coordinates |
| Expired image URLs                                 | GitHub raw URLs with tokens replaced with local copies                           |
| `localhost:5000/css/style.css` → `./css/style.css` | Backend-served CSS replaced with local copy                                      |

## Backend-dependent originals

These originals had backend servers that can't be replicated statically:

| Project            | Backend               | What works        | What doesn't         |
| ------------------ | --------------------- | ----------------- | -------------------- |
| rest-rant          | Express + MongoDB     | UI shell, routing | Place data, reviews  |
| commerce-array     | Express + PostgreSQL  | UI shell, nav     | Product data, cart   |
| admin-portal       | Express + json-server | Page structure    | Book CRUD            |
| sql-injection-demo | Express + SQLite      | Login form        | Actual SQL injection |

For these, the remastered and reimagined tiers are where the full experience lives.

## Non-web originals

| Project             | Approach                                                             |
| ------------------- | -------------------------------------------------------------------- |
| Python fundamentals | Pyodide WebAssembly — actual Python execution in browser             |
| PetFax (Flask)      | Jinja templates pre-rendered as static HTML with local images        |
| Music Tour API      | ApiExplorer component (mini-Postman) with real Neon-backed endpoints |
| JASKIS API          | ApiExplorer component with real Neon-backed endpoints                |
