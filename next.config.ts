import type { NextConfig } from "next";

// For GitHub Pages project sites the app lives at /<repo-name>, so the
// deploy workflow sets NEXT_PUBLIC_BASE_PATH. On Vercel leave it unset.
const basePath = process.env.NEXT_PUBLIC_BASE_PATH || "";

const nextConfig: NextConfig = {
  output: "export", // fully static site in ./out
  basePath,
  trailingSlash: true,
  images: { unoptimized: true },
};

export default nextConfig;
