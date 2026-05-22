/**
 * /api/v2/rest-rant/places — Enhanced tier.
 *
 * Re-exports v1's handlers for the source-faithful surface. The guard's
 * URL-prefix sniffing (api-guard.ts → tierFromUrl) means audit rows
 * written by these handlers record `tier="enhanced"` automatically when
 * the request lands at /api/v2/*.
 */

export { GET, POST } from "../../../rest-rant/places/route";
