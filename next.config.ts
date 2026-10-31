import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
      // Bundled OpenStreetMap terrain (data/terrain.geojson) is plain JSON.
      "*.geojson": {
        type: "json",
      },
    },
  },
};

export default nextConfig;
