import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator("#password").fill("password123");
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

  test("demo query param prefills sample question after session starts", async ({ page }, testInfo) => {
    const email = `e2e+demo-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.goto("/session?demo=1");
    await expect(page.getByRole("heading", { name: /set up your session/i })).toBeVisible();

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    const input = page.getByPlaceholder("e.g. Explain overfitting and how to prevent it");
    await expect(input).toHaveValue(/fraud detection|production ML model/i, { timeout: 15_000 });
  });

  test("near-quota subscription response shows urgency status and upgrade CTA", async ({
    page,
  }, testInfo) => {
    await page.route("**/api/billing/subscription", async (route) => {
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          plan: "free",
          used: 28,
          remaining: 2,
          resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
        }),
      });
    });

    const email = `e2e+nearquota-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await expect(
      page.getByRole("status").filter({ hasText: /almost out of free answers/i }),
    ).toBeVisible({ timeout: 20_000 });
    await expect(
      page.getByRole("button", { name: /^upgrade to pro$/i }).first(),
    ).toBeVisible();

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    await expect(
      page.getByRole("status").filter({ hasText: /almost out of free answers/i }),
    ).toBeVisible();
    await expect(
      page.getByRole("button", { name: /^upgrade to pro$/i }).first(),
    ).toBeVisible();
  });

  test("free plan shows upgrade CTA on setup and in active session when quota is comfortable", async ({
    page,
  }, testInfo) => {
    const email = `e2e+freecta-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await expect(page.getByRole("button", { name: /secure checkout/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    await expect(
      page.getByRole("button", { name: /^upgrade$/i }).filter({ hasText: /upgrade/i }),
    ).toBeVisible();
  });

  test("answer helpful feedback posts to API and shows confirmation", async ({ page }, testInfo) => {
    const email = `e2e+fb-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.getByRole("button", { name: /start session/i }).click();
    await expect(page.getByRole("link", { name: /dashboard/i })).toBeVisible();

    const input = page.getByPlaceholder("e.g. Explain overfitting and how to prevent it");
    await input.fill("What is a confusion matrix in one sentence?");

    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 25_000 });

    const feedbackPromise = page.waitForResponse(
      (res) =>
        res.url().includes("/api/feedback/answer") &&
        res.request().method() === "POST" &&
        res.ok(),
    );
    await page.getByRole("button", { name: /this answer was helpful/i }).click();
    await feedbackPromise;
    await expect(page.getByText("Feedback saved.")).toBeVisible();
  });
});
