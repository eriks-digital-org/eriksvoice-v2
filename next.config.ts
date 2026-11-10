import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async rewrites() {
    return {
      // "/" is the static EriksVoice landing page (public/landing, see scripts/import-landing.mjs).
      beforeFiles: [{ source: "/", destination: "/landing/index.html" }],
    };
  },
};

export default nextConfig;
