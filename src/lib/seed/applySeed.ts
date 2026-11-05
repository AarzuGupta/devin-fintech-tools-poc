import type { PrismaClient } from "@prisma/client";
import { buildSeedData } from "./seedData";

/** Wipes all data and loads the deterministic dataset. */
export async function applySeed(db: PrismaClient) {
  const { users, cases, auditEvents } = buildSeedData();
  await db.$transaction([
    db.auditEvent.deleteMany(),
    db.verificationSignal.deleteMany(),
    db.kycCase.deleteMany(),
    db.user.deleteMany(),
    db.user.createMany({ data: users }),
    ...cases.map(({ signals, ...kycCase }) =>
      db.kycCase.create({ data: { ...kycCase, updatedAt: kycCase.decidedAt ?? kycCase.createdAt, signals: { create: signals } } }),
    ),
    db.auditEvent.createMany({ data: auditEvents }),
  ]);
  return { users: users.length, cases: cases.length, auditEvents: auditEvents.length };
}
