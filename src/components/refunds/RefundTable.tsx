"use client";

import { DataTable, type Column } from "@/components/DataTable";
import { useUrlState } from "@/hooks/useUrlState";
import { formatMoney } from "@/lib/domain/refunds";
import { formatDate } from "@/lib/format";
import { REFUND_REASON_LABELS } from "./labels";
import { RefundStatusBadge } from "./RefundStatusBadge";
import type { RefundRow } from "./types";

const money = "text-right whitespace-nowrap";

const COLUMNS: Column<RefundRow>[] = [
  { key: "id", header: "Refund ID", sortKey: "id", render: (r) => <span className="font-medium whitespace-nowrap text-brand">{r.id}</span> },
  { key: "txn", header: "Transaction", render: (r) => <span className="font-mono text-[12px] whitespace-nowrap">{r.transactionId}</span> },
  {
    key: "customer",
    header: "Customer",
    sortKey: "customerId",
    render: (r) => (
      <div className="leading-tight">
        <div className="font-mono text-[12px] text-fg">{r.customerId}</div>
        <div className="max-w-[160px] truncate text-[12px] text-fg-muted" title={r.customerName}>{r.customerName}</div>
      </div>
    ),
  },
  { key: "original", header: "Original", className: money, render: (r) => <span className="text-fg-muted">{formatMoney(r.originalAmountMinor, r.currency)}</span> },
  { key: "amount", header: "Refund", sortKey: "refundAmount", className: money, render: (r) => <span className="font-medium">{formatMoney(r.refundAmountMinor, r.currency)}</span> },
  { key: "currency", header: "Currency", render: (r) => <span className="text-fg-muted">{r.currency}</span> },
  { key: "reason", header: "Reason", render: (r) => <span className="whitespace-nowrap">{REFUND_REASON_LABELS[r.reason]}</span> },
  { key: "status", header: "Status", sortKey: "status", render: (r) => <RefundStatusBadge status={r.status} /> },
  { key: "created", header: "Created", sortKey: "createdAt", render: (r) => <span className="whitespace-nowrap">{formatDate(r.createdAt)}</span> },
  {
    key: "completed",
    header: "Completed",
    sortKey: "completedAt",
    render: (r) => (r.completedAt ? <span className="whitespace-nowrap">{formatDate(r.completedAt)}</span> : <span className="text-fg-subtle">—</span>),
  },
];

export function RefundTable({ rows, selectedId }: { rows: RefundRow[]; selectedId: string | null }) {
  const { params, setParams } = useUrlState();
  const field = params.get("sort") ?? "createdAt";
  const dir = params.get("dir") === "asc" ? "asc" : params.get("dir") === "desc" ? "desc" : field === "createdAt" ? "desc" : "asc";

  return (
    <DataTable
      label="Refunds"
      rows={rows}
      columns={COLUMNS}
      getRowId={(r) => r.id}
      selectedId={selectedId}
      onRowClick={(r) => setParams({ refund: r.id })}
      sort={{ field, dir }}
      onSort={(f) => setParams({ sort: f, dir: f === field && dir === "asc" ? "desc" : "asc", page: null })}
      empty={
        <div>
          <p className="font-semibold text-fg">No refunds match your filters</p>
          <p className="mt-1">Try a wider date range, a different search term, or clear the filters.</p>
        </div>
      }
    />
  );
}
