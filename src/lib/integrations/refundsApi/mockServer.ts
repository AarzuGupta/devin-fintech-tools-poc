/**
 * Local stand-in for an external finance service's refunds API. Served by
 * /api/mock-finance/v1/refunds. Fully deterministic, no network dependencies.
 *
 * Failure simulation (demo/test only) via the `X-Mock-Scenario` request header:
 *   ok | slow (succeeds after SLOW_MS) | timeout (stalls for STALL_MS) |
 *   error (500) | unavailable (503 + Retry-After) | malformed (200, contract-violating body)
 */
import { MOCK_REFUNDS } from "./mockData";

export const MOCK_SCENARIOS = ["ok", "slow", "timeout", "error", "unavailable", "malformed"] as const;
export type MockScenario = (typeof MOCK_SCENARIOS)[number];
export const SLOW_MS = 1200;
export const STALL_MS = 30_000;
export const MAX_LIMIT = 100;

const FILTERABLE_STATUSES = ["pending", "processing", "succeeded", "failed", "canceled"];
const FILTERABLE_CURRENCIES = ["usd", "eur", "gbp"];

export function expectedToken(): string {
  return process.env.REFUNDS_API_TOKEN ?? "";
}

function json(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return Response.json(body, { status, headers: { "cache-control": "no-store", ...headers } });
}

function error(status: number, type: string, message: string, extra: Record<string, unknown> = {}, headers: Record<string, string> = {}) {
  return json({ error: { type, message, request_id: `req_mock_${type}`, ...extra } }, status, headers);
}

function sleep(ms: number, signal: AbortSignal) {
  return new Promise<void>((resolve) => {
    if (signal.aborted) return resolve();
    const t = setTimeout(resolve, ms);
    signal.addEventListener("abort", () => { clearTimeout(t); resolve(); }, { once: true });
  });
}

/** Shared prelude: auth + scenario. Returns a Response to short-circuit, or null to continue. */
async function prelude(req: Request): Promise<Response | null> {
  const token = expectedToken();
  if (!token || req.headers.get("authorization") !== `Bearer ${token}`) {
    return error(401, "authentication_error", "Missing or invalid API token.");
  }
  const scenario = (req.headers.get("x-mock-scenario") ?? process.env.MOCK_REFUNDS_SCENARIO ?? "ok") as MockScenario;
  switch (scenario) {
    case "slow":
      await sleep(SLOW_MS, req.signal);
      return null;
    case "timeout":
      await sleep(STALL_MS, req.signal);
      return error(504, "gateway_timeout", "Upstream stalled.");
    case "error":
      return error(500, "api_error", "An internal error occurred in the finance service.");
    case "unavailable":
      return error(503, "service_unavailable", "Finance service is temporarily unavailable.", {}, { "retry-after": "30" });
    case "malformed":
      return json({ object: "list", data: [{ id: 42, amount: "12.50" }], has_more: false, next_cursor: null });
    default:
      return null;
  }
}

export async function handleListRefunds(req: Request): Promise<Response> {
  const early = await prelude(req);
  if (early) return early;
  const url = new URL(req.url);
  const p = url.searchParams;

  const status = p.get("status");
  if (status && !FILTERABLE_STATUSES.includes(status)) return error(400, "invalid_request_error", `Invalid status: ${status}`, { param: "status" });
  const currency = p.get("currency");
  if (currency && !FILTERABLE_CURRENCIES.includes(currency)) return error(400, "invalid_request_error", `Invalid currency: ${currency}`, { param: "currency" });
  const createdGte = p.get("created_gte");
  if (createdGte && Number.isNaN(Date.parse(createdGte))) return error(400, "invalid_request_error", "created_gte must be an ISO-8601 timestamp.", { param: "created_gte" });
  const limitRaw = p.get("limit") ?? "25";
  const limit = Number(limitRaw);
  if (!Number.isInteger(limit) || limit < 1 || limit > MAX_LIMIT) return error(400, "invalid_request_error", `limit must be an integer between 1 and ${MAX_LIMIT}.`, { param: "limit" });

  // Upstream order: newest first, id as tie-breaker. Cursor = last id of the previous page.
  const filtered = MOCK_REFUNDS.filter(
    (r) => (!status || r.status === status) && (!currency || r.currency === currency) && (!createdGte || Date.parse(r.created) >= Date.parse(createdGte)),
  ).sort((a, b) => Date.parse(b.created) - Date.parse(a.created) || a.id.localeCompare(b.id));

  const after = p.get("starting_after");
  let start = 0;
  if (after) {
    const idx = filtered.findIndex((r) => r.id === after);
    if (idx === -1) return error(400, "invalid_request_error", "Unknown cursor.", { param: "starting_after" });
    start = idx + 1;
  }
  const data = filtered.slice(start, start + limit);
  const hasMore = start + limit < filtered.length;
  return json({ object: "list", data, has_more: hasMore, next_cursor: hasMore ? data[data.length - 1].id : null });
}

export async function handleGetRefund(req: Request, id: string): Promise<Response> {
  const early = await prelude(req);
  if (early) return early;
  const record = MOCK_REFUNDS.find((r) => r.id === id);
  if (!record) return error(404, "not_found", `No such refund: ${id}`);
  return json(record);
}
