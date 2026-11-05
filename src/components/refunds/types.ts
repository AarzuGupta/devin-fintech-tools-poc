import type { Currency, RefundReason, RefundStatus } from "@/lib/domain/refunds";

/** Serializable row passed from the server page to the client table. */
export interface RefundRow {
  id: string;
  transactionId: string;
  customerId: string;
  customerName: string;
  originalAmountMinor: number;
  refundAmountMinor: number;
  currency: Currency;
  reason: RefundReason;
  status: RefundStatus;
  createdAt: string;
  completedAt: string | null;
}

export interface UpstreamErrorView {
  kind: string;
  message: string;
  requestId?: string;
  retryAfterSeconds?: number;
  retryable: boolean;
}
