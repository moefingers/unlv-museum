/**
 * /api/v2/music-tour/bands/:idOrName — Enhanced tier.
 *
 * Identical surface to v1. Re-exports the handlers verbatim. The guard's
 * URL-prefix detection (api-guard.ts → tierFromUrl) means audit rows
 * record `tier="enhanced"` for v2 PUT/DELETE without any code change.
 */
export {
  GET,
  PUT,
  DELETE,
} from "../../../../music-tour/bands/[idOrName]/route";
