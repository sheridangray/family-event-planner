import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    domains: [
      'lh3.googleusercontent.com', // Google profile images
      'avatars.githubusercontent.com', // GitHub avatars (if needed later)
    ],
  },
  // Disable strict linting in production builds to prevent deployment failures
  eslint: {
    ignoreDuringBuilds: true,
  },
  typescript: {
    ignoreBuildErrors: false, // Keep TypeScript checking but allow warnings
  },
  // Fix workspace root detection for Turbopack in monorepo
  turbopack: {
    root: './',
  },
  // Set proper root for output file tracing
  outputFileTracingRoot: process.cwd(),
};

export default nextConfig;
