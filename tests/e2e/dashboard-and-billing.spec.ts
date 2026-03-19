import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL("/session", { timeout: 20_000 });
}

test.describe("Dashboard and billing", () => {
  test("dashboard is protected for unauthenticated users", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("free user can upgrade to pro from dashboard", async ({ page }, testInfo) => {
    const email = `e2e+dash-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /interview analytics/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /activation score/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/Plan/i)).toBeVisible();
    await expect(page.getByText(/free/i).first()).toBeVisible();

    const upgradeButton = page.getByRole("button", { name: /upgrade to pro/i });
    await expect(upgradeButton).toBeVisible();
    await upgradeButton.click();

    await expect(page.getByText(/pro/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/unlimited answers/i)).toBeVisible();
  });
});
