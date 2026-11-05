import { AccessDenied } from "@/components/AccessDenied";
import { AuditSearch } from "@/components/AuditSearch";
import { AuditTable, type AuditRow } from "@/components/AuditTable";
import { PageHeader } from "@/components/PageHeader";
import { hasPermission } from "@/lib/auth/permissions";
import { requireActor } from "@/lib/auth/current";
import { prisma } from "@/lib/db";
import { formatDateTime } from "@/lib/format";
import { listAuditEvents } from "@/lib/services/auditService";
import { flattenSearchParams, type RawSearchParams } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

export default async function AuditPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const actor = await requireActor();
  if (!hasPermission(actor.role, "audit:read-all")) {
    return <AccessDenied message="The global audit log is available to admins only." />;
  }
  const params = flattenSearchParams(await searchParams);
  const events = await listAuditEvents(prisma, actor, { search: params.q });
  const rows: AuditRow[] = events.map((e) => ({
    id: e.id,
    createdAt: e.createdAt.toISOString(),
    createdAtLabel: formatDateTime(e.createdAt),
    entityType: e.entityType,
    entityId: e.entityId,
    action: e.action,
    previousState: e.previousState,
    newState: e.newState,
    reason: e.reason,
    actorName: e.actor.name,
    actorRole: e.actor.role,
  }));

  return (
    <>
      <PageHeader title="Audit log" description="Append-only record of decisions across internal tools (most recent 200)." />
      <div className="flex min-h-0 flex-1 px-6 pb-6">
        <div className="flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stroke bg-surface shadow-card">
          <AuditSearch count={rows.length} />
          <div className="min-h-0 flex-1 overflow-auto">
            <AuditTable rows={rows} />
          </div>
        </div>
      </div>
    </>
  );
}
