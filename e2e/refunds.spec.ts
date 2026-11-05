import { expect, test, type Page } from "@playwright/test";

async function signInAs(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Continue as ${name}` }).click();
  await page.waitForURL("**/kyc");
  await page.waitForLoadState("networkidle");
}

const rows = (page: Page) => page.locator("tbody tr[data-row-id]");

test("viewer filters, sorts, pages and opens a refund; state survives reload", async ({ page }) => {
  await signInAs(page, "Priya Shah");
  await page.getByRole("link", { name: "Refunds" }).click();
  await page.waitForURL("**/refunds");
  await expect(page.getByRole("heading", { name: "Refunds", level: 1 })).toBeVisible();
  await page.waitForLoadState("networkidle");

  // Whole deterministic dataset (120 synthetic refunds) across 5 pages of 25.
  await page.getByLabel("Created").selectOption("all");
  await page.waitForURL(/range=all/);
  await expect(page.getByTestId("pagination-range")).toHaveText("1–25 of 120");
  await expect(page.getByTestId("metric-failed")).toContainText("21");
  await page.getByRole("button", { name: "Next page" }).click();
  await page.waitForURL(/page=2/);
  await expect(page.getByTestId("pagination-range")).toHaveText("26–50 of 120");

  // Filtering resets pagination; metrics and table agree.
  await page.getByLabel("Status").selectOption("FAILED");
  await page.waitForURL(/status=FAILED/);
  await expect(page).not.toHaveURL(/page=2/);
  await expect(page.getByTestId("pagination-range")).toHaveText("1–21 of 21");
  await expect(page.getByTestId("metric-failed")).toContainText("21");
  await expect(page.getByTestId("metric-refunded")).toContainText("0 succeeded");
  await expect(rows(page)).toHaveCount(21);
  for (const status of await rows(page).locator("td:nth-child(8)").allInnerTexts()) expect(status.trim()).toBe("Failed");

  // Sort by refund amount ascending.
  await page.getByRole("button", { name: "Refund", exact: true }).click();
  await page.waitForURL(/sort=refundAmount/);
  await expect(page.getByRole("columnheader", { name: "Refund", exact: true })).toHaveAttribute("aria-sort", /ascending|descending/);

  // Open the first refund: history and failure context are shown, read-only.
  const first = rows(page).first();
  const refundId = (await first.getAttribute("data-row-id"))!;
  await first.click();
  await page.waitForURL(new RegExp(`refund=${refundId}`));
  const panel = page.getByTestId("refund-panel");
  await expect(panel.getByRole("heading", { name: refundId })).toBeVisible();
  await expect(panel.getByTestId("refund-history")).toContainText("Refund failed");
  await expect(panel).toContainText("cannot create, retry or cancel them");

  // URL state survives a full reload in the production build.
  await page.reload();
  await expect(page).toHaveURL(/status=FAILED/);
  await expect(page).toHaveURL(/sort=refundAmount/);
  await expect(panel.getByRole("heading", { name: refundId })).toBeVisible();
  await expect(page.getByTestId("pagination-range")).toHaveText("1–21 of 21");

  await panel.getByRole("link", { name: "Close refund details" }).click();
  await expect(panel).toBeHidden();
});

test("unavailable upstream shows an explicit error with no figures; anonymous access is refused", async ({ page, request }) => {
  await signInAs(page, "Marcus Lee");
  await page.goto("/refunds?simulate=unavailable");
  const error = page.getByTestId("upstream-error");
  await expect(error).toContainText("Finance service unavailable");
  await expect(error).toContainText("Suggested retry in 30s");
  await expect(page.getByTestId("metric-refunded")).toHaveCount(0);
  await expect(rows(page)).toHaveCount(0);
  await expect(page.getByTestId("pagination-range")).toHaveCount(0);

  // Retry re-requests; with the scenario still active the error stays (no stale or false success).
  await error.getByRole("button", { name: "Retry" }).click();
  await expect(page.getByTestId("upstream-error")).toContainText("Finance service unavailable");

  // Removing the simulation recovers on the next load.
  await page.goto("/refunds");
  await expect(page.getByTestId("metric-refunded")).toBeVisible();
  await expect(page.getByTestId("upstream-error")).toHaveCount(0);

  // Anonymous: page redirects to sign-in, and the mock API rejects calls without the server token.
  await page.context().clearCookies();
  await page.goto("/refunds");
  await expect(page).toHaveURL(/\/sign-in/);
  const api = await request.get("/api/mock-finance/v1/refunds");
  expect(api.status()).toBe(401);
});
