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
    expect(evaluateDecision(role, status, decision, REASON, "MEDIUM")).toEqual({ ok: true, nextStatus: next, reason: REASON });
  });

  it.each(["APPROVED", "REJECTED"] as const)("rejects any change to a %s case, even for admins", (status) => {
    for (const decision of ["APPROVE", "REJECT", "ESCALATE"] as const) {
      const result = evaluateDecision("ADMIN", status, decision, REASON, "MEDIUM");
      expect(result).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
    }
  });

  it("does not allow escalating an already escalated case", () => {
    expect(evaluateDecision("ADMIN", "ESCALATED", "ESCALATE", REASON, "MEDIUM")).toMatchObject({ ok: false, code: "INVALID_TRANSITION" });
  });

  it("forbids viewers from deciding and analysts from resolving escalations", () => {
    expect(evaluateDecision("VIEWER", "PENDING", "APPROVE", null, "MEDIUM")).toMatchObject({ ok: false, code: "FORBIDDEN" });
    expect(evaluateDecision("ANALYST", "ESCALATED", "APPROVE", null, "MEDIUM")).toMatchObject({ ok: false, code: "FORBIDDEN" });
  });

  it.each([undefined, null, "", "   ", "too short"])("requires a meaningful reason to reject or escalate (%j)", (reason) => {
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", reason, "MEDIUM")).toMatchObject({ ok: false, code: "VALIDATION" });
    expect(evaluateDecision("ANALYST", "PENDING", "ESCALATE", reason, "MEDIUM")).toMatchObject({ ok: false, code: "VALIDATION" });
  });

  it("allows approval without a note and trims notes", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "APPROVE", "  ", "MEDIUM")).toEqual({ ok: true, nextStatus: "APPROVED", reason: null });
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", `  ${REASON}  `, "MEDIUM")).toMatchObject({ ok: true, reason: REASON });
  });

  it("rejects overly long reasons", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", "x".repeat(1001), "MEDIUM")).toMatchObject({ ok: false, code: "VALIDATION" });
  });
});

describe("availableDecisions", () => {
  it("reflects role and status", () => {
    expect(availableDecisions("VIEWER", "PENDING", "MEDIUM")).toEqual([]);
    expect(availableDecisions("ANALYST", "PENDING", "MEDIUM")).toEqual(["APPROVE", "REJECT", "ESCALATE"]);
    expect(availableDecisions("ANALYST", "ESCALATED", "MEDIUM")).toEqual([]);
    expect(availableDecisions("ADMIN", "ESCALATED", "MEDIUM")).toEqual(["APPROVE", "REJECT"]);
    expect(availableDecisions("ADMIN", "APPROVED", "MEDIUM")).toEqual([]);
  });
});

describe("high-risk approval policy", () => {
  it("forbids analysts from approving high-risk cases with a clear message", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "APPROVE", null, "HIGH")).toEqual({
      ok: false,
      code: "FORBIDDEN",
      message: "High-risk cases can only be approved by an admin.",
    });
  });

  it("still lets analysts reject or escalate high-risk cases", () => {
    expect(evaluateDecision("ANALYST", "PENDING", "REJECT", REASON, "HIGH")).toMatchObject({ ok: true, nextStatus: "REJECTED" });
    expect(evaluateDecision("ANALYST", "PENDING", "ESCALATE", REASON, "HIGH")).toMatchObject({ ok: true, nextStatus: "ESCALATED" });
  });

  it.each(["LOW", "MEDIUM"] as const)("leaves %s-risk approvals by analysts unchanged", (tier) => {
    expect(evaluateDecision("ANALYST", "PENDING", "APPROVE", null, tier)).toMatchObject({ ok: true, nextStatus: "APPROVED" });
  });

  it("lets admins approve high-risk cases, pending or escalated", () => {
    expect(evaluateDecision("ADMIN", "PENDING", "APPROVE", null, "HIGH")).toMatchObject({ ok: true, nextStatus: "APPROVED" });
    expect(evaluateDecision("ADMIN", "ESCALATED", "APPROVE", null, "HIGH")).toMatchObject({ ok: true, nextStatus: "APPROVED" });
  });

  it("keeps finalized and invalid-transition errors ahead of the policy check", () => {
    expect(evaluateDecision("ANALYST", "APPROVED", "APPROVE", null, "HIGH")).toMatchObject({ code: "INVALID_TRANSITION" });
    expect(evaluateDecision("VIEWER", "PENDING", "APPROVE", null, "HIGH")).toMatchObject({
      code: "FORBIDDEN",
      message: "Your role cannot make decisions on KYC cases.",
    });
  });

  it("removes Approve from analysts' available decisions only for high risk", () => {
    expect(availableDecisions("ANALYST", "PENDING", "HIGH")).toEqual(["REJECT", "ESCALATE"]);
    expect(availableDecisions("ANALYST", "PENDING", "LOW")).toEqual(["APPROVE", "REJECT", "ESCALATE"]);
    expect(availableDecisions("ADMIN", "PENDING", "HIGH")).toEqual(["APPROVE", "REJECT", "ESCALATE"]);
    expect(availableDecisions("ADMIN", "ESCALATED", "HIGH")).toEqual(["APPROVE", "REJECT"]);
    expect(availableDecisions("VIEWER", "PENDING", "HIGH")).toEqual([]);
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
