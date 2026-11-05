/**
 * Deterministic synthetic dataset owned by the mock upstream. Fictional customers,
 * no real card or account numbers. Same seed => identical records.
 */
import { mulberry32 } from "@/lib/seed/random";
import { SEED_BASE_DATE } from "@/lib/seed/seedData";
import type { WireRefund } from "./contract";

export const MOCK_REFUND_COUNT = 120;
const DAY = 86_400_000;
const HOUR = 3_600_000;

const NAMES = ["Amara Okafor", "Liam Novak", "Sofia Marin", "Noah Becker", "Aisha Rahman", "Mateo Silva", "Hannah Weiss", "Ravi Iyer", "Chloe Martin", "Kenji Sato", "Fatima Haddad", "Oliver Grant", "Zara Patel", "Lucas Moreau", "Mei Chen", "Daniel Ortiz", "Northwind Cafe LLC", "Bluebird Logistics", "Quarry Lane Studio", "Harbor Point Dental"];
const PRODUCTS = ["Debit card", "Bill pay", "Wallet top-up", "Premium subscription", "Merchant payout"];
const REASONS = ["duplicate_charge", "customer_request", "fraudulent", "product_not_received", "service_canceled", "billing_error"] as const;
const AGENTS = ["support:Dana Whitfield", "support:Sam Okoro", "support:Ines Duarte", "system:dispute-automation", "system:duplicate-detector"];
const FAILURES = ["Card account closed by issuer", "Issuer declined the credit", "Destination bank account invalid", "Processor timeout after retries"];
const CANCEL_NOTES = ["Customer withdrew the request", "Duplicate refund request canceled", "Chargeback opened instead"];

function pick<T>(rand: () => number, items: readonly T[]): T {
  return items[Math.floor(rand() * items.length)];
}

function generate(): WireRefund[] {
  const rand = mulberry32(20261105);
  const records: WireRefund[] = [];
  for (let i = 0; i < MOCK_REFUND_COUNT; i++) {
    const ageDays = Math.pow(rand(), 1.6) * 100; // skew toward recent activity
    const created = new Date(SEED_BASE_DATE.getTime() - Math.round(ageDays * DAY));
    const currency = rand() < 0.7 ? "usd" : rand() < 0.6 ? "eur" : "gbp";
    const original = 500 + Math.floor(rand() * 250_000);
    const partial = rand() < 0.3;
    const amount = partial ? Math.max(100, Math.floor((original * (20 + Math.floor(rand() * 60))) / 100)) : original;
    const roll = rand();
    const status =
      ageDays < 1.5 ? (roll < 0.55 ? "pending" : roll < 0.9 ? "processing" : "succeeded")
      : ageDays < 5 ? (roll < 0.15 ? "pending" : roll < 0.35 ? "processing" : roll < 0.85 ? "succeeded" : "failed")
      : roll < 0.8 ? "succeeded" : roll < 0.92 ? "failed" : "canceled";
    const customerIdx = Math.floor(rand() * NAMES.length);
    const cardish = rand() < 0.75;
    const last4 = String(1000 + Math.floor(rand() * 9000));
    const events: WireRefund["events"] = [{ type: "refund.created", created: created.toISOString(), note: null }];
    let completedAt: string | null = null;
    let failure: string | null = null;
    const processingAt = new Date(created.getTime() + (1 + Math.floor(rand() * 6)) * HOUR);
    if (status !== "pending" && status !== "canceled") {
      events.push({ type: "refund.processing", created: processingAt.toISOString(), note: "Submitted to processor" });
    }
    if (status === "succeeded" || status === "failed" || status === "canceled") {
      const done = new Date(processingAt.getTime() + (2 + Math.floor(rand() * 60)) * HOUR);
      completedAt = (done > SEED_BASE_DATE ? SEED_BASE_DATE : done).toISOString();
      if (status === "failed") failure = pick(rand, FAILURES);
      const note = status === "failed" ? failure : status === "canceled" ? pick(rand, CANCEL_NOTES) : "Funds returned to original payment method";
      events.push({ type: `refund.${status}`, created: completedAt, note });
    }
    records.push({
      id: `RFD-${String(30001 + i)}`,
      object: "refund",
      transaction_id: `TXN-${(0x5a3f00 + Math.floor(rand() * 0xffff) * 7 + i).toString(16).toUpperCase()}`,
      customer: { id: `CUS-${String(400100 + customerIdx * 37)}`, name: NAMES[customerIdx] },
      original_amount: original,
      amount,
      currency,
      reason: pick(rand, REASONS),
      status,
      created: created.toISOString(),
      completed_at: completedAt,
      payment_method_summary: cardish ? `${pick(rand, ["Visa", "Mastercard"])} debit •••• ${last4}` : `ACH bank account •••• ${last4}`,
      product: pick(rand, PRODUCTS),
      initiated_by: pick(rand, AGENTS),
      failure_reason: failure,
      events,
    });
  }
  return records;
}

export const MOCK_REFUNDS: readonly WireRefund[] = generate();
