import type { ReactNode } from "react";
import { RiskIndicator, SignalOutcomeIcon, StatusBadge } from "@/components/Badges";
import type { Role } from "@/lib/auth/roles";
import { availableDecisions, isCaseStatus, isFinalStatus, isOverdue } from "@/lib/domain/kyc";
import { CUSTOMER_TYPE_LABELS, SIGNAL_LABELS, formatDateTime } from "@/lib/format";
import type { CaseDetail } from "@/lib/services/kycService";
import { AuditTimeline } from "./AuditTimeline";
import { DecisionActions } from "./DecisionActions";
import { PanelCloseLink } from "./PanelCloseLink";

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-stroke px-5 py-4">
      <h3 className="mb-3 text-[13px] font-semibold tracking-wide text-fg-muted uppercase">{title}</h3>
      {children}
    </section>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] text-fg-muted">{label}</dt>
      <dd className="mt-0.5">{children}</dd>
    </div>
  );
}

function readOnlyReason(role: Role, status: string): string {
  if (isCaseStatus(status) && isFinalStatus(status)) return "This case is finalized. No further actions are available.";
  if (role === "VIEWER") return "Your role (Viewer) is read-only.";
  if (status === "ESCALATED") return "Escalated cases can only be resolved by an admin.";
  return "No actions available.";
}

export function CaseDetailPanel({ detail, role, closeHref }: { detail: CaseDetail; role: Role; closeHref: string }) {
  const status = isCaseStatus(detail.status) ? detail.status : "PENDING";
  const decisions = availableDecisions(role, status);
  const overdue = isOverdue(detail.reviewDeadline, status);

  return (
    <aside aria-label={`Case ${detail.id} details`} className="flex h-full flex-col bg-surface" data-testid="case-panel">
      <div className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <p className="text-[12px] text-fg-muted">KYC case</p>
          <h2 className="truncate text-lg font-semibold">{detail.id}</h2>
          <p className="truncate text-fg-muted">{detail.customerName}</p>
        </div>
        <div className="flex items-center gap-2">
          <StatusBadge status={detail.status} />
          <PanelCloseLink href={closeHref} />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <Section title="Decision">
          <DecisionActions
            key={`${detail.id}-${detail.status}`}
            caseId={detail.id}
            status={detail.status}
            decisions={decisions}
            readOnlyReason={decisions.length ? null : readOnlyReason(role, detail.status)}
          />
        </Section>

        <Section title="Review context">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Field label="Customer ID">
              <span className="font-mono text-[12px]">{detail.customerId}</span>
            </Field>
            <Field label="Customer type">{CUSTOMER_TYPE_LABELS[detail.customerType]}</Field>
            <Field label="Country">{detail.country}</Field>
            <Field label="Risk tier">
              <RiskIndicator tier={detail.riskTier} />
            </Field>
            <div className="col-span-2">
              <Field label="Review reason">{detail.reviewReason}</Field>
            </div>
            <Field label="Assigned reviewer">{detail.assignedReviewer?.name ?? "Unassigned"}</Field>
            <Field label="Review deadline">
              <span className={overdue ? "font-semibold text-[#b10e1c]" : ""}>
                {formatDateTime(detail.reviewDeadline)}
                {overdue && " (overdue)"}
              </span>
            </Field>
            <Field label="Created">{formatDateTime(detail.createdAt)}</Field>
            <Field label="Last updated">{formatDateTime(detail.updatedAt)}</Field>
            {detail.decidedAt && <Field label="Decided">{formatDateTime(detail.decidedAt)}</Field>}
          </dl>
        </Section>

        <Section title="Verification signals">
          <ul className="space-y-2.5">
            {detail.signals.map((s) => (
              <li key={s.id} className="flex gap-2">
                <span className="mt-0.5 shrink-0">
                  <SignalOutcomeIcon outcome={s.outcome} />
                </span>
                <div>
                  <div className="font-semibold">
                    {SIGNAL_LABELS[s.type] ?? s.type}{" "}
                    <span className="font-normal text-fg-muted">· {s.outcome === "REVIEW" ? "Needs review" : s.outcome === "PASS" ? "Pass" : "Fail"}</span>
                  </div>
                  <p className="text-[12px] text-fg-muted">{s.explanation}</p>
                </div>
              </li>
            ))}
          </ul>
        </Section>

        <Section title="Decision history">
          <AuditTimeline events={detail.history} />
        </Section>
      </div>
    </aside>
  );
}
