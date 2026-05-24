import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { viewTransition: true },
  // Permit LAN access during dev so phones/tablets on the same
  // network can hit `http://<dev-machine-ip>:3000`. Next blocks
  // non-localhost origins by default to prevent cross-origin dev
  // abuse.
  //
  // Pattern matching quirks (this is the part you'd expect to
  // work and doesn't):
  //   - Next splits each entry on `.` and matches right-to-left
  //     DNS-style. `*` matches exactly ONE segment.
  //   - CIDR notation ("172.16.0.0/12") is NOT parsed — it's
  //     treated as a literal Host string. The previous CIDR
  //     entries here were silently no-ops.
  //   - So each IPv4 octet needs its own `*`, and the 172.16/12
  //     private range has to be expanded into one glob per
  //     /16 inside it (172.16.*.* through 172.31.*.*).
  //
  // Canonical IPv4 ranges covered:
  //   10.0.0.0/8        RFC 1918  private
  //   127.0.0.0/8       RFC 5735  loopback
  //   169.254.0.0/16    RFC 3927  link-local / APIPA
  //   172.16.0.0/12     RFC 1918  private (172.16 through 172.31)
  //   192.168.0.0/16    RFC 1918  private
  //   *.local           mDNS (e.g. mypc.local)
  //   *.localhost       localhost subdomains
  //
  // This is the same pattern zcanon uses (see
  // `zcanon/src/lib/private-network.ts`). Mirrored here inline
  // rather than pulled into a shared lib because the museum
  // has no other use for the network-range list.
  allowedDevOrigins: [
    "*.local",
    "*.localhost",
    "10.*.*.*",
    "127.*.*.*",
    "169.254.*.*",
    ...Array.from({ length: 16 }, (_, i) => `172.${16 + i}.*.*`),
    "192.168.*.*",
  ],
  // Pin Turbopack to this project root. Route groups like `(museum)` and
  // `(ssr)` confuse Turbopack's auto-inference on Windows; without this it
  // walks up from src/app/ and fails to locate next/package.json.
  turbopack: { root: path.resolve() },
  // GitHub avatar URLs come back as `https://avatars.githubusercontent.com/...`
  // from Better Auth's GitHub OAuth and surface through `auth.user.image`.
  // The EnterPrize Historical Enhanced port falls back to this URL for the
  // signed-in visitor's avatar when no project-side upload exists. Allowing
  // the hostname (vs unoptimized=true) keeps next/image's regular pipeline.
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "avatars.githubusercontent.com",
      },
    ],
  },
  // Containerized default-leaf landing is handled structurally now —
  // each `app/(museum)/<container>/page.tsx` calls `firstLeafSlug(id)`
  // from src/lib/project-route.tsx and redirects to it. That keeps the
  // default-leaf rule data-driven (derived from the PROJECTS array
  // order) rather than hardcoded per-container in this file. See
  // CONTAINERS in src/lib/projects.tsx for the array-order convention.
};

export default nextConfig;
