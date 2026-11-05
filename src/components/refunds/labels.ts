import type { BadgeTone } from "@/components/Badges";
import type { CreatedRange, Currency, RefundReason, RefundStatus } from "@/lib/domain/refunds";

export const REFUND_STATUS_LABELS: Record<RefundStatus, string> = {
  PENDING: "Pending",
  PROCESSING: "Processing",
  SUCCEEDED: "Succeeded",
  FAILED: "Failed",
  CANCELED: "Canceled",
};

export const REFUND_STATUS_TONES: Record<RefundStatus, BadgeTone> = {
  PENDING: "info",
  PROCESSING: "info",
  SUCCEEDED: "success",
  FAILED: "danger",
  CANCELED: "neutral",
};

export const REFUND_REASON_LABELS: Record<RefundReason, string> = {
  DUPLICATE_CHARGE: "Duplicate charge",
  CUSTOMER_REQUEST: "Customer request",
  FRAUDULENT: "Fraudulent",
  PRODUCT_NOT_RECEIVED: "Not received",
  SERVICE_CANCELED: "Service canceled",
  BILLING_ERROR: "Billing error",
};

export const CURRENCY_LABELS: Record<Currency, string> = { USD: "USD", EUR: "EUR", GBP: "GBP" };

export const RANGE_LABELS: Record<CreatedRange, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

export const EVENT_LABELS: Record<string, string> = {
  CREATED: "Refund created",
  PROCESSING: "Submitted to processor",
  SUCCEEDED: "Refund succeeded",
  FAILED: "Refund failed",
  CANCELED: "Refund canceled",
};
