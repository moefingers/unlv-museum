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
  // Containerized default-leaf landing is handled structurally now —
  // each `app/(museum)/<container>/page.tsx` calls `firstLeafSlug(id)`
  // from src/lib/project-route.tsx and redirects to it. That keeps the
  // default-leaf rule data-driven (derived from the PROJECTS array
  // order) rather than hardcoded per-container in this file. See
  // CONTAINERS in src/lib/projects.tsx for the array-order convention.
};

export default nextConfig;
