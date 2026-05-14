import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  experimental: { viewTransition: true },
  // Pin Turbopack to this project root. Route groups like `(museum)` and
  // `(ssr)` confuse Turbopack's auto-inference on Windows; without this it
  // walks up from src/app/ and fails to locate next/package.json.
  turbopack: { root: path.resolve() },
};

export default nextConfig;
