# TurfStack E2E Selector Patterns

## Common Selectors for TurfStack UI

| Element | Selector |
|---------|----------|
| Sidebar nav items | `page.getByRole('link', { name: 'Overview' })` |
| Topbar role badge | `page.getByText('Owner').first()` |
| Form inputs | `page.getByLabel('Email')`, `page.getByLabel('Password')` |
| Buttons | `page.getByRole('button', { name: 'Sign In' })` |
| Toast messages | `page.getByText('Profile updated')` |
| Card titles | `page.getByText('Your Profile')` |
| Status badges | `page.locator('.rounded-full').getByText('Active')` or `locator("span").filter({ hasText: /Active\|Inactive/ })` |
| Form card (courts) | `page.locator(".border-emerald-200")` |
| Court cards grid | `page.locator("div.grid").last().locator("div[class*='hover:shadow-md']")` |
| Validation errors | `page.locator("p.text-xs.text-red-500").filter({ hasText: "..." })` |

---

## Example: Testing a CRUD Page

```typescript
import { test, expect } from "@playwright/test";
import { loginAs } from "./fixtures/auth";

test.describe("Courts Management", () => {
  test.beforeEach(async ({ page }) => {
    await loginAs(page, "owner");
    await page.goto("/dashboard/courts");
  });

  test("can add a new court", async ({ page }) => {
    await page.getByRole("button", { name: "Add Court" }).click();
    const formCard = page.locator(".border-emerald-200");
    await formCard.getByLabel("Court Name").fill("Test Court");
    await formCard.getByLabel("Sport").selectOption({ label: "Pickleball" });
    await formCard.getByLabel("Surface Type").fill("Synthetic");
    await formCard.getByPlaceholder("800").fill("1000");
    await formCard.getByRole("button", { name: "Create Court" }).click();
    await expect(page.getByText("Test Court")).toBeVisible({ timeout: 10_000 });
  });
});
```

---

## Example: Testing Form Validation

```typescript
test("shows validation error for empty email", async ({ page }) => {
  await page.goto("/login");
  await page.getByRole("button", { name: "New here? Create an account" }).click();
  await page.getByLabel("Full Name").fill("John Doe");
  await page.getByLabel("Email").fill("invalid-email");
  await page.getByLabel("Password").fill("password123");
  await page.getByRole("button", { name: "Create Account" }).click();
  await expect(
    page.locator("p.text-xs.text-red-500").filter({ hasText: "Enter a valid email address" })
  ).toBeVisible();
});
```

---

## Example: Handling Toasts

```typescript
test("save shows success toast", async ({ page }) => {
  await page.getByLabel("Full Name").fill("Updated Name");
  await page.getByRole("button", { name: "Save Changes" }).click();
  await expect(page.getByText("Profile updated")).toBeVisible({ timeout: 5000 });
});
```

---

## Example: Handling Confirm Dialogs

```typescript
test("cancel booking shows confirmation", async ({ page }) => {
  page.on("dialog", (dialog) => dialog.accept());
  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Booking cancelled")).toBeVisible();
});
```

---

## Example: Checking Role-Based Visibility

```typescript
import { SIDEBAR_ITEMS } from "./fixtures/test-data";

test("accountant cannot see Courts page", async ({ page }) => {
  await loginAs(page, "accountant");
  const sidebar = page.locator("div.bg-slate-900.text-white");
  const expectedItems = SIDEBAR_ITEMS.accountant;
  // Courts is not in accountant's sidebar
  await expect(sidebar.getByRole("link", { name: "Courts" })).not.toBeVisible();
});
```

---

## Example: Iterating Over Roles

```typescript
const roles = ["owner", "manager", "staff", "accountant", "player"] as const;

for (const role of roles) {
  test(`${role} sees expected sidebar items`, async ({ page }) => {
    await loginAs(page, role);
    const expectedItems = SIDEBAR_ITEMS[role];
    const sidebar = page.locator("div.bg-slate-900.text-white");
    for (const item of expectedItems) {
      await expect(sidebar.getByRole("link", { name: item })).toBeVisible();
    }
  });
}
```
