import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  async headers() {
    // The service worker must never be served stale, or updates would not be noticed.
    return [{ source: "/sw.js", headers: [{ key: "Cache-Control", value: "no-cache, no-store, must-revalidate" }] }];
  },
  async redirects() {
    return [{ source: "/", destination: "/today", permanent: false }];
  },
};

export default nextConfig;
