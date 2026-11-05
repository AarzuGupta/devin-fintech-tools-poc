/**
 * Deterministic synthetic data. All names, identifiers and signals are fictional.
 * Same seed + same base date => identical dataset on every run.
 */
import type { CaseStatus, CustomerType, RiskTier, SignalOutcome } from "@/lib/domain/kyc";

export const SEED_BASE_DATE = new Date("2026-11-03T16:00:00.000Z");
const CASE_COUNT = 40;

export const SEED_USERS = [
  { id: "u-viewer", name: "Priya Shah", email: "priya.shah@example.test", role: "VIEWER" },
  { id: "u-analyst-1", name: "Marcus Lee", email: "marcus.lee@example.test", role: "ANALYST" },
  { id: "u-analyst-2", name: "Elena Rossi", email: "elena.rossi@example.test", role: "ANALYST" },
  { id: "u-analyst-3", name: "Tomás Alvarez", email: "tomas.alvarez@example.test", role: "ANALYST" },
  { id: "u-admin", name: "Jordan Blake", email: "jordan.blake@example.test", role: "ADMIN" },
] as const;

function mulberry32(seed: number) {
  let a = seed;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const FIRST = ["Amara", "Liam", "Sofia", "Noah", "Aisha", "Mateo", "Hannah", "Ravi", "Chloe", "Kenji", "Fatima", "Oliver", "Zara", "Lucas", "Mei", "Daniel"];
const LAST = ["Okafor", "Novak", "Haddad", "Fischer", "Patel", "Moreau", "Kowalski", "Tanaka", "Silva", "Brennan", "Lindqvist", "Mensah", "Costa", "Ibrahim"];
const BUSINESSES = ["Harbor Lane Logistics LLC", "Quillstone Trading Ltd", "Brightfield Analytics Inc", "Copperleaf Imports GmbH", "Northgate Freight Co", "Silverpine Ventures LLC", "Bluewater Payments Ltd", "Redwood Crafts Inc", "Meridian Supply Pte Ltd", "Oakridge Consulting LLC", "Lumen Retail Group SA", "Pioneer Agritech Ltd"];
const COUNTRIES = ["US", "US", "US", "GB", "GB", "DE", "CA", "SG", "AE", "BR", "MX", "IN", "NG"];

type ReasonSpec = { label: string; trigger: string; types: CustomerType[] };
const REASONS: ReasonSpec[] = [
  { label: "New account onboarding", trigger: "DOCUMENT_AUTHENTICITY", types: ["INDIVIDUAL", "BUSINESS"] },
  { label: "Sanctions screening potential match", trigger: "SANCTIONS_SCREENING", types: ["INDIVIDUAL", "BUSINESS"] },
  { label: "PEP screening hit", trigger: "PEP_SCREENING", types: ["INDIVIDUAL"] },
  { label: "Document verification failed", trigger: "DOCUMENT_AUTHENTICITY", types: ["INDIVIDUAL"] },
  { label: "Selfie liveness inconclusive", trigger: "SELFIE_LIVENESS", types: ["INDIVIDUAL"] },
  { label: "Address mismatch", trigger: "ADDRESS_VERIFICATION", types: ["INDIVIDUAL", "BUSINESS"] },
  { label: "High-risk device or IP", trigger: "DEVICE_IP_RISK", types: ["INDIVIDUAL", "BUSINESS"] },
  { label: "Beneficial ownership change", trigger: "UBO_VERIFICATION", types: ["BUSINESS"] },
  { label: "Business registry discrepancy", trigger: "BUSINESS_REGISTRY", types: ["BUSINESS"] },
  { label: "Periodic review (high risk)", trigger: "SANCTIONS_SCREENING", types: ["INDIVIDUAL", "BUSINESS"] },
];

const SIGNALS_BY_TYPE: Record<CustomerType, string[]> = {
  INDIVIDUAL: ["DOCUMENT_AUTHENTICITY", "SELFIE_LIVENESS", "SANCTIONS_SCREENING", "PEP_SCREENING", "ADDRESS_VERIFICATION", "DEVICE_IP_RISK"],
  BUSINESS: ["BUSINESS_REGISTRY", "UBO_VERIFICATION", "SANCTIONS_SCREENING", "ADDRESS_VERIFICATION", "DEVICE_IP_RISK"],
};

const EXPLANATIONS: Record<string, Record<SignalOutcome, string>> = {
  DOCUMENT_AUTHENTICITY: {
    PASS: "Government ID passed template, MRZ and tamper checks.",
    REVIEW: "ID image is low resolution; security features partially legible.",
    FAIL: "MRZ checksum mismatch and font inconsistencies on date of birth field.",
  },
  SELFIE_LIVENESS: {
    PASS: "Liveness confirmed; face match score 0.97 against ID photo.",
    REVIEW: "Liveness passed but face match score 0.71 is below auto-approve threshold (0.85).",
    FAIL: "Liveness check detected possible screen replay.",
  },
  SANCTIONS_SCREENING: {
    PASS: "No matches against consolidated sanctions lists (synthetic list).",
    REVIEW: "Partial name match (score 0.82) to a listed individual; DOB differs by 2 years.",
    FAIL: "Strong name and DOB match to a listed entity (synthetic list).",
  },
  PEP_SCREENING: {
    PASS: "No politically exposed person matches.",
    REVIEW: "Possible relative of a regional official; requires source-of-funds review.",
    FAIL: "Confirmed match to a domestic PEP record (synthetic).",
  },
  ADDRESS_VERIFICATION: {
    PASS: "Address matched utility and credit bureau records.",
    REVIEW: "Address matched only one of two data sources.",
    FAIL: "Declared address is a known mail-forwarding service.",
  },
  DEVICE_IP_RISK: {
    PASS: "Device and IP consistent with declared country.",
    REVIEW: "Sign-up via VPN exit node; device first seen 2 days ago.",
    FAIL: "Device linked to 6 other applications in the past 30 days.",
  },
  BUSINESS_REGISTRY: {
    PASS: "Company active in registry; directors match application.",
    REVIEW: "Registered name differs slightly from application (trading name).",
    FAIL: "Registry shows company status as dissolved.",
  },
  UBO_VERIFICATION: {
    PASS: "Ultimate beneficial owners verified (>25% ownership).",
    REVIEW: "One beneficial owner's identity documents are pending.",
    FAIL: "Ownership structure includes an unverifiable offshore holding entity.",
  },
};

export type SeedCase = {
  id: string;
  customerId: string;
  customerName: string;
  customerType: CustomerType;
  country: string;
  riskTier: RiskTier;
  reviewReason: string;
  status: CaseStatus;
  assignedReviewerId: string | null;
  createdAt: Date;
  reviewDeadline: Date;
  decidedAt: Date | null;
  signals: { type: string; outcome: SignalOutcome; explanation: string }[];
};

export type SeedAuditEvent = {
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  previousState: string;
  newState: string;
  reason: string | null;
  createdAt: Date;
};

const HOUR = 3_600_000;
const DAY = 24 * HOUR;
const ANALYSTS = ["u-analyst-1", "u-analyst-2", "u-analyst-3"];

const DECISION_NOTES: Record<string, string> = {
  APPROVE: "All verification signals reviewed; residual risk acceptable.",
  REJECT: "Unable to verify identity documents after outreach; customer did not respond within 7 days.",
  ESCALATE: "Potential sanctions match needs compliance lead review before decision.",
};

export function buildSeedData() {
  const rand = mulberry32(20261103);
  const pick = <T,>(items: readonly T[]) => items[Math.floor(rand() * items.length)];

  const cases: SeedCase[] = [];
  const auditEvents: SeedAuditEvent[] = [];

  for (let i = 0; i < CASE_COUNT; i++) {
    const customerType: CustomerType = rand() < 0.7 ? "INDIVIDUAL" : "BUSINESS";
    const reason = pick(REASONS.filter((r) => r.types.includes(customerType)));
    const id = `KYC-${String(10001 + i)}`;

    const signals = SIGNALS_BY_TYPE[customerType].map((type) => {
      let outcome: SignalOutcome;
      if (type === reason.trigger) outcome = rand() < 0.35 ? "FAIL" : "REVIEW";
      else {
        const r = rand();
        outcome = r < 0.85 ? "PASS" : r < 0.98 ? "REVIEW" : "FAIL";
      }
      return { type, outcome, explanation: EXPLANATIONS[type][outcome] };
    });
    const fails = signals.filter((s) => s.outcome === "FAIL").length;
    const reviews = signals.filter((s) => s.outcome === "REVIEW").length;
    const riskTier: RiskTier = fails > 0 ? "HIGH" : reviews > 1 ? "MEDIUM" : rand() < 0.55 ? "LOW" : "MEDIUM";

    const createdAt = new Date(SEED_BASE_DATE.getTime() - Math.floor(rand() * 14 * DAY) - Math.floor(rand() * 8) * HOUR);
    const slaDays = riskTier === "HIGH" ? 2 : riskTier === "MEDIUM" ? 5 : 10;
    const reviewDeadline = new Date(createdAt.getTime() + slaDays * DAY);

    const assignedReviewerId = rand() < 0.85 ? pick(ANALYSTS) : null;

    // Roughly: 60% pending, 12% escalated, 18% approved, 10% rejected.
    const roll = rand();
    const status: CaseStatus = roll < 0.6 ? "PENDING" : roll < 0.72 ? "ESCALATED" : roll < 0.9 ? "APPROVED" : "REJECTED";

    let decidedAt: Date | null = null;
    if (status !== "PENDING") {
      const actorId = assignedReviewerId ?? "u-analyst-1";
      const decidedTime = new Date(createdAt.getTime() + Math.floor((0.2 + rand() * 0.6) * slaDays * DAY));
      const final = status === "APPROVED" || status === "REJECTED";
      const escalatedFirst = final && rand() < 0.3;
      if (status === "ESCALATED" || escalatedFirst) {
        auditEvents.push({
          entityType: "KYC_CASE", entityId: id, actorId, action: "ESCALATE",
          previousState: "PENDING", newState: "ESCALATED", reason: DECISION_NOTES.ESCALATE,
          createdAt: escalatedFirst ? new Date(decidedTime.getTime() - 6 * HOUR) : decidedTime,
        });
      }
      if (final) {
        const action = status === "APPROVED" ? "APPROVE" : "REJECT";
        auditEvents.push({
          entityType: "KYC_CASE", entityId: id, actorId: escalatedFirst ? "u-admin" : actorId, action,
          previousState: escalatedFirst ? "ESCALATED" : "PENDING", newState: status,
          reason: DECISION_NOTES[action], createdAt: decidedTime,
        });
        decidedAt = decidedTime;
      }
    }

    const customerName = customerType === "BUSINESS" ? pick(BUSINESSES) : `${pick(FIRST)} ${pick(LAST)}`;
    cases.push({
      id,
      customerId: `CUS-${String(400000 + Math.floor(rand() * 99999)).padStart(6, "0")}`,
      customerName,
      customerType,
      country: pick(COUNTRIES),
      riskTier,
      reviewReason: reason.label,
      status,
      assignedReviewerId,
      createdAt,
      reviewDeadline,
      decidedAt,
      signals,
    });
  }

  return { users: SEED_USERS.map((u) => ({ ...u })), cases, auditEvents };
}
