import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          {
            key: "Content-Security-Policy",
            value:
              "frame-ancestors 'self' https://*.myshopify.com https://admin.shopify.com;",
          },
        ],
      },
    ];
  },
};

export default nextConfig;
