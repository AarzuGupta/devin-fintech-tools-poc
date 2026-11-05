import { beforeAll, describe, expect, it } from "vitest";
import { resolveActor, signSession, verifySession } from "@/lib/auth/session";
import { prisma, resetDb } from "./helpers";

beforeAll(resetDb);

describe("demo session cookie", () => {
  it("round-trips a signed user id", () => {
    expect(verifySession(signSession("u-analyst-1"))).toBe("u-analyst-1");
  });

  it("rejects a tampered signature", () => {
    const token = signSession("u-viewer");
    const [payload, sig] = token.split(".");
    const flipped = sig.slice(0, -1) + (sig.endsWith("A") ? "B" : "A");
    expect(verifySession(`${payload}.${flipped}`)).toBeNull();
  });

  it("rejects a payload swapped to another user (privilege escalation attempt)", () => {
    const viewerSig = signSession("u-viewer").split(".")[1];
    const adminPayload = Buffer.from("u-admin").toString("base64url");
    expect(verifySession(`${adminPayload}.${viewerSig}`)).toBeNull();
  });

  it("rejects malformed and empty tokens", () => {
    for (const token of [undefined, null, "", "abc", "a.b.c", "u-admin", "dS1hZG1pbg."]) {
      expect(verifySession(token)).toBeNull();
    }
  });

  it("rejects tokens signed with a different secret", () => {
    const original = process.env.SESSION_SECRET;
    process.env.SESSION_SECRET = "another-secret-another-secret-another-1";
    const forged = signSession("u-admin");
    process.env.SESSION_SECRET = original;
    expect(verifySession(forged)).toBeNull();
  });
});

describe("resolveActor", () => {
  it("takes the role from the database, not the token", async () => {
    const actor = await resolveActor(prisma, signSession("u-viewer"));
    expect(actor).toMatchObject({ id: "u-viewer", role: "VIEWER" });

    await prisma.user.update({ where: { id: "u-viewer" }, data: { role: "ANALYST" } });
    expect(await resolveActor(prisma, signSession("u-viewer"))).toMatchObject({ role: "ANALYST" });
    await prisma.user.update({ where: { id: "u-viewer" }, data: { role: "VIEWER" } });
  });

  it("returns null for unknown users or tampered tokens", async () => {
    expect(await resolveActor(prisma, signSession("u-does-not-exist"))).toBeNull();
    expect(await resolveActor(prisma, "garbage")).toBeNull();
    expect(await resolveActor(prisma, undefined)).toBeNull();
  });
});
