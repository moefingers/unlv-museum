import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { viewTransition: true },
  // Pin Turbopack to this project root. Route groups like `(museum)` and
  // `(ssr)` confuse Turbopack's auto-inference on Windows; without this it
  // walks up from src/app/ and fails to locate next/package.json.
  turbopack: { root: path.resolve() },
  // Containerized projects (see CONTAINERS in src/lib/projects.tsx) live
  // under /<container>/<slug>. The container root itself is not a real
  // route — landing on /<container> redirects to a sensible default leaf.
  // Status 307 (non-permanent) because the redirect target may change as
  // the museum's curation evolves.
  redirects: async () => [
    {
      source: "/react-exercises",
      destination: "/react-exercises/music-search",
      permanent: false,
    },
  ],
};

export default nextConfig;
