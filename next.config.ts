import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  images: {
    remotePatterns: [
      { protocol: "https", hostname: "images.unsplash.com", pathname: "/**" },
      { protocol: "https", hostname: "img.echosting.cafe24.com", pathname: "/**" },
    ],
  },
  outputFileTracingIncludes: {
    "/api/cafe24/theme-package": ["./Guide/skin4/**/*"],
  },
};

export default nextConfig;
