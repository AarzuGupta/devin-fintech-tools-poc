import { RoleBadge } from "@/components/Badges";
import { DECISION_LABELS, STATUS_LABELS, formatDateTime } from "@/lib/format";
import type { AuditEventView } from "@/lib/services/auditService";

export function AuditTimeline({ events }: { events: AuditEventView[] }) {
  if (events.length === 0) {
    return <p className="text-fg-muted">No decisions recorded yet.</p>;
  }
  return (
    <ol className="space-y-3" data-testid="decision-history">
      {events.map((e) => (
        <li key={e.id} className="relative border-l-2 border-stroke pl-3">
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            <span className="font-semibold">{DECISION_LABELS[e.action] ?? e.action}</span>
            <span className="text-fg-muted">
              {STATUS_LABELS[e.previousState ?? ""] ?? e.previousState ?? "—"} → {STATUS_LABELS[e.newState ?? ""] ?? e.newState ?? "—"}
            </span>
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-2 text-[12px] text-fg-muted">
            <span>{e.actor.name}</span>
            <RoleBadge role={e.actor.role} />
            <span>·</span>
            <time dateTime={new Date(e.createdAt).toISOString()}>{formatDateTime(e.createdAt)}</time>
          </div>
          {e.reason && <p className="mt-1 rounded bg-[#fafafa] px-2 py-1.5 text-[13px]">{e.reason}</p>}
        </li>
      ))}
    </ol>
  );
}
