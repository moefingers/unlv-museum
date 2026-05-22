/**
 * /api/v2/rest-rant/users — Enhanced tier.
 *
 * Re-exports v1's handlers (GET = list, POST = signup). Signup goes
 * through the same guard + audit path; tier="enhanced" recorded
 * automatically via tierFromUrl(). The identity-and-signup contract
 * applies uniformly across tiers, so the museum_user_id FK requirement
 * is enforced by the v1 handler regardless of which URL prefix the
 * request lands at.
 */

export { GET, POST } from "../../../rest-rant/users/route";
