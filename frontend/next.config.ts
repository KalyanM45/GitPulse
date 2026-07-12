import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  /**
   * Standalone output is for the Docker image only: it emits a self-contained
   * server.js plus just the node_modules actually reachable, instead of the full
   * dependency tree. Vercel builds and runs Next itself and does not want this —
   * so it's switched on by the Dockerfile (DOCKER_BUILD=1) and off everywhere else.
   */
  output: process.env.DOCKER_BUILD === "1" ? "standalone" : undefined,
  images: {
    // GitHub avatars + OpenGraph images are the only remote sources we render.
    remotePatterns: [
      { protocol: "https", hostname: "avatars.githubusercontent.com" },
      { protocol: "https", hostname: "github.com" },
    ],
  },
  experimental: {
    // Ship only the icons/chart pieces actually imported, not the whole barrel.
    optimizePackageImports: ["lucide-react", "recharts", "framer-motion"],
  },
};

export default nextConfig;
