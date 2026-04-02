import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator("#password").fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL("/session", { timeout: 20_000 });
}

test.describe("Dashboard and billing", () => {
  test("dashboard is protected for unauthenticated users", async ({ page, context }) => {
    await context.clearCookies();
    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("dashboard loads funnel analytics overview and activation score (no crash)", async ({
    page,
  }, testInfo) => {
    const email = `e2e+funnel-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    const overviewPromise = page.waitForResponse(
      (res) => res.url().includes("/api/analytics/overview") && res.request().method() === "GET",
    );

    await page.goto("/dashboard");
    const overviewRes = await overviewPromise;
    expect(overviewRes.ok()).toBeTruthy();

    const body = (await overviewRes.json()) as {
      plan?: string;
      activation?: { score?: number; completed?: string[]; pending?: string[] };
    };
    expect(body).toHaveProperty("activation");
    expect(typeof (body.activation?.score ?? 0)).toBe("number");

    await expect(page.getByRole("heading", { name: /interview analytics/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /activation score/i })).toBeVisible();
    await expect(page.getByText(/completed:/i)).toBeVisible();
    await expect(page.getByText(/remaining:/i)).toBeVisible();
  });

  test("free user can upgrade to pro from dashboard", async ({ page }, testInfo) => {
    await page.route("**/api/billing/checkout", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Checkout is not available.",
          detail: "e2e",
        }),
      });
    });

    const email = `e2e+dash-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /interview analytics/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByRole("heading", { name: /activation score/i })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText("Plan", { exact: true })).toBeVisible();
    await expect(page.getByText(/free/i).first()).toBeVisible();

    const checkoutButton = page.getByTestId("dashboard-secure-checkout");
    await expect(checkoutButton).toBeVisible();
    await checkoutButton.click();

    await expect(page.getByText(/pro/i).first()).toBeVisible({ timeout: 20_000 });
    await expect(page.getByText("Unlimited answers", { exact: true })).toBeVisible();
  });

  test("dashboard generates 7-day prep plan (mocked prep-plan API)", async ({ page }, testInfo) => {
    const plan = {
      summary: "E2E mock summary for your prep week.",
      days: Array.from({ length: 7 }, (_, i) => ({
        day: i + 1,
        goal: `Goal for day ${i + 1}`,
        drills: ["Drill one", "Drill two"],
        expectedOutcome: "You feel more prepared.",
      })),
    };

    await page.route("**/api/session/prep-plan", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(plan),
      });
    });

    const email = `e2e+prep-plan-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /interview analytics/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("dashboard-generate-prep-plan").click();
    await expect(page.getByTestId("prep-plan-results")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText(/E2E mock summary/i)).toBeVisible();
    await expect(page.getByText(/Goal for day 1/i)).toBeVisible();
  });
});
