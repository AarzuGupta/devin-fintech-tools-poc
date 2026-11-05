import { expect, test, type Page } from "@playwright/test";

async function signInAs(page: Page, name: string) {
  await page.goto("/sign-in");
  await page.getByRole("button", { name: `Continue as ${name}` }).click();
  await page.waitForURL("**/kyc");
  // Wait for hydration so client-side controls are interactive.
  await page.waitForLoadState("networkidle");
}

test("analyst rejects a pending case; decision persists after reload and appears in the audit log", async ({ page }) => {
  await signInAs(page, "Marcus Lee");

  await page.getByLabel("Status").selectOption("PENDING");
  await page.waitForURL(/status=PENDING/);
  const firstRow = page.locator("tbody tr[data-row-id]").first();
  const caseId = (await firstRow.getAttribute("data-row-id"))!;
  await firstRow.click();
  await page.waitForURL(new RegExp(`case=${caseId}`));
  await expect(page).toHaveURL(/status=PENDING/);

  const panel = page.getByTestId("case-panel");
  await expect(panel.getByRole("heading", { name: caseId })).toBeVisible();
  await expect(panel.getByTestId("status-badge")).toHaveText("Pending");

  await panel.getByRole("button", { name: "Reject" }).click();
  const dialog = page.getByRole("alertdialog");
  const confirm = dialog.getByRole("button", { name: "Confirm reject" });
  await expect(confirm).toBeDisabled();
  const reason = `E2E: identity document expired; customer unresponsive (${caseId}).`;
  await dialog.getByRole("textbox").fill(reason);
  await confirm.click();

  await expect(page.locator(".fui-ToastTitle", { hasText: `${caseId} rejected` })).toBeVisible();
  await expect(panel.getByTestId("status-badge")).toHaveText("Rejected");

  await page.goto(`/kyc?case=${caseId}`);
  await page.reload();
  await expect(panel.getByTestId("status-badge")).toHaveText("Rejected");
  await expect(panel.getByTestId("decision-readonly")).toContainText("finalized");
  const history = panel.getByTestId("decision-history");
  await expect(history).toContainText("Pending → Rejected");
  await expect(history).toContainText("Marcus Lee");
  await expect(history).toContainText(reason);

  // Analysts cannot see the global audit log; admins can, and it contains the decision.
  await page.goto("/audit");
  await expect(page.getByRole("alert").filter({ hasText: "admins only" })).toBeVisible();

  await page.getByRole("button", { name: /Demo identity/ }).click();
  await page.getByRole("menuitemradio", { name: /Jordan Blake/ }).click();
  await page.waitForURL("**/kyc");
  await page.goto("/audit");
  await page.waitForLoadState("networkidle");
  await page.getByLabel("Search audit events").fill(caseId);
  await page.waitForURL(new RegExp(`q=${caseId}`));
  const row = page.locator("tbody tr").first();
  await expect(row).toContainText(caseId);
  await expect(row).toContainText("REJECT");
  await expect(row).toContainText("Marcus Lee");
});

test("viewer has read-only access and anonymous users are redirected", async ({ page, context }) => {
  await context.clearCookies();
  await page.goto("/kyc");
  await expect(page).toHaveURL(/\/sign-in/);

  await signInAs(page, "Priya Shah");
  await page.locator("tbody tr[data-row-id]").first().click();
  const panel = page.getByTestId("case-panel");
  await expect(panel).toBeVisible();
  await expect(panel.getByRole("button", { name: "Approve" })).toHaveCount(0);
  await expect(panel.getByTestId("decision-readonly")).toBeVisible();
});

test("analysts cannot approve high-risk cases but can still escalate; admins can approve them", async ({ page }) => {
  await signInAs(page, "Elena Rossi");

  await page.goto("/kyc?status=PENDING&risk=MEDIUM");
  const mediumRow = page.locator("tbody tr[data-row-id]").first();
  const mediumId = (await mediumRow.getAttribute("data-row-id"))!;
  await mediumRow.click();
  await page.waitForURL(new RegExp(`case=${mediumId}`));
  const panel = page.getByTestId("case-panel");
  await expect(panel.getByRole("heading", { name: mediumId })).toBeVisible();
  await expect(panel.getByRole("button", { name: "Approve" })).toBeEnabled();
  await expect(panel.getByTestId("approval-restriction")).toHaveCount(0);

  await page.goto("/kyc?status=PENDING&risk=HIGH");
  const rows = page.locator("tbody tr[data-row-id]");
  const analystCaseId = (await rows.first().getAttribute("data-row-id"))!;
  const adminCaseId = (await rows.last().getAttribute("data-row-id"))!;
  expect(analystCaseId).not.toBe(adminCaseId);
  await rows.first().click();
  await page.waitForURL(new RegExp(`case=${analystCaseId}`));
  await expect(panel.getByRole("heading", { name: analystCaseId })).toBeVisible();
  const approve = panel.getByRole("button", { name: "Approve" });
  await expect(approve).toBeDisabled();
  await expect(approve).toHaveAttribute("aria-describedby", "approval-restriction");
  await expect(panel.getByTestId("approval-restriction")).toHaveText(
    "High-risk cases can only be approved by an admin. You can reject or escalate it.",
  );
  await approve.click({ force: true });
  await expect(page.getByRole("alertdialog")).toHaveCount(0);

  await panel.getByRole("button", { name: "Escalate" }).click();
  const dialog = page.getByRole("alertdialog");
  await dialog.getByRole("textbox").fill(`E2E: high-risk case needs admin approval (${analystCaseId}).`);
  await dialog.getByRole("button", { name: "Confirm escalate" }).click();
  await expect(panel.getByTestId("status-badge")).toHaveText("Escalated");

  await page.getByRole("button", { name: /Demo identity/ }).click();
  await page.getByRole("menuitemradio", { name: /Jordan Blake/ }).click();
  await page.waitForURL("**/kyc");
  await page.goto(`/kyc?case=${adminCaseId}`);
  await expect(panel.getByRole("heading", { name: adminCaseId })).toBeVisible();
  await expect(panel.getByTestId("approval-restriction")).toHaveCount(0);
  await panel.getByRole("button", { name: "Approve" }).click();
  await page.getByRole("alertdialog").getByRole("button", { name: "Confirm approve" }).click();
  await expect(panel.getByTestId("status-badge")).toHaveText("Approved");
  await page.reload();
  await expect(panel.getByTestId("decision-history")).toContainText("Pending → Approved");
  await expect(panel.getByTestId("decision-history")).toContainText("Jordan Blake");
});
