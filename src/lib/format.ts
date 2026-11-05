const dateFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
});

const dateTimeFormat = new Intl.DateTimeFormat("en-US", {
  timeZone: "UTC",
  year: "numeric",
  month: "short",
  day: "2-digit",
  hour: "2-digit",
  minute: "2-digit",
  hourCycle: "h23",
});

/** All dates are shown in UTC so server and client render identically. */
export function formatDate(value: Date | string): string {
  return dateFormat.format(new Date(value));
}

export function formatDateTime(value: Date | string): string {
  return `${dateTimeFormat.format(new Date(value))} UTC`;
}

export const STATUS_LABELS: Record<string, string> = {
  PENDING: "Pending",
  ESCALATED: "Escalated",
  APPROVED: "Approved",
  REJECTED: "Rejected",
};

export const RISK_LABELS: Record<string, string> = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };

export const CUSTOMER_TYPE_LABELS: Record<string, string> = { INDIVIDUAL: "Individual", BUSINESS: "Business" };

export const DECISION_LABELS: Record<string, string> = {
  APPROVE: "Approved",
  REJECT: "Rejected",
  ESCALATE: "Escalated",
};

export const SIGNAL_LABELS: Record<string, string> = {
  DOCUMENT_AUTHENTICITY: "Document authenticity",
  SELFIE_LIVENESS: "Selfie liveness & face match",
  SANCTIONS_SCREENING: "Sanctions screening",
  PEP_SCREENING: "PEP screening",
  ADDRESS_VERIFICATION: "Address verification",
  DEVICE_IP_RISK: "Device & IP risk",
  BUSINESS_REGISTRY: "Business registry",
  UBO_VERIFICATION: "Beneficial ownership",
};
