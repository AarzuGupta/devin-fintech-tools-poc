"use client";

import { Warning16Filled } from "@fluentui/react-icons";
import { RiskIndicator, StatusBadge } from "@/components/Badges";
import { DataTable, type Column } from "@/components/DataTable";
import { useUrlState } from "@/hooks/useUrlState";
import { CUSTOMER_TYPE_LABELS, formatDate } from "@/lib/format";
import type { CaseRow } from "./types";

const COLUMNS: Column<CaseRow>[] = [
  {
    key: "id",
    header: "Case ID",
    sortKey: "id",
    render: (r) => <span className="font-semibold whitespace-nowrap text-brand">{r.id}</span>,
  },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerId",
    render: (r) => (
      <div className="leading-tight">
        <div className="font-mono text-[12px]">{r.customerId}</div>
        <div className="max-w-[180px] truncate text-[12px] text-fg-muted" title={r.customerName}>{r.customerName}</div>
      </div>
    ),
  },
  { key: "type", header: "Type", sortKey: "customerType", render: (r) => CUSTOMER_TYPE_LABELS[r.customerType] },
  { key: "risk", header: "Risk", sortKey: "riskTier", render: (r) => <RiskIndicator tier={r.riskTier} /> },
  { key: "reason", header: "Review reason", sortKey: "reviewReason", render: (r) => r.reviewReason },
  { key: "status", header: "Status", sortKey: "status", render: (r) => <StatusBadge status={r.status} /> },
  {
    key: "assignee",
    header: "Assigned to",
    sortKey: "assignedReviewer",
    render: (r) => r.assignedReviewer ?? <span className="text-fg-subtle">Unassigned</span>,
  },
  { key: "created", header: "Created", sortKey: "createdAt", render: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
  {
    key: "deadline",
    header: "Review deadline",
    sortKey: "reviewDeadline",
    render: (r) => (
      <span className={`inline-flex items-center gap-1 whitespace-nowrap ${r.overdue ? "font-semibold text-[#b10e1c]" : ""}`}>
        {r.overdue && <Warning16Filled aria-hidden />}
        {formatDate(r.reviewDeadline)}
        {r.overdue && <span className="sr-only">(overdue)</span>}
      </span>
    ),
  },
];

export function CaseTable({ rows, selectedId }: { rows: CaseRow[]; selectedId: string | null }) {
  const { params, setParams } = useUrlState();
  const field = params.get("sort") ?? "reviewDeadline";
  const dir = params.get("dir") === "desc" ? "desc" : "asc";

  return (
    <DataTable
      label="KYC review queue"
      rows={rows}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      selectedId={selectedId}
      onRowClick={(r) => setParams({ case: r.id })}
      sort={{ field, dir }}
      onSort={(f) => setParams({ sort: f, dir: f === field && dir === "asc" ? "desc" : "asc" })}
      empty={
        <div>
          <p className="font-semibold text-fg">No cases match your filters</p>
          <p className="mt-1">Try a different search term or clear the filters.</p>
        </div>
      }
    />
  );
}
