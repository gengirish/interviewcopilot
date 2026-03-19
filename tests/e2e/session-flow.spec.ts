import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL("/session", { timeout: 20_000 });
}

test.describe("Session flow", () => {
  test("typed question generates an answer card", async ({ page }, testInfo) => {
    const email = `e2e+session-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    const input = page.getByPlaceholder("e.g. Explain overfitting and how to prevent it");
    await input.fill("What is overfitting and how do you prevent it?");
    await page.getByRole("button", { name: /^ask$/i }).click();

    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/overfitting|core concept|approach/i).first()).toBeVisible({
      timeout: 20_000,
    });
  });

  test("session setup shows plan and remaining quota", async ({ page }, testInfo) => {
    const email = `e2e+quota-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await expect(page.getByText(/Plan:/i)).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText(/Remaining this month:/i)).toBeVisible({ timeout: 20_000 });
  });

  test("quick start question chips populate input", async ({ page }, testInfo) => {
    const email = `e2e+chips-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();

    const input = page.getByPlaceholder("e.g. Explain overfitting and how to prevent it");
    const chip = page.getByRole("button", {
      name: /Explain overfitting and how to prevent it in production ML systems/i,
    });
    await chip.click();
    await expect(input).toHaveValue(/overfitting/i);
  });
});
