/**
 * /api/v2/sql-demo — Enhanced tier.
 *
 *   GET  /api/v2/sql-demo/          → modernized HTML form (this file)
 *   POST /api/v2/sql-demo/          → re-export of v1's JSON injection lab
 *
 * The POST handler is the same as v1; tier="enhanced" gets stamped on
 * the audit row automatically because the guard's `tierFromUrl` sees
 * `/api/v2/`. The pedagogy is unchanged — string-interpolated WHERE
 * clauses are still exploitable, the locked-down `sql_demo_runner`
 * role still scopes blast radius, every attempt is still audited.
 *
 * The GET serves a freshly-authored HTML form (NOT the original
 * museum-ready/original index.html that v1's GET inlines via <base>
 * injection). Self-contained — inline <style>, no external assets,
 * no framework — so the Enhanced form renders cleanly inside the
 * iframe on the project page without depending on any sibling
 * resource. The form posts to /api/v2/sql-demo/login-html so the
 * audit-log row records tier="enhanced".
 *
 * Era-impossible additions over the Original form:
 *   - Mode toggle (vulnerable | safe) so visitors can see the same
 *     payload run through both queries without leaving the form.
 *   - Quick-payload buttons that pre-fill known injection strings
 *     (legitimate, classic OR-1=1, UNION→auth.user, UNION→audit_log).
 *   - Audit-aware framing: a visible note that every attempt is
 *     recorded, with a direct link to the audit log endpoint.
 *
 * The original res.redirect("/index.html#unauthorized") protocol is
 * preserved — the form-submit handler still redirects to
 * `${prefix}#unauthorized` or `${prefix}#error` on failure (the
 * `hashRedirectBase` helper in login-html/route.ts derives the
 * prefix per-request, so a v2 form-submit lands back at v2).
 */

export { POST } from "../../sql-demo/route";

const FORM_HTML = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>SQL Injection Demo — Enhanced</title>
  <style>
    :root {
      color-scheme: light dark;
      --bg: #fafafa;
      --surface: #ffffff;
      --surface-2: #f4f4f5;
      --border: #e4e4e7;
      --text: #18181b;
      --text-muted: #71717a;
      --accent: #4f46e5;
      --accent-hover: #4338ca;
      --danger: #dc2626;
      --warning: #b45309;
      --success: #047857;
      --mono: ui-monospace, "JetBrains Mono", SFMono-Regular, Menlo, monospace;
      --sans: ui-sans-serif, system-ui, -apple-system, "Segoe UI", Roboto, sans-serif;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        --bg: #09090b;
        --surface: #18181b;
        --surface-2: #27272a;
        --border: #3f3f46;
        --text: #fafafa;
        --text-muted: #a1a1aa;
        --accent: #818cf8;
        --accent-hover: #6366f1;
      }
    }
    * { box-sizing: border-box; }
    html, body { margin: 0; }
    body {
      background: var(--bg);
      color: var(--text);
      font-family: var(--sans);
      font-size: 15px;
      line-height: 1.5;
      padding: 2rem 1.25rem 3rem;
      display: flex;
      justify-content: center;
    }
    .wrap {
      width: 100%;
      max-width: 36rem;
    }
    h1 {
      font-size: 1.5rem;
      font-weight: 600;
      margin: 0 0 0.25rem;
      letter-spacing: -0.01em;
    }
    .tagline {
      color: var(--text-muted);
      margin: 0 0 1.75rem;
      font-size: 0.9rem;
    }
    .card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 1.5rem;
      box-shadow: 0 1px 2px rgba(0,0,0,0.04);
    }
    label {
      display: block;
      font-size: 0.825rem;
      font-weight: 500;
      margin-bottom: 0.375rem;
      color: var(--text-muted);
    }
    input[type="text"], input[type="password"] {
      width: 100%;
      padding: 0.625rem 0.75rem;
      font-family: var(--mono);
      font-size: 0.9rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      color: var(--text);
      transition: border-color 0.12s, box-shadow 0.12s;
    }
    input[type="text"]:focus, input[type="password"]:focus {
      outline: none;
      border-color: var(--accent);
      box-shadow: 0 0 0 3px rgba(79, 70, 229, 0.18);
    }
    .field + .field { margin-top: 1rem; }
    .modeRow {
      display: flex;
      gap: 0.5rem;
      margin-top: 1.25rem;
      padding: 0.25rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 9px;
    }
    .modeRow label {
      flex: 1;
      margin: 0;
      cursor: pointer;
      padding: 0.5rem 0.75rem;
      text-align: center;
      border-radius: 6px;
      font-size: 0.825rem;
      font-weight: 500;
      color: var(--text-muted);
      transition: background 0.12s, color 0.12s;
    }
    .modeRow input[type="radio"] {
      position: absolute;
      opacity: 0;
      pointer-events: none;
    }
    .modeRow input[type="radio"]:checked + span {
      display: block;
    }
    .modeRow label:has(input:checked) {
      background: var(--surface);
      color: var(--text);
      box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    }
    .submit {
      width: 100%;
      margin-top: 1.5rem;
      padding: 0.7rem 1rem;
      background: var(--accent);
      color: white;
      font-family: var(--sans);
      font-weight: 500;
      font-size: 0.925rem;
      border: none;
      border-radius: 8px;
      cursor: pointer;
      transition: background 0.12s;
    }
    .submit:hover { background: var(--accent-hover); }
    .presets {
      margin-top: 1.5rem;
    }
    .presets h3 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: var(--text-muted);
      margin: 0 0 0.625rem;
      font-weight: 600;
    }
    .presetGrid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.5rem;
    }
    .preset {
      text-align: left;
      padding: 0.625rem 0.75rem;
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 8px;
      font-family: var(--mono);
      font-size: 0.8rem;
      color: var(--text);
      cursor: pointer;
      transition: background 0.12s, border-color 0.12s;
      line-height: 1.35;
    }
    .preset:hover {
      background: var(--surface);
      border-color: var(--accent);
    }
    .preset .presetLabel {
      display: block;
      font-family: var(--sans);
      font-size: 0.78rem;
      color: var(--text-muted);
      margin-bottom: 0.25rem;
    }
    .banner {
      margin-bottom: 1.25rem;
      padding: 0.75rem 1rem;
      border-radius: 8px;
      font-size: 0.875rem;
      display: none;
    }
    .banner.show { display: block; }
    .banner.unauthorized {
      background: rgba(220, 38, 38, 0.08);
      border: 1px solid rgba(220, 38, 38, 0.3);
      color: var(--danger);
    }
    .banner.error {
      background: rgba(180, 83, 9, 0.08);
      border: 1px solid rgba(180, 83, 9, 0.3);
      color: var(--warning);
    }
    .footnote {
      margin-top: 1.5rem;
      padding: 1rem 1.125rem;
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 10px;
      font-size: 0.8rem;
      color: var(--text-muted);
      line-height: 1.55;
    }
    .footnote strong { color: var(--text); font-weight: 600; }
    .footnote a {
      color: var(--accent);
      text-decoration: none;
      font-family: var(--mono);
      font-size: 0.78rem;
    }
    .footnote a:hover { text-decoration: underline; }
    code {
      font-family: var(--mono);
      font-size: 0.825em;
      background: var(--surface-2);
      padding: 0.075em 0.3em;
      border-radius: 4px;
    }
  </style>
