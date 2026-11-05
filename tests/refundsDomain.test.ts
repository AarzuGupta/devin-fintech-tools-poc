import { describe, expect, it } from "vitest";
import {
  computeRefundMetrics,
  formatMoney,
  matchesSearch,
  paginate,
  rangeStart,
  sortRefunds,
  type Refund,
} from "@/lib/domain/refunds";

const NOW = new Date("2026-11-05T16:00:00.000Z");
const daysAgo = (d: number) => new Date(NOW.getTime() - d * 86_400_000);

function refund(overrides: Partial<Refund>): Refund {
  return {
    id: "RFD-0",
    transactionId: "TXN-0",
    customerId: "CUS-0",
    customerName: "Test Customer",
    originalAmountMinor: 10_000,
    refundAmountMinor: 10_000,
    currency: "USD",
    reason: "CUSTOMER_REQUEST",
    status: "SUCCEEDED",
    createdAt: daysAgo(10),
    completedAt: daysAgo(9),
    paymentMethod: "Visa debit •••• 1234",
    product: "Debit card",
    initiatedBy: "support:Test",
    failureReason: null,
    events: [],
    ...overrides,
  };
}

const FIXTURE: Refund[] = [
  refund({ id: "RFD-1", status: "SUCCEEDED", refundAmountMinor: 1_050, currency: "USD", createdAt: daysAgo(1) }),
  refund({ id: "RFD-2", status: "SUCCEEDED", refundAmountMinor: 2_000, currency: "USD", createdAt: daysAgo(20) }),
  refund({ id: "RFD-3", status: "SUCCEEDED", refundAmountMinor: 999, currency: "EUR", createdAt: daysAgo(3) }),
  refund({ id: "RFD-4", status: "PENDING", refundAmountMinor: 500, currency: "USD", createdAt: daysAgo(0.5), completedAt: null }),
  refund({ id: "RFD-5", status: "PROCESSING", refundAmountMinor: 700, currency: "GBP", createdAt: daysAgo(2), completedAt: null }),
  refund({ id: "RFD-6", status: "FAILED", refundAmountMinor: 300, currency: "USD", createdAt: daysAgo(8) }),
  refund({ id: "RFD-7", status: "CANCELED", refundAmountMinor: 400, currency: "USD", createdAt: daysAgo(6.99) }),
];

describe("computeRefundMetrics", () => {
  const m = computeRefundMetrics(FIXTURE, NOW);

  it("sums only SUCCEEDED refunds, per currency, in minor units", () => {
    expect(m.refunded).toEqual({ count: 3, amount: { USD: 3_050, EUR: 999 } });
  });

  it("counts PENDING + PROCESSING as in flight and FAILED separately", () => {
    expect(m.inFlight).toEqual({ count: 2, amount: { USD: 500, GBP: 700 } });
    expect(m.failed).toEqual({ count: 1, amount: { USD: 300 } });
  });

  it("recent volume covers every status created within the last 7 days", () => {
    // RFD-1, 3, 4, 5, 7 (6.99 days); RFD-6 (8 days) and RFD-2 are outside.
    expect(m.recent).toEqual({ count: 5, amount: { USD: 1_950, EUR: 999, GBP: 700 } });
  });

  it("status counts partition the input", () => {
    expect(m.byStatus).toEqual({ PENDING: 1, PROCESSING: 1, SUCCEEDED: 3, FAILED: 1, CANCELED: 1 });
    expect(Object.values(m.byStatus).reduce((a, b) => a + b, 0)).toBe(m.count);
  });

  it("returns zeroed metrics for an empty set", () => {
    const empty = computeRefundMetrics([], NOW);
    expect(empty.count).toBe(0);
    expect(empty.refunded).toEqual({ count: 0, amount: {} });
  });
});

describe("search, sort, paginate", () => {
  it("searches refund, transaction and customer identifiers case-insensitively", () => {
    const r = refund({ id: "RFD-30001", transactionId: "TXN-ABC", customerId: "CUS-400100", customerName: "Amara Okafor" });
    for (const q of ["rfd-30001", "txn-abc", "400100", "okafor"]) expect(matchesSearch(r, q)).toBe(true);
    expect(matchesSearch(r, "nomatch")).toBe(false);
    expect(matchesSearch(r, undefined)).toBe(true);
  });

  it("sorts by created date and keeps a deterministic id tie-break", () => {
    expect(sortRefunds(FIXTURE, "createdAt", "desc").map((r) => r.id)).toEqual(["RFD-4", "RFD-1", "RFD-5", "RFD-3", "RFD-7", "RFD-6", "RFD-2"]);
    expect(sortRefunds(FIXTURE, "createdAt", "asc")[0].id).toBe("RFD-2");
  });

  it("sorts amounts within currency groups rather than across currencies", () => {
    expect(sortRefunds(FIXTURE, "refundAmount", "asc").map((r) => r.id)).toEqual(["RFD-3", "RFD-5", "RFD-6", "RFD-7", "RFD-4", "RFD-1", "RFD-2"]);
  });

  it("puts incomplete refunds last when sorting by completion date ascending", () => {
    const ids = sortRefunds(FIXTURE, "completedAt", "asc").map((r) => r.id);
    expect(ids.slice(-2).sort()).toEqual(["RFD-4", "RFD-5"]);
  });

  it("paginates and clamps out-of-range pages", () => {
    const items = Array.from({ length: 53 }, (_, i) => i);
    expect(paginate(items, 1, 25)).toMatchObject({ page: 1, pageCount: 3, total: 53, start: 0 });
    expect(paginate(items, 3, 25).items).toEqual([50, 51, 52]);
    expect(paginate(items, 99, 25).page).toBe(3);
    expect(paginate([], 1, 25)).toMatchObject({ page: 1, pageCount: 1, total: 0 });
  });

  it("computes created-range lower bounds", () => {
    expect(rangeStart("7d", NOW)).toEqual(daysAgo(7));
    expect(rangeStart("all", NOW)).toBeNull();
  });
});

describe("formatMoney", () => {
  it("formats integer minor units exactly", () => {
    expect(formatMoney(123_456_789, "USD")).toBe("$1,234,567.89");
    expect(formatMoney(5, "EUR")).toBe("€0.05");
    expect(formatMoney(100, "GBP")).toBe("£1.00");
    // 0.1 + 0.2 style float drift cannot occur: totals are integer sums.
    expect(formatMoney(10 + 20, "USD")).toBe("$0.30");
  });
});
