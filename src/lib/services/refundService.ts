import { z } from "zod";
import type { Actor } from "@/lib/auth/roles";
import { requirePermission } from "@/lib/auth/permissions";
import { AppError } from "@/lib/errors";
import {
  CREATED_RANGES,
  CURRENCIES,
  DEFAULT_RANGE,
  REFUND_SORT_FIELDS,
  REFUND_STATUSES,
  computeRefundMetrics,
  matchesSearch,
  paginate,
  rangeStart,
  sortRefunds,
} from "@/lib/domain/refunds";
import type { RefundsApiClient } from "@/lib/integrations/refundsApi/client";

/** URL query → validated dashboard query. Unknown or malformed values fall back to defaults. */
export const refundQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined).transform((v) => v || undefined),
  status: z.enum(REFUND_STATUSES).optional().catch(undefined),
  currency: z.enum(CURRENCIES).optional().catch(undefined),
  range: z.enum(CREATED_RANGES).default(DEFAULT_RANGE).catch(DEFAULT_RANGE),
  sort: z.enum(REFUND_SORT_FIELDS).default("createdAt").catch("createdAt"),
  dir: z.enum(["asc", "desc"]).default("desc").catch("desc"),
  page: z.coerce.number().int().min(1).max(10_000).default(1).catch(1),
});
export type RefundQuery = z.output<typeof refundQuerySchema>;

const refundIdSchema = z.string().regex(/^[A-Za-z0-9_-]{1,64}$/);

/**
 * List + metrics for the dashboard. Metrics are computed over every refund matching
 * the filters (status, currency, created range, search) — the same set the table
 * paginates — as of `now`. Upstream failures propagate as RefundsApiError; nothing is cached.
 */
export async function getRefundDashboard(api: RefundsApiClient, actor: Actor | null, rawQuery: unknown = {}, now: Date = new Date()) {
  requirePermission(actor, "refunds:read");
  const query = refundQuerySchema.parse(rawQuery ?? {});
  const fetched = await api.listAllRefunds({
    status: query.status,
    currency: query.currency,
    createdGte: rangeStart(query.range, now) ?? undefined,
  });
  const matching = fetched.filter((r) => matchesSearch(r, query.q));
  const metrics = computeRefundMetrics(matching, now);
  const page = paginate(sortRefunds(matching, query.sort, query.dir), query.page);
  return { query, metrics, asOf: now, ...page };
}

export async function getRefundDetail(api: RefundsApiClient, actor: Actor | null, refundId: string) {
  requirePermission(actor, "refunds:read");
  if (!refundIdSchema.safeParse(refundId).success) throw new AppError("VALIDATION", "Invalid refund ID.");
  return api.getRefund(refundId);
}
