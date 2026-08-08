import path from "node:path";
import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  transpilePackages: ["shiki"],

  devIndicators: false,

  // Multiple lockfiles in the home dir confuse Turbopack's root inference;
  // pin it to the streamdown monorepo so it serves THIS app and its routes.
  turbopack: {
    root: path.join(__dirname, "../.."),
  },
};

export default nextConfig;
