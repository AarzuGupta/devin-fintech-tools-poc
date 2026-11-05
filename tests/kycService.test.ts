import { PrismaClient } from "@prisma/client";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { buildSeedData } from "@/lib/seed/seedData";
import { listAuditEvents } from "@/lib/services/auditService";
import { decideCase, getCase, getQueueSummary, KYC_ENTITY, listCases } from "@/lib/services/kycService";
import { actors, auditCount, findCaseIdByStatus, prisma, resetDb } from "./helpers";

const REASON = "Customer failed to provide proof of address after two requests.";
const NOT_HIGH_RISK = { riskTier: { not: "HIGH" } };

beforeEach(resetDb);

async function expectAppError(promise: Promise<unknown>, code: string) {
  await expect(promise).rejects.toMatchObject({ name: "AppError", code });
}

describe("decideCase: valid transitions", () => {
  it("persists an approval and writes a complete audit event", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    const before = await auditCount();

    const result = await decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE", reason: "All checks satisfactory." });
    expect(result).toMatchObject({ caseId, previousStatus: "PENDING", status: "APPROVED" });

    const stored = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(stored.status).toBe("APPROVED");
    expect(stored.decidedAt).toBeInstanceOf(Date);

    expect(await auditCount()).toBe(before + 1);
    const event = await prisma.auditEvent.findUniqueOrThrow({ where: { id: result.auditEventId } });
    expect(event).toMatchObject({
      entityType: KYC_ENTITY,
      entityId: caseId,
      actorId: actors.analyst.id,
      action: "APPROVE",
      previousState: "PENDING",
      newState: "APPROVED",
      reason: "All checks satisfactory.",
    });
    expect(Math.abs(event.createdAt.getTime() - Date.now())).toBeLessThan(10_000);
  });

  it("rejects with a reason and records it", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await decideCase(prisma, actors.analyst, { caseId, decision: "REJECT", reason: `  ${REASON}  ` });
    const detail = await getCase(prisma, actors.viewer, caseId);
    expect(detail.status).toBe("REJECTED");
    expect(detail.history[0]).toMatchObject({ action: "REJECT", reason: REASON, actor: { id: actors.analyst.id } });
  });

  it("supports escalate by analyst then resolution by admin, with full history", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await decideCase(prisma, actors.analyst, { caseId, decision: "ESCALATE", reason: "Possible sanctions match; needs lead review." });
    const escalated = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(escalated.status).toBe("ESCALATED");
    expect(escalated.decidedAt).toBeNull();

    await decideCase(prisma, actors.admin, { caseId, decision: "REJECT", reason: "Confirmed match against screening list." });
    const detail = await getCase(prisma, actors.admin, caseId);
    expect(detail.status).toBe("REJECTED");
    expect(detail.history.map((e) => [e.action, e.previousState, e.newState, e.actor.id])).toEqual([
      ["REJECT", "ESCALATED", "REJECTED", "u-admin"],
      ["ESCALATE", "PENDING", "ESCALATED", "u-analyst-1"],
    ]);
  });
});

