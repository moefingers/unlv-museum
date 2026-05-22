/**
 * /api/v2/rest-rant/authentication — Enhanced tier.
 *
 * Re-exports v1's three-factor-login handler. tier="enhanced" recorded
 * on the audit row automatically via tierFromUrl(). See
 * CONTEXT/internal_docs/identity-and-signup.md for the three-factor
 * contract.
 */

export { POST } from "../../../rest-rant/authentication/route";
