import type { Prisma, PrismaClient } from "@prisma/client";
import { requirePermission } from "@/lib/auth/permissions";
import type { Actor } from "@/lib/auth/roles";

type Db = PrismaClient | Prisma.TransactionClient;

export interface AuditEventInput {
  entityType: string;
  entityId: string;
  actorId: string;
  action: string;
  previousState?: string | null;
  newState?: string | null;
  reason?: string | null;
}

export type AuditEventView = {
  id: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  reason: string | null;
  createdAt: Date;
  actor: { id: string; name: string; role: string };
};

const auditInclude = { actor: { select: { id: true, name: true, role: true } } } as const;

/** Append an audit event. Pass the transaction client so the write is atomic with the change. */
export function recordAuditEvent(db: Db, event: AuditEventInput) {
  return db.auditEvent.create({ data: event });
}

/** History for one entity. Callers must authorize access to the entity first. */
export function getEntityHistory(db: Db, entityType: string, entityId: string): Promise<AuditEventView[]> {
  return db.auditEvent.findMany({
    where: { entityType, entityId },
    include: auditInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
  });
}

export interface AuditQuery {
  entityType?: string;
  search?: string;
  limit?: number;
}

/** Global audit log (admin only). */
export async function listAuditEvents(
  db: Db,
  actor: Actor | null,
  query: AuditQuery = {},
): Promise<AuditEventView[]> {
  requirePermission(actor, "audit:read-all");
  const search = query.search?.trim();
  return db.auditEvent.findMany({
    where: {
      ...(query.entityType ? { entityType: query.entityType } : {}),
      ...(search
        ? {
            OR: [
              { entityId: { contains: search } },
              { reason: { contains: search } },
              { actor: { name: { contains: search } } },
            ],
          }
        : {}),
    },
    include: auditInclude,
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    take: Math.min(query.limit ?? 200, 500),
  });
}
