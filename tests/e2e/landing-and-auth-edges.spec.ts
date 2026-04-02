import { test, expect, type Page } from "@playwright/test";

async function signupViaPage(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
}

test.describe("Landing and auth edge cases", () => {
  test("landing page exposes core CTAs and anchors", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/");

    await expect(page.getByRole("heading", { name: /hire with confidence, not guesswork/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /^start free$/i }).first()).toBeVisible();

    const demoLink = page.getByRole("link", { name: /book demo/i });
    await expect(demoLink).toBeVisible();
    await expect(demoLink).toHaveAttribute("href", /mailto:hello@infinityhire\.ai/i);

    await page.getByRole("link", { name: /features/i }).click();
    await expect(page).toHaveURL(/#features/);
  });

  test("signup shows duplicate-email error on second registration", async ({ page, context }, testInfo) => {
    await context.clearCookies();
    const email = `e2e+dup-${Date.now()}-${testInfo.workerIndex}@example.com`;

    await signupViaPage(page, email);
    await expect(page).toHaveURL("/session", { timeout: 20_000 });

    await context.clearCookies();

    await signupViaPage(page, email);
    await expect(page.getByText(/email already registered/i)).toBeVisible();
  });

  test("login shows invalid-credentials error", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/login");
    await page.getByRole("textbox", { name: /email/i }).fill("no-user@example.com");
    await page.locator("#password").fill("wrong-password");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page.getByText(/invalid email or password/i)).toBeVisible({ timeout: 20_000 });
    await expect(page).toHaveURL(/\/login/);
  });

  test("logout clears auth and protected routes redirect back to login", async ({ page, context }, testInfo) => {
    await context.clearCookies();
    const email = `e2e+logout-${Date.now()}-${testInfo.workerIndex}@example.com`;

    await signupViaPage(page, email);
    await expect(page).toHaveURL("/session", { timeout: 20_000 });

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible({ timeout: 20_000 });

    await page.getByRole("button", { name: /logout/i }).click();
    await expect(page).toHaveURL(/\/login/, { timeout: 20_000 });

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });
});
