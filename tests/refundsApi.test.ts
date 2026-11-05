import { describe, expect, it } from "vitest";
import { RefundsApiError } from "@/lib/integrations/refundsApi/client";
import { MOCK_REFUNDS } from "@/lib/integrations/refundsApi/mockData";
import { handleGetRefund, handleListRefunds } from "@/lib/integrations/refundsApi/mockServer";
import { mockFetch, testClient, upstreamRequest, MOCK_BASE } from "./refundsHelpers";

async function expectApiError(p: Promise<unknown>, kind: RefundsApiError["kind"]) {
  const err = await p.then(() => null, (e) => e);
  expect(err).toBeInstanceOf(RefundsApiError);
  expect((err as RefundsApiError).kind).toBe(kind);
  return err as RefundsApiError;
}

describe("mock refunds upstream", () => {
  it("is deterministic and stores integer minor units", () => {
    expect(MOCK_REFUNDS).toHaveLength(120);
    expect(MOCK_REFUNDS[0].id).toBe("RFD-30001");
    for (const r of MOCK_REFUNDS) {
      expect(Number.isInteger(r.amount) && Number.isInteger(r.original_amount)).toBe(true);
      expect(r.amount).toBeLessThanOrEqual(r.original_amount);
      expect(r.completed_at === null).toBe(r.status === "pending" || r.status === "processing");
    }
  });

  it("rejects requests without the service token", async () => {
    const res = await handleListRefunds(new Request(`${MOCK_BASE}/refunds`));
    expect(res.status).toBe(401);
    const wrong = await handleGetRefund(new Request(`${MOCK_BASE}/refunds/RFD-30001`, { headers: { authorization: "Bearer nope" } }), "RFD-30001");
    expect(wrong.status).toBe(401);
  });

  it("pages with a cursor without gaps or duplicates", async () => {
    const seen: string[] = [];
    let cursor: string | null = null;
    do {
      const res = await handleListRefunds(upstreamRequest(`/refunds?limit=50${cursor ? `&starting_after=${cursor}` : ""}`));
      const body = await res.json();
      seen.push(...body.data.map((r: { id: string }) => r.id));
      cursor = body.next_cursor;
    } while (cursor);
    expect(seen).toHaveLength(120);
    expect(new Set(seen).size).toBe(120);
  });

  it("filters by status and currency upstream", async () => {
    const body = await (await handleListRefunds(upstreamRequest("/refunds?status=failed&currency=usd&limit=100"))).json();
    const expected = MOCK_REFUNDS.filter((r) => r.status === "failed" && r.currency === "usd").length;
    expect(body.data).toHaveLength(expected);
    expect(expected).toBeGreaterThan(0);
  });

  it("returns 400 for invalid parameters and 404 for unknown refunds", async () => {
    expect((await handleListRefunds(upstreamRequest("/refunds?status=bogus"))).status).toBe(400);
    expect((await handleListRefunds(upstreamRequest("/refunds?limit=1000"))).status).toBe(400);
    expect((await handleGetRefund(upstreamRequest("/refunds/RFD-0"), "RFD-0")).status).toBe(404);
  });

  it("simulates an unavailable upstream with 503 + Retry-After", async () => {
    const res = await handleListRefunds(upstreamRequest("/refunds", { "x-mock-scenario": "unavailable" }));
    expect(res.status).toBe(503);
    expect(res.headers.get("retry-after")).toBe("30");
  });
});

describe("refunds adapter", () => {
  it("fetches every page and maps the wire contract to domain refunds", async () => {
    const refunds = await testClient({ pageLimit: 40 }).listAllRefunds({});
    expect(refunds).toHaveLength(120);
    const first = refunds.find((r) => r.id === "RFD-30001")!;
    const wire = MOCK_REFUNDS[0];
    expect(first.refundAmountMinor).toBe(wire.amount);
    expect(first.currency).toBe(wire.currency.toUpperCase());
    expect(first.createdAt).toBeInstanceOf(Date);
    expect(first.events[0].type).toBe("CREATED");
  });

  it("passes filters through to the upstream", async () => {
    const createdGte = new Date("2026-10-29T16:00:00.000Z");
    const refunds = await testClient().listAllRefunds({ status: "SUCCEEDED", currency: "EUR", createdGte });
    expect(refunds.length).toBeGreaterThan(0);
    expect(refunds.every((r) => r.status === "SUCCEEDED" && r.currency === "EUR" && r.createdAt >= createdGte)).toBe(true);
  });

  it("returns null for an unknown refund and the record for a known one", async () => {
    const client = testClient();
    expect(await client.getRefund("RFD-0")).toBeNull();
    expect((await client.getRefund("RFD-30002"))?.id).toBe("RFD-30002");
  });

  it("maps a 500 to a retryable UPSTREAM_ERROR with the request id", async () => {
    const err = await expectApiError(testClient({ scenario: "error" }).listAllRefunds({}), "UPSTREAM_ERROR");
    expect(err.retryable).toBe(true);
    expect(err.details).toMatchObject({ status: 500, requestId: "req_mock_api_error" });
  });

  it("maps a 503 to UNAVAILABLE with Retry-After", async () => {
    const err = await expectApiError(testClient({ scenario: "unavailable" }).getRefund("RFD-30001"), "UNAVAILABLE");
    expect(err.details.retryAfterSeconds).toBe(30);
  });

  it("maps connection failures to UNAVAILABLE", async () => {
    const refused: typeof fetch = async () => { throw new TypeError("fetch failed"); };
    await expectApiError(testClient({ fetchImpl: refused }).listAllRefunds({}), "UNAVAILABLE");
  });

  it("times out a stalled upstream instead of hanging", async () => {
    const started = Date.now();
    await expectApiError(testClient({ scenario: "timeout", timeoutMs: 150 }).listAllRefunds({}), "TIMEOUT");
    expect(Date.now() - started).toBeLessThan(2_000);
  });

  it("waits for a slow upstream that responds within the timeout", async () => {
    const refunds = await testClient({ scenario: "slow", timeoutMs: 3_000 }).listAllRefunds({ status: "FAILED" });
    expect(refunds.length).toBeGreaterThan(0);
  });

  it("times out a slow upstream that exceeds the timeout", async () => {
    await expectApiError(testClient({ scenario: "slow", timeoutMs: 100 }).listAllRefunds({}), "TIMEOUT");
  });

  it("rejects a contract-violating 200 response rather than rendering it", async () => {
    await expectApiError(testClient({ scenario: "malformed" }).listAllRefunds({}), "INVALID_RESPONSE");
  });

  it("surfaces a bad token as UNAUTHORIZED", async () => {
    await expectApiError(testClient({ token: "wrong" }).listAllRefunds({}), "UNAUTHORIZED");
  });

  it("uses the mock fetch bridge over the real handlers", async () => {
    const res = await mockFetch(`${MOCK_BASE}/refunds/RFD-30001`, { headers: { authorization: `Bearer ${process.env.REFUNDS_API_TOKEN}` } });
    expect(res.status).toBe(200);
  });
});
