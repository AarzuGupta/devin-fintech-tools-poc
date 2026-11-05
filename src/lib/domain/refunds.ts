/**
 * Refund domain rules: statuses, money, metrics, search/sort/pagination.
 * Pure functions over the adapter's `Refund` type; no I/O.
 */

export const REFUND_STATUSES = ["PENDING", "PROCESSING", "SUCCEEDED", "FAILED", "CANCELED"] as const;
export type RefundStatus = (typeof REFUND_STATUSES)[number];

export const CURRENCIES = ["USD", "EUR", "GBP"] as const;
export type Currency = (typeof CURRENCIES)[number];

export const REFUND_REASONS = [
  "DUPLICATE_CHARGE",
  "CUSTOMER_REQUEST",
  "FRAUDULENT",
  "PRODUCT_NOT_RECEIVED",
  "SERVICE_CANCELED",
  "BILLING_ERROR",
] as const;
export type RefundReason = (typeof REFUND_REASONS)[number];

export const CREATED_RANGES = ["7d", "30d", "90d", "all"] as const;
export type CreatedRange = (typeof CREATED_RANGES)[number];
export const DEFAULT_RANGE: CreatedRange = "30d";

/** Window for the "recent volume" metric, relative to the data timestamp. */
export const RECENT_WINDOW_DAYS = 7;

export const PAGE_SIZE = 25;

export interface RefundEvent {
  type: "CREATED" | "PROCESSING" | "SUCCEEDED" | "FAILED" | "CANCELED";
  at: Date;
  note: string | null;
}

export interface Refund {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  originalAmountMinor: number;
  refundAmountMinor: number;
  currency: Currency;
  reason: RefundReason;
  status: RefundStatus;
  createdAt: Date;
  completedAt: Date | null;
  paymentMethod: string;
  product: string;
  initiatedBy: string;
  failureReason: string | null;
  events: RefundEvent[];
}

export const IN_FLIGHT_STATUSES: readonly RefundStatus[] = ["PENDING", "PROCESSING"];
export const TERMINAL_STATUSES: readonly RefundStatus[] = ["SUCCEEDED", "FAILED", "CANCELED"];

export function isTerminal(status: RefundStatus): boolean {
  return TERMINAL_STATUSES.includes(status);
}

const DAY_MS = 86_400_000;

/** Inclusive lower bound for a created-date range, or null for all time. */
export function rangeStart(range: CreatedRange, now: Date): Date | null {
  if (range === "all") return null;
  const days = { "7d": 7, "30d": 30, "90d": 90 }[range];
  return new Date(now.getTime() - days * DAY_MS);
}

export type MoneyByCurrency = Partial<Record<Currency, number>>;

function addMoney(totals: MoneyByCurrency, currency: Currency, minor: number) {
  totals[currency] = (totals[currency] ?? 0) + minor;
}

export interface RefundMetrics {
  /** Number of refunds the metrics were computed over. */
  count: number;
  /** Sum of refund amounts with status SUCCEEDED, per currency (never mixed). */
  refunded: { count: number; amount: MoneyByCurrency };
  /** PENDING + PROCESSING. */
  inFlight: { count: number; amount: MoneyByCurrency };
  failed: { count: number; amount: MoneyByCurrency };
  /** Any status, created within RECENT_WINDOW_DAYS before `now`. */
  recent: { count: number; amount: MoneyByCurrency };
  byStatus: Record<RefundStatus, number>;
}

/** Metrics over exactly the refunds passed in (the caller decides the scope). */
export function computeRefundMetrics(refunds: readonly Refund[], now: Date): RefundMetrics {
  const recentFrom = now.getTime() - RECENT_WINDOW_DAYS * DAY_MS;
  const m: RefundMetrics = {
    count: refunds.length,
    refunded: { count: 0, amount: {} },
    inFlight: { count: 0, amount: {} },
    failed: { count: 0, amount: {} },
    recent: { count: 0, amount: {} },
    byStatus: { PENDING: 0, PROCESSING: 0, SUCCEEDED: 0, FAILED: 0, CANCELED: 0 },
  };
  for (const r of refunds) {
    m.byStatus[r.status] += 1;
    const bucket = r.status === "SUCCEEDED" ? m.refunded : r.status === "FAILED" ? m.failed : IN_FLIGHT_STATUSES.includes(r.status) ? m.inFlight : null;
    if (bucket) {
      bucket.count += 1;
      addMoney(bucket.amount, r.currency, r.refundAmountMinor);
    }
    const created = r.createdAt.getTime();
    if (created >= recentFrom && created <= now.getTime()) {
      m.recent.count += 1;
      addMoney(m.recent.amount, r.currency, r.refundAmountMinor);
    }
  }
  return m;
}

export function matchesSearch(r: Refund, q: string | undefined): boolean {
  if (!q) return true;
  const needle = q.toLowerCase();
  return [r.id, r.transactionId, r.customerId, r.customerName].some((v) => v.toLowerCase().includes(needle));
}

export const REFUND_SORT_FIELDS = ["id", "customerId", "refundAmount", "status", "createdAt", "completedAt"] as const;
export type RefundSortField = (typeof REFUND_SORT_FIELDS)[number];

const STATUS_ORDER: Record<RefundStatus, number> = { PENDING: 0, PROCESSING: 1, FAILED: 2, SUCCEEDED: 3, CANCELED: 4 };

function compare(a: Refund, b: Refund, field: RefundSortField): number {
  switch (field) {
    case "refundAmount":
      // Amounts in different currencies are not comparable; group by currency first.
      return a.currency.localeCompare(b.currency) || a.refundAmountMinor - b.refundAmountMinor;
    case "status":
      return STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
    case "createdAt":
      return a.createdAt.getTime() - b.createdAt.getTime();
    case "completedAt":
      // Not-yet-completed refunds sort after completed ones in ascending order.
      return (a.completedAt?.getTime() ?? Infinity) - (b.completedAt?.getTime() ?? Infinity);
    default:
      return a[field].localeCompare(b[field]);
  }
}

export function sortRefunds(refunds: readonly Refund[], field: RefundSortField, dir: "asc" | "desc"): Refund[] {
  const sign = dir === "asc" ? 1 : -1;
  return [...refunds].sort((a, b) => sign * compare(a, b, field) || a.id.localeCompare(b.id));
}

export function paginate<T>(items: readonly T[], page: number, pageSize = PAGE_SIZE) {
  const pageCount = Math.max(1, Math.ceil(items.length / pageSize));
  const current = Math.min(Math.max(1, page), pageCount);
  const start = (current - 1) * pageSize;
  return { items: items.slice(start, start + pageSize), page: current, pageCount, total: items.length, start };
}

const EXPONENT: Record<Currency, number> = { USD: 2, EUR: 2, GBP: 2 };

/** Formats integer minor units without going through floating-point arithmetic on totals. */
export function formatMoney(minor: number, currency: Currency): string {
  const exp = EXPONENT[currency];
  const sign = minor < 0 ? "-" : "";
  const abs = Math.abs(minor);
  const major = Math.floor(abs / 10 ** exp);
  const fraction = String(abs % 10 ** exp).padStart(exp, "0");
  const symbol = { USD: "$", EUR: "€", GBP: "£" }[currency];
  return `${sign}${symbol}${major.toLocaleString("en-US")}.${fraction}`;
}
