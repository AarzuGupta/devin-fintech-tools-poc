import { describe, expect, it } from "vitest";
import { availableDecisions, evaluateDecision, isOverdue } from "@/lib/domain/kyc";

const REASON = "Documents could not be verified after outreach.";

describe("evaluateDecision", () => {
  it.each([
    ["ANALYST", "PENDING", "APPROVE", "APPROVED"],
    ["ANALYST", "PENDING", "REJECT", "REJECTED"],
    ["ANALYST", "PENDING", "ESCALATE", "ESCALATED"],
    ["ADMIN", "PENDING", "APPROVE", "APPROVED"],
    ["ADMIN", "ESCALATED", "APPROVE", "APPROVED"],
    ["ADMIN", "ESCALATED", "REJECT", "REJECTED"],
  ] as const)("%s can move %s via %s to %s", (role, status, decision, next) => {
    expect(evaluateDecision(role, status, decision, REASON)).toEqual({ ok: true, nextStatus: next, reason: REASON });
  });

  it.each(["APPROVED", "REJECTED"] as const)("rejects any change to a %s case, even for admins", (status) => {
    for (const decision of ["APPROVE", "REJECT", "ESCALATE"] as const) {
      const result = evaluateDecision("ADMIN", status, decision, REASON);
      expect(result).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    }
  });

  it("does not allow escalating an already escalated case", () => {
    expect(evaluateDecision("ADMIN", "ESCALATED", "ESCALATE", REASON)).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("forbids viewers from deciding and analysts from resolving escalations", () => {
    expect(evaluateDecision("VIEWER", "PENDING", "APPROVE", null)).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(evaluateDecision("ANALYST", "ESCALATED", "APPROVE", null)).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it.each([undefined, null, "", "   ", "too short"])("requires a meaningful reason to reject or escalate (%j)", (reason) => {
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", reason)).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(evaluateDecision("ANALYST", "PENDING", "ESCALATE", reason)).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("allows approval without a note and trims notes", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "APPROVE", "  ")).toEqual({ ok: true, nextStatus: "APPROVED", reason: null });
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", `  ${REASON}  `)).toMatchObject({ ok: true, reason: REASON });
  });

  it("rejects overly long reasons", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", "x".repeat(1001))).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("availableDecisions", () => {
  it("reflects role and status", () => {
    expect(availableDecisions("VIEWER", "PENDING")).toEqual([]);
    expect(availableDecisions("ANALYST", "PENDING")).toEqual(["APPROVE", "REJECT", "ESCALATE"]);
    expect(availableDecisions("ANALYST", "ESCALATED")).toEqual([]);
    expect(availableDecisions("ADMIN", "ESCALATED")).toEqual(["APPROVE", "REJECT"]);
    expect(availableDecisions("ADMIN", "APPROVED")).toEqual([]);
  });
});

describe("isOverdue", () => {
  const now = new Date("2026-11-05T00:00:00Z");
  it("flags open cases past their deadline only", () => {
    const past = new Date("2026-11-01T00:00:00Z");
    expect(isOverdue(past, "PENDING", now)).toBe(true);
    expect(isOverdue(past, "ESCALATED", now)).toBe(true);
    expect(isOverdue(past, "APPROVED", now)).toBe(false);
    expect(isOverdue(new Date("2026-11-06T00:00:00Z"), "PENDING", now)).toBe(false);
  });
});
