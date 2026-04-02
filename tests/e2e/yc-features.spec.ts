import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL("/session", { timeout: 20_000 });
}

const mockSubscriptionFree = {
  plan: "free",
  used: 2,
  remaining: 28,
  resetAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
};

test.describe("YC features", () => {
  test("company mode selection persists in active session header", async ({ page }, testInfo) => {
    await page.route("**/api/billing/subscription", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSubscriptionFree),
      });
    });
    await page.route("**/api/answer", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "E2E mock answer (no external LLM).",
          source: "fallback",
        }),
      });
    });

    const email = `e2e+yc-mode-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.getByTestId("company-mode-select").selectOption("amazon");
    await page.getByRole("button", { name: /start session/i }).click();

    await expect(page.getByTestId("session-company-bar")).toHaveText(/Amazon interview bar/i);
    await expect(page.getByTestId("session-role-badge")).toContainText(/ML/i);

    await page.getByPlaceholder("e.g. Explain overfitting and how to prevent it").fill("What is idempotency?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("session-company-bar")).toHaveText(/Amazon interview bar/i);
  });

  test("generate debrief shows results card (mocked debrief API)", async ({ page }, testInfo) => {
    await page.route("**/api/billing/subscription", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSubscriptionFree),
      });
    });
    await page.route("**/api/answer", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          answer: "Mock answer for debrief payload.",
          source: "fallback",
        }),
      });
    });

    const debriefPayload = {
      overallScore: 81,
      strengths: ["Clear structure", "Good depth"],
      improvementAreas: ["Add metrics"],
      nextPracticeQuestions: ["Q1 mock", "Q2 mock", "Q3 mock"],
      conciseCoachNote: "Keep answers under two minutes.",
      source: "fallback" as const,
    };

    await page.route("**/api/session/debrief", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(debriefPayload),
      });
    });

    const email = `e2e+yc-debrief-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();

    await page.getByPlaceholder("e.g. Explain overfitting and how to prevent it").fill("Tell me about a trade-off.");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 15_000 });

    const debriefEvent = page.waitForResponse(
      (res) => {
        if (!res.url().includes("/api/events") || res.request().method() !== "POST") return false;
        const raw = res.request().postData();
        if (!raw) return false;
        try {
          const j = JSON.parse(raw) as { eventType?: string };
          return j.eventType === "debrief_generated";
        } catch {
          return false;
        }
      },
      { timeout: 15_000 },
    );

    await page.getByTestId("generate-debrief").click();
    await expect(page.getByTestId("debrief-results")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("debrief-results")).toContainText("81");
    await expect(page.getByTestId("debrief-results")).toContainText("Clear structure");

    const evRes = await debriefEvent;
    expect(evRes.ok()).toBeTruthy();
  });

  test("dashboard secure checkout falls back to mock upgrade when checkout returns 503", async ({
    page,
  }, testInfo) => {
    await page.route("**/api/billing/checkout", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 503,
        contentType: "application/json",
        body: JSON.stringify({
          error: "Checkout is not available.",
          detail: "e2e mock",
        }),
      });
    });

    const email = `e2e+yc-checkout-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    await page.goto("/dashboard");
    await expect(page.getByRole("heading", { name: /interview analytics/i })).toBeVisible({
      timeout: 20_000,
    });

    await page.getByTestId("dashboard-secure-checkout").click();
    await expect(page.getByText(/unlimited answers/i)).toBeVisible({ timeout: 20_000 });
  });
});
