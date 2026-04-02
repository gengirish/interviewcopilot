import { defineConfig, devices } from "@playwright/test";

const port = 3004;
const baseURL = `http://127.0.0.1:${port}`;

/**
 * Production server (`next start`) with mock billing upgrade forced off.
 * Run: `npm run test:e2e:hardening`
 *
 * Kept separate from `playwright.ci.config.ts` because CI enables ALLOW_MOCK_UPGRADE
 * for dashboard upgrade flows.
 */
export default defineConfig({
  testDir: "./tests/e2e",
  testMatch: /security-hardening\.spec\.ts/,
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
    env: {
      ...process.env,
      // Override job-level CI env so production mock upgrade stays disabled.
      ALLOW_MOCK_UPGRADE: "",
    },
  },
});
