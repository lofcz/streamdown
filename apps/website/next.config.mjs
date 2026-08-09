import { createMDX } from "fumadocs-mdx/next";

const withMDX = createMDX();

/** @type {import('next').NextConfig} */
const config = {
  experimental: {
    turbopackFileSystemCacheForDev: true,
  },

  redirects: async () => {
    return [
      {
        source: "/docs/cjk-support",
        destination: "/docs/plugins/cjk",
        permanent: true,
      },
      {
        source: "/docs/mermaid",
        destination: "/docs/plugins/mermaid",
        permanent: true,
      },
      {
        source: "/docs/mathematics",
        destination: "/docs/plugins/math",
        permanent: true,
      },
    ];
  },

  images: {
    formats: ["image/avif", "image/webp"],
    remotePatterns: [
      {
        protocol: "https",
        hostname: "placehold.co",
      },
    ],
  },
};

export default withMDX(config);
