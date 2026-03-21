import { defineConfig, devices } from "@playwright/test";

const port = 3004;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * CI / production-like E2E: Next.js production build + `next start` (not dev server).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  fullyParallel: false,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: 1,
  reporter: "html",
  use: {
    baseURL,
    trace: "on-first-retry",
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
  webServer: {
    command: "npm run build && npm run start",
    url: baseURL,
    reuseExistingServer: false,
    timeout: 600_000,
  },
});
