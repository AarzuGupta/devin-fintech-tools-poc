import type { Role } from "@/lib/auth/roles";
import { hasPermission } from "@/lib/auth/permissions";

export const CASE_STATUSES = ["PENDING", "ESCALATED", "APPROVED", "REJECTED"] as const;
export type CaseStatus = (typeof CASE_STATUSES)[number];

export const DECISIONS = ["APPROVE", "REJECT", "ESCALATE"] as const;
export type Decision = (typeof DECISIONS)[number];

export const RISK_TIERS = ["LOW", "MEDIUM", "HIGH"] as const;
export type RiskTier = (typeof RISK_TIERS)[number];

export const CUSTOMER_TYPES = ["INDIVIDUAL", "BUSINESS"] as const;
export type CustomerType = (typeof CUSTOMER_TYPES)[number];

export const SIGNAL_OUTCOMES = ["PASS", "REVIEW", "FAIL"] as const;
export type SignalOutcome = (typeof SIGNAL_OUTCOMES)[number];

export const MIN_REASON_LENGTH = 10;
export const MAX_REASON_LENGTH = 1000;

/** Allowed status changes. Anything not listed is an invalid transition. */
const TRANSITIONS: Record<CaseStatus, Partial<Record<Decision, CaseStatus>>> = {
  PENDING: { APPROVE: "APPROVED", REJECT: "REJECTED", ESCALATE: "ESCALATED" },
  ESCALATED: { APPROVE: "APPROVED", REJECT: "REJECTED" },
  APPROVED: {},
  REJECTED: {},
};

export function isFinalStatus(status: CaseStatus): boolean {
  return status === "APPROVED" || status === "REJECTED";
}

export function isCaseStatus(value: string): value is CaseStatus {
  return (CASE_STATUSES as readonly string[]).includes(value);
}

export function reasonRequired(decision: Decision): boolean {
  return decision === "REJECT" || decision === "ESCALATE";
}

export function allowedDecisions(status: CaseStatus): Decision[] {
  return Object.keys(TRANSITIONS[status]) as Decision[];
}

/** Whether a role may act on a case in the given status at all. */
export function canRoleDecide(role: Role, status: CaseStatus): boolean {
  if (status === "PENDING") return hasPermission(role, "kyc:decide-pending");
  if (status === "ESCALATED") return hasPermission(role, "kyc:resolve-escalated");
  return false;
}

/** Decisions the given role can currently take on a case (for UI affordances). */
export function availableDecisions(role: Role, status: CaseStatus): Decision[] {
  return canRoleDecide(role, status) ? allowedDecisions(status) : [];
}

export type DecisionEvaluation =
  | { ok: true; nextStatus: CaseStatus; reason: string | null }
  | { ok: false; code: "FORBIDDEN" | "INVALID_TRANSITION" | "VALIDATION"; message: string };

/**
 * Pure business rule check for a decision. Order matters: a finalized case is
 * reported as an invalid transition regardless of role, then permissions, then
 * input validation.
 */
export function evaluateDecision(
  role: Role,
  currentStatus: CaseStatus,
  decision: Decision,
  rawReason: string | null | undefined,
): DecisionEvaluation {
  if (isFinalStatus(currentStatus)) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Case is already ${currentStatus.toLowerCase()} and cannot be changed.`,
    };
  }
  const nextStatus = TRANSITIONS[currentStatus][decision];
  if (!nextStatus) {
    return {
      ok: false,
      code: "INVALID_TRANSITION",
      message: `Cannot ${decision.toLowerCase()} a case that is ${currentStatus.toLowerCase()}.`,
    };
  }
  if (!canRoleDecide(role, currentStatus)) {
    return {
      ok: false,
      code: "FORBIDDEN",
      message:
        currentStatus === "ESCALATED"
          ? "Only admins can resolve escalated cases."
          : "Your role cannot make decisions on KYC cases.",
    };
  }
  const reason = rawReason?.trim() ? rawReason.trim() : null;
  if (reasonRequired(decision) && (!reason || reason.length < MIN_REASON_LENGTH)) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `A reason of at least ${MIN_REASON_LENGTH} characters is required to ${decision.toLowerCase()} a case.`,
    };
  }
  if (reason && reason.length > MAX_REASON_LENGTH) {
    return {
      ok: false,
      code: "VALIDATION",
      message: `Reason must be at most ${MAX_REASON_LENGTH} characters.`,
    };
  }
  return { ok: true, nextStatus, reason };
}

const RISK_ORDER: Record<RiskTier, number> = { LOW: 0, MEDIUM: 1, HIGH: 2 };
const STATUS_ORDER: Record<CaseStatus, number> = { PENDING: 0, ESCALATED: 1, APPROVED: 2, REJECTED: 3 };

export function riskRank(tier: string): number {
  return RISK_ORDER[tier as RiskTier] ?? -1;
}

export function statusRank(status: string): number {
  return STATUS_ORDER[status as CaseStatus] ?? -1;
}

export function isOverdue(deadline: Date, status: CaseStatus, now: Date = new Date()): boolean {
  return !isFinalStatus(status) && deadline.getTime() < now.getTime();
}
