import { createRefundsApiClient, type RefundsApiConfig } from "@/lib/integrations/refundsApi/client";
import { handleGetRefund, handleListRefunds } from "@/lib/integrations/refundsApi/mockServer";

export const MOCK_BASE = "http://mock.local/api/mock-finance/v1";

/**
 * Routes adapter HTTP calls straight into the mock route handlers (same contract, no socket).
 * Like real fetch, rejects with the signal's reason when the request is aborted.
 */
export const mockFetch: typeof fetch = async (input, init) => {
  const req = new Request(String(input), init);
  const match = new URL(req.url).pathname.match(/\/refunds\/([^/]+)$/);
  const response = match ? handleGetRefund(req, decodeURIComponent(match[1])) : handleListRefunds(req);
  const signal = init?.signal;
  if (!signal) return response;
  const aborted = new Promise<never>((_, reject) => {
    if (signal.aborted) reject(signal.reason);
    signal.addEventListener("abort", () => reject(signal.reason), { once: true });
  });
  return Promise.race([response, aborted]);
};

export function testClient(overrides: Partial<RefundsApiConfig> = {}) {
  return createRefundsApiClient({ baseUrl: MOCK_BASE, token: process.env.REFUNDS_API_TOKEN!, fetchImpl: mockFetch, ...overrides });
}

export function upstreamRequest(path: string, headers: Record<string, string> = {}) {
  return new Request(`${MOCK_BASE}${path}`, { headers: { authorization: `Bearer ${process.env.REFUNDS_API_TOKEN}`, ...headers } });
}
