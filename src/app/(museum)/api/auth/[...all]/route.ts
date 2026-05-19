/**
 * Better Auth's catch-all route handler. Mounts the OAuth start endpoint,
 * the GitHub callback, session, sign-out, and the per-path rate limiter
 * under `/api/auth/*`. Configuration lives in `src/lib/auth.ts`.
 */

import { toNextJsHandler } from "better-auth/next-js";
import { auth } from "@/lib/auth";

export const { GET, POST } = toNextJsHandler(auth);