describe("decideCase: invalid transitions and inputs leave no trace", () => {
  async function expectUnchanged(caseId: string, run: () => Promise<unknown>, code: string) {
    const before = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    const auditBefore = await auditCount();
    await expectAppError(run(), code);
    const after = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(after.status).toBe(before.status);
    expect(after.updatedAt.getTime()).toBe(before.updatedAt.getTime());
    expect(await auditCount()).toBe(auditBefore);
  }

  it.each(["APPROVED", "REJECTED"])("cannot modify a %s (finalized) case, even as admin", async (status) => {
    const caseId = await findCaseIdByStatus(status);
    for (const decision of ["APPROVE", "REJECT", "ESCALATE"]) {
      await expectUnchanged(caseId, () => decideCase(prisma, actors.admin, { caseId, decision, reason: REASON }), "INVALID_TRANSITION");
    }
  });

  it("cannot escalate an escalated case", async () => {
    const caseId = await findCaseIdByStatus("ESCALATED");
    await expectUnchanged(caseId, () => decideCase(prisma, actors.admin, { caseId, decision: "ESCALATE", reason: REASON }), "INVALID_TRANSITION");
  });

  it.each([undefined, "", "    ", "short"])("requires a meaningful reason for reject/escalate (%j)", async (reason) => {
    const caseId = await findCaseIdByStatus("PENDING");
    await expectUnchanged(caseId, () => decideCase(prisma, actors.analyst, { caseId, decision: "REJECT", reason }), "VALIDATION");
    await expectUnchanged(caseId, () => decideCase(prisma, actors.analyst, { caseId, decision: "ESCALATE", reason }), "VALIDATION");
  });

  it("rejects unknown decisions, malformed payloads and unknown cases", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await expectUnchanged(caseId, () => decideCase(prisma, actors.analyst, { caseId, decision: "DELETE" }), "VALIDATION");
    await expectAppError(decideCase(prisma, actors.analyst, null), "VALIDATION");
    await expectAppError(decideCase(prisma, actors.analyst, { caseId: "KYC-99999", decision: "APPROVE" }), "NOT_FOUND");
  });

  it("rejects client-supplied identity or role fields", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await expectUnchanged(
      caseId,
      () => decideCase(prisma, actors.viewer, { caseId, decision: "APPROVE", role: "ADMIN" }),
      "VALIDATION",
    );
    await expectUnchanged(
      caseId,
      () => decideCase(prisma, actors.viewer, { caseId, decision: "APPROVE", actorId: "u-admin" }),
      "VALIDATION",
    );
  });

  it("returns CONFLICT when the client's expected status is stale", async () => {
    const caseId = await findCaseIdByStatus("ESCALATED");
    await expectUnchanged(
      caseId,
      () => decideCase(prisma, actors.admin, { caseId, decision: "APPROVE", expectedStatus: "PENDING" }),
      "CONFLICT",
    );
  });
});

describe("decideCase: authorization", () => {
  it("denies anonymous callers", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await expectAppError(decideCase(prisma, null, { caseId, decision: "APPROVE" }), "UNAUTHENTICATED");
    expect(await auditCount(caseId)).toBe(0);
  });

  it("denies viewers", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    await expectAppError(decideCase(prisma, actors.viewer, { caseId, decision: "APPROVE" }), "FORBIDDEN");
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("PENDING");
  });

  it("denies analysts resolving escalated cases", async () => {
    const caseId = await findCaseIdByStatus("ESCALATED");
    const before = await auditCount(caseId);
    await expectAppError(decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE" }), "FORBIDDEN");
    expect(await auditCount(caseId)).toBe(before);
  });

  it("lets any analyst act on any pending case (assignment is informational)", async () => {
    const c = await prisma.kycCase.findFirstOrThrow({ where: { status: "PENDING", NOT: { assignedReviewerId: actors.analyst2.id } } });
    await expect(decideCase(prisma, actors.analyst2, { caseId: c.id, decision: "APPROVE" })).resolves.toMatchObject({ status: "APPROVED" });
  });
});

describe("decideCase: high-risk approval policy", () => {
  const HIGH = { riskTier: "HIGH" };

  it("refuses an analyst approval of a high-risk case and writes nothing", async () => {
    const caseId = await findCaseIdByStatus("PENDING", 0, HIGH);
    const before = await auditCount();
    await expect(decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE", reason: "Looks fine to me overall." })).rejects.toMatchObject({
      code: "FORBIDDEN",
      message: "High-risk cases can only be approved by an admin.",
    });
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("PENDING");
    expect(await auditCount()).toBe(before);
  });

  it("lets analysts reject and escalate high-risk cases", async () => {
    const toReject = await findCaseIdByStatus("PENDING", 0, HIGH);
    const toEscalate = await findCaseIdByStatus("PENDING", 1, HIGH);
    await expect(decideCase(prisma, actors.analyst, { caseId: toReject, decision: "REJECT", reason: REASON })).resolves.toMatchObject({ status: "REJECTED" });
    await expect(
      decideCase(prisma, actors.analyst, { caseId: toEscalate, decision: "ESCALATE", reason: "Adverse media hit needs admin review." }),
    ).resolves.toMatchObject({ status: "ESCALATED" });
  });

  it("lets admins approve high-risk cases, pending or escalated, with an audit event", async () => {
    for (const status of ["PENDING", "ESCALATED"]) {
      const caseId = await findCaseIdByStatus(status, 0, HIGH);
      const result = await decideCase(prisma, actors.admin, { caseId, decision: "APPROVE" });
      expect(result).toMatchObject({ status: "APPROVED" });
      const event = await prisma.auditEvent.findUniqueOrThrow({ where: { id: result.auditEventId } });
      expect(event).toMatchObject({ entityId: caseId, actorId: actors.admin.id, action: "APPROVE", newState: "APPROVED" });
    }
  });

  it.each(["LOW", "MEDIUM"])("still lets analysts approve %s-risk cases", async (riskTier) => {
    const caseId = await findCaseIdByStatus("PENDING", 0, { riskTier });
    await expect(decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE" })).resolves.toMatchObject({ status: "APPROVED" });
  });

  it("does not alter existing decisions or history on high-risk cases", async () => {
    const decided = await prisma.kycCase.findMany({ where: { riskTier: "HIGH", status: { in: ["APPROVED", "REJECTED"] } } });
    expect(decided.length).toBeGreaterThan(0);
    for (const c of decided) {
      const detail = await getCase(prisma, actors.analyst, c.id);
      expect(detail.status).toBe(c.status);
      expect(detail.history.length).toBeGreaterThan(0);
    }
  });
});

