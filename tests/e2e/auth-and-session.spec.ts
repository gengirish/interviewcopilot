import { test, expect } from "@playwright/test";

test.describe("Auth and session", () => {
  test("redirects to login when opening /session while unauthenticated", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    await page.goto("/session");
    await expect(page).toHaveURL(/\/login/);
    await expect(page.getByRole("heading", { name: /welcome back|create account/i })).toBeVisible();
  });

  test("can sign up and access /session", async ({ page, context }, testInfo) => {
    await context.clearCookies();
    await page.goto("/signup");
    const email = `e2e+signup-${Date.now()}-${testInfo.workerIndex}@example.com`;

    await page.getByRole("textbox", { name: /email/i }).fill(email);
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign up/i }).click();

    await expect(page).toHaveURL("/session", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /set up your session/i })).toBeVisible();
  });

  test("can log in and access /session", async ({ page, context, request }, testInfo) => {
    await context.clearCookies();
    const email = `e2e+login-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await request.post("/api/auth/signup", {
      data: { email, password: "password123" },
    });
    await page.goto("/login");

    await page.getByRole("textbox", { name: /email/i }).fill(email);
    await page.getByLabel(/password/i).fill("password123");
    await page.getByRole("button", { name: /sign in/i }).click();

    await expect(page).toHaveURL("/session", { timeout: 20_000 });
    await expect(page.getByRole("heading", { name: /set up your session/i })).toBeVisible();
  });
});
