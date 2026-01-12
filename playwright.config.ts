import { defineConfig, devices } from "@playwright/test";
import dotenv from "dotenv";
import path from "node:path";

dotenv.config({ path: path.resolve(process.cwd(), ".env.test") });

const DEV_SERVER_PORT = Number(process.env.PLAYWRIGHT_DEV_PORT ?? 4321);
// On Windows, `localhost` may resolve to IPv6 (::1) while the dev server binds to IPv4 only.
// Use 127.0.0.1 by default to avoid Playwright `webServer` readiness timeouts.
const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? `http://127.0.0.1:${DEV_SERVER_PORT}`;
// Playwright's webServer availability check does not follow redirects.
// Our app redirects `/` (302) for unauthenticated users, so use a stable 200 page instead.
const WEB_SERVER_URL = new URL("/auth/login", BASE_URL).toString();

export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 2 : undefined,
  timeout: 30_000,
  expect: {
    timeout: 5_000,
  },
  reporter: [["list"], ["html", { open: "never", outputFolder: "coverage/e2e-report" }]],
  outputDir: "tests/.output",
  use: {
    baseURL: BASE_URL,
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
    video: "retain-on-failure",
    viewport: { width: 1280, height: 720 },
    headless: process.env.CI ? true : undefined,
  },
  projects: [
    {
      name: "chromium-desktop",
      use: {
        ...devices["Desktop Chrome"],
      },
    },
  ],
  webServer: {
    // Pass host/port via args so the dev:e2e script stays cross-platform and deterministic.
    command: `npm run dev:e2e -- --host 127.0.0.1 --port ${DEV_SERVER_PORT}`,
    url: WEB_SERVER_URL,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
