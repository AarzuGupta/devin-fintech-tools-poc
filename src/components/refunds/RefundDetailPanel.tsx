import { DetailField as Field, DetailSection as Section } from "@/components/DetailPanel";
import { PanelCloseLink } from "@/components/PanelCloseLink";
import { formatMoney, type Refund } from "@/lib/domain/refunds";
import { formatDateTime } from "@/lib/format";
import { EVENT_LABELS, REFUND_REASON_LABELS } from "./labels";
import { RefundStatusBadge } from "./RefundStatusBadge";

export function RefundDetailPanel({ refund, closeHref }: { refund: Refund; closeHref: string }) {
  const partial = refund.refundAmountMinor < refund.originalAmountMinor;
  return (
    <aside aria-label={`Refund ${refund.id} details`} className="flex h-full flex-col bg-surface" data-testid="refund-panel">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">Refund</p>
          <h2 className="mt-0.5 truncate text-[17px] leading-6 font-semibold tracking-[-0.01em]">{refund.id}</h2>
          <p className="truncate text-fg-muted">{refund.customerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <RefundStatusBadge status={refund.status} />
          <PanelCloseLink href={closeHref} label="Close refund details" />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Amount">
          <p className="text-[22px] leading-7 font-semibold tracking-[-0.015em] tabular-nums">{formatMoney(refund.refundAmountMinor, refund.currency)}</p>
          <p className="text-fg-muted tabular-nums">
            {partial ? "Partial refund" : "Full refund"} of {formatMoney(refund.originalAmountMinor, refund.currency)} {refund.currency}
          </p>
          {refund.failureReason && (
            <p className="mt-2 rounded-[10px] bg-[#fdeeee] px-3 py-2 text-[12px] text-[#a1232b]">Failure reason: {refund.failureReason}</p>
          )}
        </Section>

        <Section title="Transaction">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Refund ID"><span className="font-mono text-[12px]">{refund.id}</span></Field>
            <Field label="Transaction ID"><span className="font-mono text-[12px]">{refund.transactionId}</span></Field>
            <Field label="Customer ID"><span className="font-mono text-[12px]">{refund.customerId}</span></Field>
            <Field label="Product">{refund.product}</Field>
            <div className="col-span-2"><Field label="Original payment method">{refund.paymentMethod}</Field></div>
            <Field label="Reason">{REFUND_REASON_LABELS[refund.reason]}</Field>
            <Field label="Initiated by">{refund.initiatedBy.replace(/^(support|system):/, (_, k) => (k === "system" ? "System · " : "Support · "))}</Field>
            <Field label="Created">{formatDateTime(refund.createdAt)}</Field>
            <Field label="Completed">{refund.completedAt ? formatDateTime(refund.completedAt) : "Not completed"}</Field>
          </dl>
        </Section>

        <Section title="Status history">
          <ol className="space-y-3" data-testid="refund-history">
            {refund.events.map((e, i) => (
              <li key={i} className="flex gap-2.5">
                <span aria-hidden className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${e.type === "FAILED" ? "bg-danger" : e.type === "SUCCEEDED" ? "bg-[#248a3d]" : "bg-fg-subtle"}`} />
                <div>
                  <p className="font-medium">{EVENT_LABELS[e.type] ?? e.type}</p>
                  <p className="text-[12px] text-fg-muted">{formatDateTime(e.at)}{e.note ? ` · ${e.note}` : ""}</p>
                </div>
              </li>
            ))}
          </ol>
        </Section>

        <Section title="About this view">
          <p className="text-[12px] text-fg-muted">
            Read-only. Refunds are issued and changed in the payment provider; this dashboard cannot create, retry or cancel them.
          </p>
        </Section>
      </div>
    </aside>
  );
}
