import { Prisma, type PrismaClient } from "@prisma/client";
import { z } from "zod";
import { requirePermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/roles";
import {
  CASE_STATUSES,
  CUSTOMER_TYPES,
  DECISIONS,
  RISK_TIERS,
  evaluateDecision,
  isRiskTier,
  isCaseStatus,
  riskRank,
  statusRank,
  type CaseStatus,
} from "@/lib/domain/kyc";
import { AppError } from "@/lib/errors";
import { getEntityHistory, recordAuditEvent } from "./auditService";

export const KYC_ENTITY = "KYC_CASE";

export const SORT_FIELDS = [
  "id",
  "customerId",
  "customerType",
  "riskTier",
  "reviewReason",
  "status",
  "assignedReviewer",
  "createdAt",
  "reviewDeadline",
] as const;
export type SortField = (typeof SORT_FIELDS)[number];

export const caseQuerySchema = z.object({
  q: z.string().trim().max(100).optional().catch(undefined),
  status: z.enum(CASE_STATUSES).optional().catch(undefined),
  risk: z.enum(RISK_TIERS).optional().catch(undefined),
  type: z.enum(CUSTOMER_TYPES).optional().catch(undefined),
  sort: z.enum(SORT_FIELDS).optional().catch(undefined),
  dir: z.enum(["asc", "desc"]).optional().catch(undefined),
});
export type CaseQuery = z.infer<typeof caseQuerySchema>;

const listInclude = { assignedReviewer: { select: { id: true, name: true } } } as const;
export type CaseListItem = Prisma.KycCaseGetPayload<{ include: typeof listInclude }>;

function compareCases(a: CaseListItem, b: CaseListItem, field: SortField): number {
  switch (field) {
    case "riskTier":
      return riskRank(a.riskTier) - riskRank(b.riskTier);
    case "status":
      return statusRank(a.status) - statusRank(b.status);
    case "assignedReviewer":
      return (a.assignedReviewer?.name ?? "").localeCompare(b.assignedReviewer?.name ?? "");
    case "createdAt":
    case "reviewDeadline":
      return a[field].getTime() - b[field].getTime();
    default:
      return a[field].localeCompare(b[field]);
  }
}

/** Sorts in memory so domain orderings (risk tier, status) are respected. Fine for queue-sized data. */
export function sortCases(cases: CaseListItem[], field: SortField = "reviewDeadline", dir: "asc" | "desc" = "asc") {
  const sign = dir === "asc" ? 1 : -1;
  return [...cases].sort((a, b) => sign * compareCases(a, b, field) || a.id.localeCompare(b.id));
}

export async function listCases(db: PrismaClient, actor: Actor | null, rawQuery: unknown = {}) {
  requirePermission(actor, "kyc:read");
  const query = caseQuerySchema.parse(rawQuery ?? {});
  const q = query.q;
  const cases = await db.kycCase.findMany({
    where: {
      ...(query.status ? { status: query.status } : {}),
      ...(query.risk ? { riskTier: query.risk } : {}),
      ...(query.type ? { customerType: query.type } : {}),
      ...(q
        ? {
            OR: [
              { id: { contains: q } },
              { customerId: { contains: q } },
              { customerName: { contains: q } },
              { reviewReason: { contains: q } },
              { assignedReviewer: { name: { contains: q } } },
            ],
          }
        : {}),
    },
    include: listInclude,
  });
  return sortCases(cases, query.sort, query.dir);
}

export async function getCase(db: PrismaClient, actor: Actor | null, caseId: string) {
  requirePermission(actor, "kyc:read");
  const kycCase = await db.kycCase.findUnique({
    where: { id: caseId },
    include: { ...listInclude, signals: { orderBy: { type: "asc" } } },
  });
  if (!kycCase) throw new AppError("NOT_FOUND", `Case ${caseId} was not found.`);
  const history = await getEntityHistory(db, KYC_ENTITY, caseId);
  return { ...kycCase, history };
}
export type CaseDetail = Awaited<ReturnType<typeof getCase>>;

export const decisionInputSchema = z
  .object({
    caseId: z.string().min(1).max(50),
    decision: z.enum(DECISIONS),
    reason: z.string().max(2000).optional().nullable(),
    expectedStatus: z.enum(CASE_STATUSES).optional(),
  })
  .strict();
export type DecisionInput = z.infer<typeof decisionInputSchema>;

function isWriteConflict(error: unknown): boolean {
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    return ["P2034", "P1008", "P2028"].includes(error.code);
  }
  const message = error instanceof Error ? error.message : "";
  return /database is locked|SQLITE_BUSY|write conflict|deadlock/i.test(message);
}

/**
 * Applies a decision atomically: the status change is a conditional update on the
 * status that was read, and the audit event is written in the same transaction.
 * If another decision lands first, nothing is written and CONFLICT is raised.
 */
export async function decideCase(db: PrismaClient, actor: Actor | null, rawInput: unknown) {
  requirePermission(actor, "kyc:read");
  const parsed = decisionInputSchema.safeParse(rawInput);
  if (!parsed.success) {
    throw new AppError("VALIDATION", parsed.error.issues[0]?.message ?? "Invalid input.");
  }
  const input = parsed.data;

  try {
    return await db.$transaction(async (tx) => {
      const current = await tx.kycCase.findUnique({ where: { id: input.caseId } });
      if (!current) throw new AppError("NOT_FOUND", `Case ${input.caseId} was not found.`);
      if (!isCaseStatus(current.status)) throw new Error(`Corrupt status on ${current.id}`);
      if (!isRiskTier(current.riskTier)) throw new Error(`Corrupt risk tier on ${current.id}`);
      if (input.expectedStatus && input.expectedStatus !== current.status) {
        throw new AppError("CONFLICT", "This case was updated by someone else. Refresh and try again.");
      }

      const evaluation = evaluateDecision(actor.role, current.status, input.decision, input.reason, current.riskTier);
      if (!evaluation.ok) throw new AppError(evaluation.code, evaluation.message);

      const now = new Date();
      const nextStatus: CaseStatus = evaluation.nextStatus;
      const updated = await tx.kycCase.updateMany({
        where: { id: current.id, status: current.status },
        data: {
          status: nextStatus,
          decidedAt: nextStatus === "ESCALATED" ? null : now,
        },
      });
      if (updated.count !== 1) {
        throw new AppError("CONFLICT", "This case was updated by someone else. Refresh and try again.");
      }

      const audit = await recordAuditEvent(tx, {
        entityType: KYC_ENTITY,
        entityId: current.id,
        actorId: actor.id,
        action: input.decision,
        previousState: current.status,
        newState: nextStatus,
        reason: evaluation.reason,
      });

      return { caseId: current.id, previousStatus: current.status, status: nextStatus, auditEventId: audit.id };
    });
  } catch (error) {
    if (isWriteConflict(error)) {
      throw new AppError("CONFLICT", "This case was updated by someone else. Refresh and try again.");
    }
    throw error;
  }
}

/** Open-work counts shown in the queue header. */
export async function getQueueSummary(db: PrismaClient, actor: Actor | null, now: Date = new Date()) {
  requirePermission(actor, "kyc:read");
  const open = { status: { in: ["PENDING", "ESCALATED"] } };
  const [pending, escalated, overdue] = await Promise.all([
    db.kycCase.count({ where: { status: "PENDING" } }),
    db.kycCase.count({ where: { status: "ESCALATED" } }),
    db.kycCase.count({ where: { ...open, reviewDeadline: { lt: now } } }),
  ]);
  return { pending, escalated, overdue };
}
