import { prisma } from "@/lib/db";
import type { Actor, Role } from "@/lib/auth/roles";
import { applySeed } from "@/lib/seed/applySeed";

export { prisma };

export async function resetDb() {
  await applySeed(prisma);
}

const ACTORS: Record<string, Actor> = {
  viewer: { id: "u-viewer", name: "Priya Shah", email: "priya.shah@example.test", role: "VIEWER" },
  analyst: { id: "u-analyst-1", name: "Marcus Lee", email: "marcus.lee@example.test", role: "ANALYST" },
  analyst2: { id: "u-analyst-2", name: "Elena Rossi", email: "elena.rossi@example.test", role: "ANALYST" },
  admin: { id: "u-admin", name: "Jordan Blake", email: "jordan.blake@example.test", role: "ADMIN" },
};

export const actors = ACTORS as Record<"viewer" | "analyst" | "analyst2" | "admin", Actor>;

export async function findCaseIdByStatus(status: string, skip = 0): Promise<string> {
  const c = await prisma.kycCase.findMany({ where: { status }, orderBy: { id: "asc" }, skip, take: 1 });
  if (!c[0]) throw new Error(`No seeded case with status ${status}`);
  return c[0].id;
}

export function auditCount(caseId?: string) {
  return prisma.auditEvent.count({ where: caseId ? { entityId: caseId } : {} });
}

export type { Role };
