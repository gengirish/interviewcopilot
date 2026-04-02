import { test, expect, type Page } from "@playwright/test";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.locator("#password").fill("password123");
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

  test("question bank generation shows chips and fills draft on chip click", async ({ page }, testInfo) => {
    await page.route("**/api/billing/subscription", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSubscriptionFree),
      });
    });
    await page.route("**/api/session/question-bank", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          questions: [
            "E2E_BANK_Q1: How would you validate a new ranking model before full rollout?",
            "E2E_BANK_Q2: Describe monitoring for data drift in production.",
          ],
        }),
      });
    });

    const email = `e2e+yc-bank-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();

    await page.getByTestId("generate-question-bank").click();
    await expect(page.getByTestId("question-bank-chips")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("question-bank-chip").first()).toContainText(/E2E_BANK_Q1/i);

    const input = page.getByPlaceholder("e.g. Explain overfitting and how to prevent it");
    await page.getByTestId("question-bank-chip").first().click();
    await expect(input).toHaveValue(/E2E_BANK_Q1/i);
  });

  test("best-answer rewrite shows rewritten block and improvements list", async ({ page }, testInfo) => {
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
          answer: "Short mock answer for rewrite.",
          source: "fallback",
        }),
      });
    });
    await page.route("**/api/session/rewrite", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          rewrittenAnswer: "E2E_REWRITE: Clear headline, then structured depth with metrics.",
          improvements: ["Add a one-line thesis up front.", "Tie claims to measurable outcomes.", "State rollback plan."],
          source: "fallback",
        }),
      });
    });

    const email = `e2e+yc-rewrite-${testInfo.testId}-${Date.now()}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();

    await page.getByPlaceholder("e.g. Explain overfitting and how to prevent it").fill("What is idempotency?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("rewrite-answer-button").click();
    await expect(page.getByTestId("rewrite-result-block")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("rewrite-result-block")).toContainText(/E2E_REWRITE/i);
    await expect(page.getByTestId("rewrite-improvements")).toContainText(/thesis/i);
    await expect(page.getByTestId("rewrite-improvements").locator("li")).toHaveCount(3);
  });

  test("generate 7-day prep plan renders seven day items", async ({ page }, testInfo) => {
    await page.route("**/api/billing/subscription", async (route) => {
      if (route.request().method() !== "GET") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify(mockSubscriptionFree),
      });
    });
    const days = Array.from({ length: 7 }, (_, i) => ({
      day: i + 1,
      goal: `E2E Day ${i + 1}: focus block`,
      drills: ["Task A", "Task B"],
      expectedOutcome: `Outcome marker ${i + 1}`,
    }));
    await page.route("**/api/session/prep-plan", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          days,
          summary: "E2E seven-day prep overview for the candidate.",
        }),
      });
    });

    const email = `e2e+yc-prep-${testInfo.testId}-${Date.now()}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();

    await page.getByTestId("generate-prep-plan").click();
    await expect(page.getByTestId("prep-plan-list")).toBeVisible({ timeout: 15_000 });
    for (let d = 1; d <= 7; d++) {
      await expect(page.getByTestId(`prep-plan-day-${d}`)).toContainText(new RegExp(`E2E Day ${d}`, "i"));
    }
  });

  test("share report shows copyable text after build", async ({ page }, testInfo) => {
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
        body: JSON.stringify({ answer: "Answer for share flow.", source: "fallback" }),
      });
    });
    const debriefPayload = {
      overallScore: 70,
      strengths: ["S1"],
      improvementAreas: ["I1"],
      nextPracticeQuestions: ["PQ1", "PQ2", "PQ3"],
      conciseCoachNote: "Coach note.",
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
    await page.route("**/api/session/share-report", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          reportText: "E2E_SHARE_REPORT_LINE_1\nE2E_SHARE_REPORT_LINE_2",
        }),
      });
    });

    const email = `e2e+yc-share-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.getByRole("button", { name: /start session/i }).click();
    await page.getByPlaceholder("e.g. Explain overfitting and how to prevent it").fill("Any question?");
    await page.getByRole("button", { name: /^ask$/i }).click();
    await expect(page.getByText(/AI Answer/i)).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("generate-debrief").click();
    await expect(page.getByTestId("debrief-results")).toBeVisible({ timeout: 15_000 });

    await page.getByTestId("share-report-generate").click();
    await expect(page.getByTestId("share-report-text")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("share-report-text")).toContainText("E2E_SHARE_REPORT_LINE_1");
  });

  test("team panel generates summary from rubric and notes", async ({ page }, testInfo) => {
    await page.route("**/api/team/summary", async (route) => {
      if (route.request().method() !== "POST") return route.continue();
      await route.fulfill({
        status: 200,
        contentType: "application/json",
        body: JSON.stringify({
          summary: "## E2E Team summary\n- Rubric captured\n- Next: debrief",
          source: "fallback",
        }),
      });
    });

    const email = `e2e+yc-team-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);
    await page.goto("/team");
    await expect(page.getByRole("heading", { name: /team panel mode/i })).toBeVisible({ timeout: 20_000 });

    await page.getByTestId("team-rubric-input").fill("Communication: strong. Depth: mixed.");
    await page.getByTestId("team-notes-input").fill("Recommend onsite. Probe system design further.");
    await page.getByTestId("team-generate-summary").click();

    await expect(page.getByTestId("team-summary-output")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByTestId("team-summary-output")).toContainText(/E2E Team summary/i);
  });
});
