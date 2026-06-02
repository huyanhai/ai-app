import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  /* config options here */
  allowedDevOrigins: ["10.76.56.50"],
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "dashscope-7c2c.oss-accelerate.aliyuncs.com",
        port: "",
      },
    ],
  },
};

export default nextConfig;
