/**
 * Typed data-access adapter for the refunds upstream. This is the only module that
 * knows the wire contract, transport, auth header and failure semantics; swapping the
 * mock for a real provider means changing this file + contract.ts, not the UI/domain.
 */
import type { CreatedRange, Currency, Refund, RefundStatus } from "@/lib/domain/refunds";
import { rangeStart } from "@/lib/domain/refunds";
import { toDomainRefund, wireErrorSchema, wireListSchema, wireRefundSchema } from "./contract";
import type { MockScenario } from "./mockServer";

export type RefundsApiErrorKind = "TIMEOUT" | "UNAVAILABLE" | "UPSTREAM_ERROR" | "INVALID_RESPONSE" | "NOT_FOUND" | "BAD_REQUEST" | "UNAUTHORIZED";

const RETRYABLE: ReadonlySet<RefundsApiErrorKind> = new Set(["TIMEOUT", "UNAVAILABLE", "UPSTREAM_ERROR"]);

export class RefundsApiError extends Error {
  constructor(
    readonly kind: RefundsApiErrorKind,
    message: string,
    readonly details: { status?: number; requestId?: string; retryAfterSeconds?: number } = {},
  ) {
    super(message);
    this.name = "RefundsApiError";
  }
  get retryable() {
    return RETRYABLE.has(this.kind);
  }
}

export interface RefundListFilters {
  status?: RefundStatus;
  currency?: Currency;
  createdGte?: Date;
}

export interface RefundsApiConfig {
  baseUrl: string;
  token: string;
  timeoutMs?: number;
  /** Demo/test only: forwarded to the mock as X-Mock-Scenario. */
  scenario?: MockScenario;
  fetchImpl?: typeof fetch;
  pageLimit?: number;
  /** Safety valve against runaway pagination. */
  maxPages?: number;
}

export interface RefundsApiClient {
  listAllRefunds(filters: RefundListFilters): Promise<Refund[]>;
  getRefund(id: string): Promise<Refund | null>;
}

export const DEFAULT_TIMEOUT_MS = 4000;

export function createRefundsApiClient(config: RefundsApiConfig): RefundsApiClient {
  const { baseUrl, token, timeoutMs = DEFAULT_TIMEOUT_MS, scenario, pageLimit = 100, maxPages = 50 } = config;
  const doFetch = config.fetchImpl ?? fetch;

  async function request(path: string): Promise<unknown> {
    const headers: Record<string, string> = { authorization: `Bearer ${token}`, accept: "application/json" };
    if (scenario && scenario !== "ok") headers["x-mock-scenario"] = scenario;
    let res: Response;
    try {
      res = await doFetch(`${baseUrl.replace(/\/$/, "")}${path}`, { headers, cache: "no-store", signal: AbortSignal.timeout(timeoutMs) });
    } catch (e) {
      const name = (e as Error)?.name;
      if (name === "TimeoutError" || name === "AbortError") {
        throw new RefundsApiError("TIMEOUT", `The finance service did not respond within ${Math.round(timeoutMs / 1000)}s.`);
      }
      throw new RefundsApiError("UNAVAILABLE", "Could not connect to the finance service.");
    }

    let body: unknown;
    try {
      body = await res.json();
    } catch {
      if (res.ok) throw new RefundsApiError("INVALID_RESPONSE", "The finance service returned an unreadable response.", { status: res.status });
      body = null;
    }

    if (!res.ok) {
      const parsed = wireErrorSchema.safeParse(body);
      const requestId = parsed.success ? parsed.data.error.request_id : undefined;
      const upstreamMsg = parsed.success ? parsed.data.error.message : `HTTP ${res.status}`;
      const details = { status: res.status, requestId };
      if (res.status === 404) throw new RefundsApiError("NOT_FOUND", upstreamMsg, details);
      if (res.status === 400) throw new RefundsApiError("BAD_REQUEST", upstreamMsg, details);
      if (res.status === 401 || res.status === 403) throw new RefundsApiError("UNAUTHORIZED", "The dashboard is not authorized to read from the finance service.", details);
      if (res.status === 503 || res.status === 502) {
        const retryAfter = Number(res.headers.get("retry-after"));
        throw new RefundsApiError("UNAVAILABLE", "The finance service is temporarily unavailable.", { ...details, retryAfterSeconds: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter : undefined });
      }
      if (res.status === 504) throw new RefundsApiError("TIMEOUT", "The finance service timed out.", details);
      throw new RefundsApiError("UPSTREAM_ERROR", "The finance service returned an error.", details);
    }
    return body;
  }

  return {
    async listAllRefunds(filters) {
      const base = new URLSearchParams({ limit: String(pageLimit) });
      if (filters.status) base.set("status", filters.status.toLowerCase());
      if (filters.currency) base.set("currency", filters.currency.toLowerCase());
      if (filters.createdGte) base.set("created_gte", filters.createdGte.toISOString());
      const out: Refund[] = [];
      let cursor: string | null = null;
      for (let page = 0; page < maxPages; page++) {
        const qs = new URLSearchParams(base);
        if (cursor) qs.set("starting_after", cursor);
        const parsed = wireListSchema.safeParse(await request(`/refunds?${qs}`));
        if (!parsed.success) throw new RefundsApiError("INVALID_RESPONSE", "The finance service returned data in an unexpected format.");
        out.push(...parsed.data.data.map(toDomainRefund));
        if (!parsed.data.has_more || !parsed.data.next_cursor) return out;
        cursor = parsed.data.next_cursor;
      }
      throw new RefundsApiError("INVALID_RESPONSE", "The finance service returned more pages than expected.");
    },

    async getRefund(id) {
      try {
        const parsed = wireRefundSchema.safeParse(await request(`/refunds/${encodeURIComponent(id)}`));
        if (!parsed.success) throw new RefundsApiError("INVALID_RESPONSE", "The finance service returned data in an unexpected format.");
        return toDomainRefund(parsed.data);
      } catch (e) {
        if (e instanceof RefundsApiError && e.kind === "NOT_FOUND") return null;
        throw e;
      }
    },
  };
}

export function rangeToFilter(range: CreatedRange, now: Date): Date | undefined {
  return rangeStart(range, now) ?? undefined;
}
