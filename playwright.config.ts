import { defineConfig } from "@playwright/test";
import { resolve } from "node:path";
process.env.NEXO_E2E_DB ??= resolve("data", `e2e-${Date.now()}.sqlite`);
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  workers: 1,
  timeout: 30000,
  use: {
    baseURL: "http://localhost:3100",
    browserName: "chromium",
    headless: true,
    screenshot: "only-on-failure",
    trace: "retain-on-failure",
  },
  webServer: [
    {
      command: "npm run dev -w @nexo/api",
      url: "http://localhost:3101/api/health",
      env: {
        API_PORT: "3101",
        WEB_ORIGIN: "http://localhost:3100",
        DATABASE_PATH: process.env.NEXO_E2E_DB,
        OPENAI_API_KEY: "",
        LEGACY_FAILURE_MS: "0",
      },
      reuseExistingServer: false,
    },
    {
      command: "npm run dev -w @nexo/web -- --port 3100",
      url: "http://localhost:3100",
      env: { API_ORIGIN: "http://localhost:3101" },
      reuseExistingServer: false,
    },
  ],
});
