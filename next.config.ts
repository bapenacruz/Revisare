import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      {
        source: "/:path*",
        has: [{ type: "host", value: "www.revisare.com" }],
        destination: "https://revisare.com/:path*",
        permanent: true,
      },
    ];
  },
  devIndicators: false,
  serverExternalPackages: ["web-push", "bcryptjs", "@node-rs/bcrypt"],
  allowedDevOrigins: [
    "192.168.68.88",
    "*.ngrok-free.app",
    "*.ngrok-free.dev",
    "*.ngrok.io",
    "*.ngrok.app",
    "*.ngrok.dev",
  ],
};

export default nextConfig;
