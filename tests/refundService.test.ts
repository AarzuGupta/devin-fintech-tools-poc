import { describe, expect, it, vi } from "vitest";
import { AppError } from "@/lib/errors";
import { computeRefundMetrics, RECENT_WINDOW_DAYS } from "@/lib/domain/refunds";
import { RefundsApiError, type RefundsApiClient } from "@/lib/integrations/refundsApi/client";
import { SEED_BASE_DATE } from "@/lib/seed/seedData";
import { getRefundDashboard, getRefundDetail } from "@/lib/services/refundService";
import { actors } from "./helpers";
import { testClient } from "./refundsHelpers";

const NOW = SEED_BASE_DATE;

function spyClient(): RefundsApiClient & { listAllRefunds: ReturnType<typeof vi.fn>; getRefund: ReturnType<typeof vi.fn> } {
  return { listAllRefunds: vi.fn(async () => []), getRefund: vi.fn(async () => null) };
}

async function expectAppError(p: Promise<unknown>, code: AppError["code"]) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(AppError);
  expect((err as AppError).code).toBe(code);
}

describe("refund read authorization", () => {
  it("rejects anonymous callers before contacting the upstream", async () => {
    const api = spyClient();
    await expectAppError(getRefundDashboard(api, null, {}, NOW), "UNAUTHENTICATED");
    await expectAppError(getRefundDetail(api, null, "RFD-30001"), "UNAUTHENTICATED");
    expect(api.listAllRefunds).not.toHaveBeenCalled();
    expect(api.getRefund).not.toHaveBeenCalled();
  });

  it.each(["viewer", "analyst", "admin"] as const)("allows %s to read", async (role) => {
    const result = await getRefundDashboard(testClient(), actors[role], { range: "all" }, NOW);
    expect(result.total).toBe(120);
  });
});

describe("refund dashboard", () => {
  it("metrics cover every matching refund, not just the visible page", async () => {
    const api = testClient();
    const result = await getRefundDashboard(api, actors.viewer, { range: "all" }, NOW);
    expect(result.items).toHaveLength(25);
    const all = await api.listAllRefunds({});
    expect(result.metrics).toEqual(computeRefundMetrics(all, NOW));
    const { byStatus } = result.metrics;
    expect(byStatus.PENDING + byStatus.PROCESSING).toBe(result.metrics.inFlight.count);
    expect(byStatus.SUCCEEDED).toBe(result.metrics.refunded.count);
    expect(byStatus.FAILED).toBe(result.metrics.failed.count);
    const recentFrom = NOW.getTime() - RECENT_WINDOW_DAYS * 86_400_000;
    expect(result.metrics.recent.count).toBe(all.filter((r) => r.createdAt.getTime() >= recentFrom).length);
  });

  it("applies status, currency, range and search filters to rows and metrics alike", async () => {
    const result = await getRefundDashboard(testClient(), actors.viewer, { status: "SUCCEEDED", currency: "USD", range: "90d" }, NOW);
    expect(result.total).toBeGreaterThan(0);
    expect(result.metrics.count).toBe(result.total);
    expect(result.metrics.refunded.count).toBe(result.total);
    expect(Object.keys(result.metrics.refunded.amount)).toEqual(["USD"]);

    const one = await getRefundDashboard(testClient(), actors.viewer, { q: "rfd-30007", range: "all" }, NOW);
    expect(one.items.map((r) => r.id)).toEqual(["RFD-30007"]);
    expect(one.metrics.count).toBe(1);
  });

  it("defaults to the last 30 days, newest first", async () => {
    const result = await getRefundDashboard(testClient(), actors.viewer, {}, NOW);
    expect(result.query).toMatchObject({ range: "30d", sort: "createdAt", dir: "desc", page: 1 });
    const from = NOW.getTime() - 30 * 86_400_000;
    expect(result.items.every((r) => r.createdAt.getTime() >= from)).toBe(true);
    const times = result.items.map((r) => r.createdAt.getTime());
    expect(times).toEqual([...times].sort((a, b) => b - a));
  });

  it("sorts and paginates on request", async () => {
    const p2 = await getRefundDashboard(testClient(), actors.viewer, { range: "all", sort: "id", dir: "asc", page: "2" }, NOW);
    expect(p2.page).toBe(2);
    expect(p2.items[0].id).toBe("RFD-30026");
  });

  it("falls back to safe defaults for malformed query input", async () => {
    const api = spyClient();
    const result = await getRefundDashboard(api, actors.viewer, { status: "DROP TABLE", currency: "XYZ", range: "1y", sort: "__proto__", dir: "up", page: "-4", q: "x".repeat(500) }, NOW);
    expect(result.query).toMatchObject({ status: undefined, currency: undefined, range: "30d", sort: "createdAt", dir: "desc", page: 1, q: undefined });
    expect(api.listAllRefunds).toHaveBeenCalledWith({ status: undefined, currency: undefined, createdGte: new Date(NOW.getTime() - 30 * 86_400_000) });
  });

  it("propagates upstream failures instead of returning empty or partial results", async () => {
    for (const scenario of ["error", "unavailable", "malformed"] as const) {
      const err = await getRefundDashboard(testClient({ scenario }), actors.viewer, {}, NOW).then(() => null, (e) => e);
      expect(err).toBeInstanceOf(RefundsApiError);
    }
  });

  it("validates refund ids before calling the upstream", async () => {
    const api = spyClient();
    await expectAppError(getRefundDetail(api, actors.viewer, "../../admin"), "VALIDATION");
    expect(api.getRefund).not.toHaveBeenCalled();
    expect((await getRefundDetail(testClient(), actors.viewer, "RFD-30003"))?.id).toBe("RFD-30003");
  });
});
