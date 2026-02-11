import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_ACTIONS === "true";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  basePath: isGhPages ? "/pulso-bo-mockup" : "",
  assetPrefix: isGhPages ? "/pulso-bo-mockup/" : "",
};

export default nextConfig;