describe("decideCase: concurrency", () => {
  const secondInstance = new PrismaClient();
  afterAll(() => secondInstance.$disconnect());

  it("allows exactly one of two simultaneous decisions and audits only that one", async () => {
    const caseId = await findCaseIdByStatus("PENDING");
    const results = await Promise.allSettled([
      decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE" }),
      decideCase(prisma, actors.analyst2, { caseId, decision: "REJECT", reason: REASON }),
    ]);

    const fulfilled = results.filter((r) => r.status === "fulfilled");
    const rejected = results.filter((r) => r.status === "rejected");
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect((rejected[0] as PromiseRejectedResult).reason).toMatchObject({ code: expect.stringMatching(/CONFLICT|INVALID_TRANSITION/) });

    const winner = (fulfilled[0] as PromiseFulfilledResult<{ status: string }>).value;
    const stored = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    expect(stored.status).toBe(winner.status);

    const events = await prisma.auditEvent.findMany({ where: { entityId: caseId } });
    expect(events).toHaveLength(1);
    expect(events[0].newState).toBe(winner.status);
  });

  it("is safe across separate database connections (simulating two server instances)", async () => {
    const caseId = await findCaseIdByStatus("PENDING", 2, NOT_HIGH_RISK);
    const results = await Promise.allSettled([
      decideCase(prisma, actors.analyst, { caseId, decision: "APPROVE" }),
      decideCase(secondInstance, actors.analyst2, { caseId, decision: "REJECT", reason: REASON }),
    ]);
    const fulfilled = results.filter((r) => r.status === "fulfilled") as PromiseFulfilledResult<{ status: string }>[];
    const rejected = results.filter((r) => r.status === "rejected") as PromiseRejectedResult[];
    expect(fulfilled).toHaveLength(1);
    expect(rejected).toHaveLength(1);
    expect(rejected[0].reason).toMatchObject({ code: expect.stringMatching(/CONFLICT|INVALID_TRANSITION/) });
    const events = await prisma.auditEvent.findMany({ where: { entityId: caseId } });
    expect(events).toHaveLength(1);
    expect(events[0].newState).toBe(fulfilled[0].value.status);
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe(fulfilled[0].value.status);
  });

  it("refuses to write when the status changed after it was read (stale-read guard)", async () => {
    const caseId = await findCaseIdByStatus("PENDING", 3);
    const staleSnapshot = await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } });
    await decideCase(prisma, actors.admin, { caseId, decision: "APPROVE" });

    // Simulates a database without serialized transactions: the read returns the stale
    // PENDING row while the real row is already APPROVED.
    const staleDb = {
      $transaction: (fn: (tx: unknown) => Promise<unknown>) =>
        prisma.$transaction((tx) =>
          fn({
            ...tx,
            auditEvent: tx.auditEvent,
            kycCase: {
              findUnique: async () => staleSnapshot,
              updateMany: (args: Parameters<typeof tx.kycCase.updateMany>[0]) => tx.kycCase.updateMany(args),
            },
          }),
        ),
    } as unknown as PrismaClient;

    await expectAppError(decideCase(staleDb, actors.analyst, { caseId, decision: "REJECT", reason: REASON }), "CONFLICT");
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("APPROVED");
    expect(await auditCount(caseId)).toBe(1);
  });

  it("stays consistent under a burst of competing decisions", async () => {
    const caseId = await findCaseIdByStatus("PENDING", 1);
    const attempts = Array.from({ length: 6 }, (_, i) =>
      decideCase(prisma, i % 2 ? actors.analyst : actors.admin, { caseId, decision: i % 3 === 0 ? "APPROVE" : "ESCALATE", reason: REASON }),
    );
    const results = await Promise.allSettled(attempts);
    const ok = results.filter((r) => r.status === "fulfilled").length;
    const events = await prisma.auditEvent.findMany({ where: { entityId: caseId }, orderBy: { createdAt: "asc" } });
    // Each successful transition has exactly one audit event, and the chain is valid.
    expect(events).toHaveLength(ok);
    expect(ok).toBeGreaterThanOrEqual(1);
    let state = "PENDING";
    for (const e of events) {
      expect(e.previousState).toBe(state);
      state = e.newState!;
    }
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe(state);
  });
});

