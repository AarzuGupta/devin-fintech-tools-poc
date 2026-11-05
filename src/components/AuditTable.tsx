"use client";

import { RoleBadge, StatusBadge } from "./Badges";
import { DataTable, type Column } from "./DataTable";

export interface AuditRow {
  id: string;
  createdAt: string;
  createdAtLabel: string;
  entityType: string;
  entityId: string;
  action: string;
  previousState: string | null;
  newState: string | null;
  reason: string | null;
  actorName: string;
  actorRole: string;
}

const COLUMNS: Column<AuditRow>[] = [
  { key: "time", header: "Timestamp", render: (r) => <time className="whitespace-nowrap" dateTime={r.createdAt}>{r.createdAtLabel}</time> },
  {
    key: "entity",
    header: "Record",
    render: (r) => (
      <div className="leading-tight">
        <div className="font-medium">{r.entityId}</div>
        <div className="font-mono text-[11px] text-fg-muted">{r.entityType}</div>
      </div>
    ),
  },
  { key: "action", header: "Action", render: (r) => <span className="font-mono text-[12px]">{r.action}</span> },
  {
    key: "change",
    header: "Status change",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {r.previousState ? <StatusBadge status={r.previousState} /> : "—"}
        <span aria-label="to">→</span>
        {r.newState ? <StatusBadge status={r.newState} /> : "—"}
      </span>
    ),
  },
  {
    key: "actor",
    header: "Actor",
    render: (r) => (
      <span className="inline-flex items-center gap-1.5 whitespace-nowrap">
        {r.actorName} <RoleBadge role={r.actorRole} />
      </span>
    ),
  },
  { key: "reason", header: "Reason", className: "max-w-[420px]", render: (r) => <span className="line-clamp-2">{r.reason ?? "—"}</span> },
];

export function AuditTable({ rows }: { rows: AuditRow[] }) {
  return <DataTable label="Audit events" rows={rows} columns={COLUMNS} getRowId={(r) => r.id} empty="No audit events match your search." />;
}
