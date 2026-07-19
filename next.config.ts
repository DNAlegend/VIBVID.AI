import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Front-end-only build: mock data + simulated generation. No backend yet.
  devIndicators: false,
  // A second dev instance (e.g. demo mode with env overrides) can point at its
  // own build dir so it never fights the main server over .next.
  distDir: process.env.NEXT_DIST_DIR || ".next",
};

export default nextConfig;
