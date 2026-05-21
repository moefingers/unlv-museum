import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { viewTransition: true },
  // Permit LAN access during dev so phones/tablets on the same
  // network can hit `http://<dev-machine-ip>:3000`. Next blocks
  // non-localhost origins by default to prevent cross-origin
  // dev abuse; the LAN-private CIDR ranges below cover the
  // common router-issued subnets without exposing anything to
  // the public internet. Add specific addresses here if your
  // dev IP falls outside these ranges (look it up in `ipconfig`
  // / `ifconfig` and append the literal e.g. "172.16.240.124").
  allowedDevOrigins: [
    "10.0.0.0/8",
    "172.16.0.0/12",
    "192.168.0.0/16",
    '172.16.240.124'
  ],
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
    {
      // html-fundamentals container — defaults to restaurant-menu (the
      // chronologically-first leaf at chapter 2.3.2).
      source: "/html-fundamentals",
      destination: "/html-fundamentals/restaurant-menu",
      permanent: false,
    },
    {
      // css-fundamentals container — defaults to css-demo (the
      // chronologically-first leaf, an own/sketch leading into the
      // graded chapter-3 labs).
      source: "/css-fundamentals",
      destination: "/css-fundamentals/css-demo",
      permanent: false,
    },
    {
      // js-exercises container — defaults to web-game (chapter 5.3-5.6,
      // the chronologically-first leaf). When the Globe graph layout
      // lands, this default leaf becomes the natural "start of the
      // curriculum-curve arc" for chapter 5.x.
      source: "/js-exercises",
      destination: "/js-exercises/web-game",
      permanent: false,
    },
  ],
};

export default nextConfig;