describe("read authorization", () => {
  it("denies anonymous access to case data", async () => {
    await expectAppError(listCases(prisma, null), "UNAUTHENTICATED");
    await expectAppError(getCase(prisma, null, "KYC-10001"), "UNAUTHENTICATED");
    await expectAppError(getQueueSummary(prisma, null), "UNAUTHENTICATED");
  });

  it("lets every signed-in role read cases", async () => {
    for (const actor of [actors.viewer, actors.analyst, actors.admin]) {
      expect(await listCases(prisma, actor)).toHaveLength(40);
      expect((await getCase(prisma, actor, "KYC-10001")).signals.length).toBeGreaterThan(0);
    }
  });

  it("restricts the global audit log to admins", async () => {
    await expectAppError(listAuditEvents(prisma, null), "UNAUTHENTICATED");
    await expectAppError(listAuditEvents(prisma, actors.viewer), "FORBIDDEN");
    await expectAppError(listAuditEvents(prisma, actors.analyst), "FORBIDDEN");
    const events = await listAuditEvents(prisma, actors.admin);
    expect(events.length).toBe(buildSeedData().auditEvents.length);
  });
});

describe("listCases: search, filter, sort", () => {
  it("filters by status, risk and type", async () => {
    const rows = await listCases(prisma, actors.viewer, { status: "PENDING", risk: "HIGH", type: "INDIVIDUAL" });
    expect(rows.length).toBeGreaterThan(0);
    expect(rows.every((r) => r.status === "PENDING" && r.riskTier === "HIGH" && r.customerType === "INDIVIDUAL")).toBe(true);
  });

  it("searches across case id, customer and analyst name", async () => {
    expect((await listCases(prisma, actors.viewer, { q: "KYC-10007" })).map((r) => r.id)).toEqual(["KYC-10007"]);
    const byAnalyst = await listCases(prisma, actors.viewer, { q: "Elena" });
    expect(byAnalyst.length).toBeGreaterThan(0);
    expect(byAnalyst.every((r) => r.assignedReviewer?.name === "Elena Rossi" || r.customerName.includes("Elena"))).toBe(true);
  });

  it("sorts by domain order for risk tier and by date for deadlines", async () => {
    const byRisk = await listCases(prisma, actors.viewer, { sort: "riskTier", dir: "desc" });
    const ranks = byRisk.map((r) => ({ HIGH: 2, MEDIUM: 1, LOW: 0 })[r.riskTier as "HIGH"]);
    expect(ranks).toEqual([...ranks].sort((a, b) => b - a));

    const byDeadline = await listCases(prisma, actors.viewer, { sort: "reviewDeadline", dir: "asc" });
    const times = byDeadline.map((r) => r.reviewDeadline.getTime());
    expect(times).toEqual([...times].sort((a, b) => a - b));
  });

  it("ignores invalid query values instead of failing", async () => {
    expect(await listCases(prisma, actors.viewer, { status: "BOGUS", sort: "password", dir: "sideways" })).toHaveLength(40);
  });
});

describe("seed data", () => {
  it("is deterministic and within the 30-50 case range", () => {
    const a = buildSeedData();
    const b = buildSeedData();
    expect(a).toEqual(b);
    expect(a.cases.length).toBeGreaterThanOrEqual(30);
    expect(a.cases.length).toBeLessThanOrEqual(50);
    expect(new Set(a.cases.map((c) => c.status))).toEqual(new Set(["PENDING", "ESCALATED", "APPROVED", "REJECTED"]));
  });
});
