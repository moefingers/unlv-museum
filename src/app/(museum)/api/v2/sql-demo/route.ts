/**
 * /api/v2/sql-demo — Enhanced tier.
 *
 * Re-exports v1's GET (the form HTML) + POST (the JSON injection lab).
 * The guard's URL-prefix sniffing (tierFromUrl) means audit rows
 * written by the POST handler record `tier="enhanced"` automatically
 * when the request hits /api/v2/*.
 *
 * The pedagogy is identical — string-interpolated WHERE clauses are
 * still exploitable, the locked-down `sql_demo_runner` role still
 * restricts blast radius. Enhanced just adds tier=enhanced
 * attribution to the audit log so visitors can slice "who injected
 * via the lab surface vs the form surface" by combining `?tier=` with
 * `?surface=` (encoded in the after-payload).
 */

export { GET, POST } from "../../sql-demo/route";
