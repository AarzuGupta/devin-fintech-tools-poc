/**
 * Wire contract of the (mock) upstream finance API. snake_case JSON, integer minor
 * units, lowercase enums. Validated on every response so a contract drift fails loudly
 * instead of rendering wrong numbers.
 */
import { z } from "zod";
import { CURRENCIES, REFUND_REASONS, REFUND_STATUSES, type Refund } from "@/lib/domain/refunds";

const lower = <T extends readonly string[]>(values: T) =>
  z.enum(values.map((v) => v.toLowerCase()) as [string, ...string[]]).transform((v) => v.toUpperCase() as T[number]);

const isoDate = z.string().datetime().transform((v) => new Date(v));
const minorUnits = z.number().int().nonnegative();

export const EVENT_TYPES = ["refund.created", "refund.processing", "refund.succeeded", "refund.failed", "refund.canceled"] as const;

export const wireRefundSchema = z.object({
  id: z.string(),
  object: z.literal("refund"),
  transaction_id: z.string(),
  customer: z.object({ id: z.string(), name: z.string() }),
  original_amount: minorUnits,
  amount: minorUnits,
  currency: lower(CURRENCIES),
  reason: lower(REFUND_REASONS),
  status: lower(REFUND_STATUSES),
  created: isoDate,
  completed_at: isoDate.nullable(),
  payment_method_summary: z.string(),
  product: z.string(),
  initiated_by: z.string(),
  failure_reason: z.string().nullable(),
  events: z.array(z.object({ type: z.enum(EVENT_TYPES), created: isoDate, note: z.string().nullable() })),
});
export type WireRefund = z.input<typeof wireRefundSchema>;

export const wireListSchema = z.object({
  object: z.literal("list"),
  data: z.array(wireRefundSchema),
  has_more: z.boolean(),
  next_cursor: z.string().nullable(),
});

export const wireErrorSchema = z.object({
  error: z.object({ type: z.string(), message: z.string(), request_id: z.string().optional() }),
});

export function toDomainRefund(w: z.output<typeof wireRefundSchema>): Refund {
  return {
    id: w.id,
    transactionId: w.transaction_id,
    customerId: w.customer.id,
    customerName: w.customer.name,
    originalAmountMinor: w.original_amount,
    refundAmountMinor: w.amount,
    currency: w.currency,
    reason: w.reason,
    status: w.status,
    createdAt: w.created,
    completedAt: w.completed_at,
    paymentMethod: w.payment_method_summary,
    product: w.product,
    initiatedBy: w.initiated_by,
    failureReason: w.failure_reason,
    events: w.events.map((e) => ({
      type: e.type.replace("refund.", "").toUpperCase() as Refund["events"][number]["type"],
      at: e.created,
      note: e.note,
    })),
  };
}
