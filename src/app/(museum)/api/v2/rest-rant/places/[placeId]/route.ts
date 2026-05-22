/**
 * /api/v2/rest-rant/places/[placeId] — Enhanced tier.
 *
 * Re-exports v1's handlers for the source-faithful single-place surface.
 * tier="enhanced" gets recorded automatically via tierFromUrl().
 */

export { GET, PUT, DELETE } from "../../../../rest-rant/places/[placeId]/route";
