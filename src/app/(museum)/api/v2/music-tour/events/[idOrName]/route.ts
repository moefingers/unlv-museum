/**
 * /api/v2/music-tour/events/:idOrName — Enhanced tier.
 * Identical handlers to v1. Audit tier flips to "enhanced" via URL sniffing.
 */
export {
  GET,
  PUT,
  DELETE,
} from "../../../../music-tour/events/[idOrName]/route";
