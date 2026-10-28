import type { NextConfig } from "next";
import { existsSync } from "node:fs";
import { loadEnvFile } from "node:process";
// Carrega configuração compartilhada sem propagar flags de processo aos workers do Next.
if (existsSync("../../.env")) loadEnvFile("../../.env");
const config: NextConfig = {
  transpilePackages: ["@nexo/contracts"],
  async rewrites() {
    return [
      {
        source: "/api/:path*",
        destination: `${process.env.API_ORIGIN ?? "http://localhost:3001"}/api/:path*`,
      },
    ];
  },
};
export default config;
