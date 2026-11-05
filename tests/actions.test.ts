import { beforeEach, describe, expect, it, vi } from "vitest";
import { SESSION_COOKIE, signSession } from "@/lib/auth/session";
import { auditCount, findCaseIdByStatus, prisma, resetDb } from "./helpers";

const cookieJar = new Map<string, string>();

vi.mock("server-only", () => ({}));
vi.mock("next/cache", () => ({ revalidatePath: vi.fn() }));
vi.mock("next/headers", () => ({
  cookies: async () => ({
    get: (name: string) => (cookieJar.has(name) ? { name, value: cookieJar.get(name)! } : undefined),
  }),
}));

const { decideCaseAction } = await import("@/app/actions/kyc");

function signInAs(userId: string | null, token?: string) {
  cookieJar.clear();
  if (token) cookieJar.set(SESSION_COOKIE, token);
  else if (userId) cookieJar.set(SESSION_COOKIE, signSession(userId));
}

beforeEach(resetDb);

describe("decideCaseAction (server action boundary)", () => {
  it("rejects requests with no session", async () => {
    signInAs(null);
    const caseId = await findCaseIdByStatus("PENDING");
    expect(await decideCaseAction({ caseId, decision: "APPROVE" })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
  });

  it("rejects tampered session cookies", async () => {
    const viewerSig = signSession("u-viewer").split(".")[1];
    signInAs(null, `${Buffer.from("u-admin").toString("base64url")}.${viewerSig}`);
    const caseId = await findCaseIdByStatus("PENDING");
    expect(await decideCaseAction({ caseId, decision: "APPROVE" })).toMatchObject({ ok: false, code: "UNAUTHENTICATED" });
    expect(await auditCount(caseId)).toBe(0);
  });

  it("ignores a client-claimed role: a viewer posing as admin is refused", async () => {
    signInAs("u-viewer");
    const caseId = await findCaseIdByStatus("PENDING");
    const res = await decideCaseAction({ caseId, decision: "APPROVE", role: "ADMIN", actorId: "u-admin" });
    expect(res.ok).toBe(false);
    const viewerOnly = await decideCaseAction({ caseId, decision: "APPROVE" });
    expect(viewerOnly).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect((await prisma.kycCase.findUniqueOrThrow({ where: { id: caseId } })).status).toBe("PENDING");
  });

  it("records the session user as the actor on success", async () => {
    signInAs("u-analyst-2");
    const caseId = await findCaseIdByStatus("PENDING");
    const res = await decideCaseAction({ caseId, decision: "ESCALATE", reason: "Needs a second look at the UBO structure." });
    expect(res).toMatchObject({ ok: true, data: { status: "ESCALATED" } });
    const event = await prisma.auditEvent.findFirstOrThrow({ where: { entityId: caseId } });
    expect(event.actorId).toBe("u-analyst-2");
  });

  it("enforces the high-risk approval policy for analysts at the action boundary", async () => {
    signInAs("u-analyst-1");
    const highRisk = await prisma.kycCase.findFirstOrThrow({ where: { status: "PENDING", riskTier: "HIGH" }, orderBy: { id: "asc" } });
    expect(await decideCaseAction({ caseId: highRisk.id, decision: "APPROVE", role: "ADMIN" })).toMatchObject({ ok: false });
    expect(await decideCaseAction({ caseId: highRisk.id, decision: "APPROVE" })).toMatchObject({
      ok: false,
      code: "FORBIDDEN",
      message: "High-risk cases can only be approved by an admin.",
    });
    expect(await auditCount(highRisk.id)).toBe(0);

    signInAs("u-admin");
    expect(await decideCaseAction({ caseId: highRisk.id, decision: "APPROVE" })).toMatchObject({ ok: true, data: { status: "APPROVED" } });
  });

  it("surfaces domain errors as structured results", async () => {
    signInAs("u-analyst-1");
    const caseId = await findCaseIdByStatus("APPROVED");
    expect(await decideCaseAction({ caseId, decision: "REJECT", reason: "Changing my mind on this one." })).toMatchObject({
      ok: false,
      code: "INVALID_TRANSITION",
    });
  });
});
