---
name: turfstack-playwright
description: Write and run Playwright E2E tests for TurfStack. Use when creating new E2E tests, debugging test failures, adding test coverage for new features, or running the Playwright test suite. Covers test structure, shared fixtures, selector patterns, and common workflows.
---

# TurfStack Playwright E2E Testing

## Project Structure

E2E tests live in `frontend/e2e/`. Run commands from `frontend/` (or project root with `--prefix frontend`).

```
frontend/
├── e2e/
│   ├── fixtures/
│   │   ├── auth.ts        # loginAs, logout, CREDENTIALS
│   │   └── test-data.ts   # FACILITY, BRANCHES, SPORTS, SIDEBAR_ITEMS, COURTS, date helpers
│   ├── landing.spec.ts
│   ├── settings.spec.ts
│   ├── courts.spec.ts
│   ├── sidebar.spec.ts
│   ├── registration.spec.ts
│   ├── booking-flow.spec.ts
│   ├── bookings-mgmt.spec.ts
│   ├── branches.spec.ts
│   ├── schedule.spec.ts
│   └── team.spec.ts
├── playwright.config.ts
└── package.json
```

## Running Tests

| Command | Purpose |
|---------|---------|
| `npm run test:e2e` | Run all tests headless (starts dev server if localhost) |
| `npm run test:e2e:headed` | Run with visible browser |
| `npm run test:e2e:ui` | Playwright UI mode (interactive) |

**Single file:**
```bash
npx playwright test e2e/landing.spec.ts
```

**Production (Vercel):**
```bash
BASE_URL=https://turfstack.vercel.app npx playwright test
```

**View HTML report after run:**
```bash
npx playwright show-report
```

## Shared Fixtures

### `e2e/fixtures/auth.ts`
- `loginAs(page, role)` — Logs in as owner, manager, staff, accountant, player, player2. Waits for `/dashboard` or `/book`.
- `logout(page)` — Clicks Sign Out, waits for `/login`.
- `CREDENTIALS` — Map of role → `{ email, password }`.
- `Role` — Type for valid roles.

### `e2e/fixtures/test-data.ts`
- `FACILITY` — `{ name: "TurfStack Arena", id: 1 }`
- `BRANCHES` — `["Gachibowli", "Madhapur"]`
- `SPORTS` — `["Pickleball", "Cricket", "Volleyball", "Badminton"]`
- `SIDEBAR_ITEMS` — Per-role sidebar nav items (owner, manager, staff, accountant, player)
- `COURTS` — `{ gachibowli: [...], madhapur: [...] }`
- `todayISO()` — Today's date as YYYY-MM-DD
- `futureDateISO(daysAhead)` — Future date as YYYY-MM-DD

## Writing New Tests

### Template
```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Feature Name", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard/your-page");
  });

  test("does something", async ({ page }) => {
    // ...
  });
});
```

### Selector Strategy (no data-testid)
Prefer in order: `getByRole` > `getByLabel` > `getByText` > `getByPlaceholder` > CSS locator.

- Links: `page.getByRole("link", { name: "Overview" })`
- Buttons: `page.getByRole("button", { name: "Sign In" })`
- Inputs: `page.getByLabel("Email")`, `page.getByLabel("Court Name")`
- Headings: `page.getByRole("heading", { name: "Courts" })`
- Validation errors: `page.locator("p.text-xs.text-red-500").filter({ hasText: "..." })`

### Toast Assertions
```typescript
await page.getByRole("button", { name: "Save Changes" }).click();
await expect(page.getByText("Profile updated")).toBeVisible();
// If slow: await expect(...).toBeVisible({ timeout: 5000 });
```

### Dialog Handling
```typescript
page.on("dialog", (dialog) => dialog.accept());
await page.getByRole("button", { name: "Cancel" }).click();
```

### Navigation
Use relative paths; `baseURL` is set in config (localhost:3000 or env):
```typescript
await page.goto("/login");
await page.goto("/dashboard/courts");
```

## Adding Tests for New Features

1. Create `e2e/<feature>.spec.ts`.
2. Import `loginAs` (and `logout`, `CREDENTIALS`, `SIDEBAR_ITEMS`, etc. as needed).
3. Use `test.beforeEach` to log in and navigate.
4. Follow patterns from `landing.spec.ts`, `settings.spec.ts`, `courts.spec.ts`, or `sidebar.spec.ts`.

## Debugging Failures

- **Screenshots** — Saved on failure in `test-results/`.
- **Trace viewer** — `npx playwright show-trace test-results/.../trace.zip`
- **Headed mode** — `npx playwright test --headed`
- **Debug mode** — `npx playwright test --debug` (step through)
- **Single test** — `npx playwright test -g "test name"`

## Config Notes

- `playwright.config.ts` uses `BASE_URL` from env or `http://localhost:3000`.
- Web server auto-starts when baseURL includes localhost.
- Chromium only; trace/screenshot/video on first retry or failure.

For detailed selector patterns and examples, see [patterns.md](patterns.md).
