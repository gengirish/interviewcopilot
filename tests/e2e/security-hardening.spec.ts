import { test, expect, type Page } from "@playwright/test";

/** Must match `AUTH_COOKIE_NAME` in `src/lib/server/jwt.ts`. */
const AUTH_COOKIE_NAME = "auth-token";

async function signupAndLogin(page: Page, email: string) {
  await page.goto("/signup");
  await page.getByRole("textbox", { name: /email/i }).fill(email);
  await page.getByLabel(/password/i).fill("password123");
  await page.getByRole("button", { name: /sign up/i }).click();
  await expect(page).toHaveURL("/session", { timeout: 20_000 });
}

test.describe("Security hardening", () => {
  test("protected routes redirect to login when auth cookie is present but invalid", async ({
    page,
    context,
  }) => {
    await context.clearCookies();
    const baseURL =
      (test.info().project.use.baseURL as string | undefined) ?? "http://127.0.0.1:3004";

    await context.addCookies([
      {
        name: AUTH_COOKIE_NAME,
        value: "not-a-valid-jwt",
        url: baseURL,
      },
    ]);

    await page.goto("/dashboard");
    await expect(page).toHaveURL(/\/login/);
  });

  test("POST /api/billing/upgrade returns 403 when mock upgrade is disabled in production", async ({
    page,
  }, testInfo) => {
    const email = `e2e+hardening-${Date.now()}-${testInfo.workerIndex}@example.com`;
    await signupAndLogin(page, email);

    const session = (await page.context().cookies()).find((c) => c.name === AUTH_COOKIE_NAME);
    expect(session).toBeDefined();

    const res = await page.request.post("/api/billing/upgrade", {
      headers: { Cookie: `${AUTH_COOKIE_NAME}=${session!.value}` },
    });
    expect(res.status()).toBe(403);

    const body = (await res.json()) as { error?: string };
    expect(body.error).toMatch(/Mock billing upgrade is disabled in production/i);
    expect(body.error).toMatch(/ALLOW_MOCK_UPGRADE/i);
  });
});
