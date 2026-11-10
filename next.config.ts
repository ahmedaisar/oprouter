import type { NextConfig } from "next";
const nextConfig: NextConfig = {
  reactStrictMode: true,
  poweredByHeader: false,
  // CI runs ESLint explicitly; Next's bundled build-time runner passes
  // deprecated options to the installed ESLint API.
  eslint: { ignoreDuringBuilds: true }
};
export default nextConfig;