</head>
<body>
  <div class="wrap">
    <h1>SQL Injection Demo</h1>
    <p class="tagline">Same vulnerability surface as the Original — modernized form, mode toggle, every attempt audited.</p>

    <div id="banner-unauthorized" class="banner unauthorized">Invalid username or password.</div>
    <div id="banner-error" class="banner error">An error occurred running the query — usually means the locked-down database role refused the injection's target.</div>

    <form class="card" action="/api/v2/sql-demo/login-html" method="post">
      <div class="field">
        <label for="username">Username</label>
        <input type="text" id="username" name="username" required autocomplete="off" spellcheck="false">
      </div>
      <div class="field">
        <label for="password">Password</label>
        <input type="password" id="password" name="password" required autocomplete="off">
      </div>

      <div class="modeRow" role="radiogroup" aria-label="Query mode">
        <label><input type="radio" name="mode" value="vulnerable" checked>vulnerable (string-interpolated)</label>
        <label><input type="radio" name="mode" value="safe">safe (parameterized)</label>
      </div>

      <button type="submit" class="submit">Sign in</button>

      <div class="presets">
        <h3>Try a payload</h3>
        <div class="presetGrid">
          <button type="button" class="preset" data-u="admin" data-p="s3cur3P@ss">
            <span class="presetLabel">Legitimate login</span>
            admin / s3cur3P@ss
          </button>
          <button type="button" class="preset" data-u="' OR '1'='1' --" data-p="anything">
            <span class="presetLabel">Classic injection — bypasses the WHERE clause</span>
            ' OR '1'='1' --
          </button>
          <button type="button" class="preset" data-u="x' UNION SELECT id,email,role FROM auth.&quot;user&quot; --" data-p="y">
            <span class="presetLabel">UNION → auth.user (blocked by role lockdown)</span>
            x' UNION SELECT … FROM auth.user --
          </button>
          <button type="button" class="preset" data-u="x' UNION SELECT 1,2,3 FROM sql_demo.audit_log --" data-p="y">
            <span class="presetLabel">UNION → audit_log itself (blocked too)</span>
            x' UNION SELECT … FROM sql_demo.audit_log --
          </button>
        </div>
      </div>
    </form>

    <div class="footnote">
      <strong>You are being audited.</strong> Every signed-in attempt — successful or not — lands a row in <code>sql_demo.audit_log</code> with your GitHub identity, the payload you sent, the chosen mode, and the outcome. Browse the trail: <a href="/api/v2/sql-demo/audit-log">/api/v2/sql-demo/audit-log</a>.
    </div>
  </div>

  <script>
    // Hash-based banners — same protocol the Original used so the
    // form-submit failure redirects keep working.
    (() => {
      const hash = location.hash;
      if (hash === '#unauthorized') document.getElementById('banner-unauthorized').classList.add('show');
      else if (hash === '#error') document.getElementById('banner-error').classList.add('show');
    })();

    // Preset-button click → fill the inputs (visitor still hits Submit
    // themselves — preserves the "you're choosing to inject" agency).
    document.querySelectorAll('.preset').forEach(btn => {
      btn.addEventListener('click', () => {
        document.getElementById('username').value = btn.dataset.u;
        document.getElementById('password').value = btn.dataset.p;
        document.getElementById('username').focus();
      });
    });
  </script>
</body>
</html>`;

export function GET() {
  return new Response(FORM_HTML, {
    headers: { "Content-Type": "text/html; charset=utf-8" },
  });
}
