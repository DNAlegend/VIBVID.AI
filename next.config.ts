import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Front-end-only build: mock data + simulated generation. No backend yet.
  devIndicators: false,
};

export default nextConfig;
