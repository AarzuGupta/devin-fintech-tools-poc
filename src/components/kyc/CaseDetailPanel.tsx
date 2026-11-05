import { RiskIndicator, SignalOutcomeIcon, StatusBadge } from "@/components/Badges";
import { DetailField as Field, DetailSection as Section } from "@/components/DetailPanel";
import { PanelCloseLink } from "@/components/PanelCloseLink";
import type { Role } from "@/lib/auth/roles";
import {
  HIGH_RISK_APPROVAL_MESSAGE,
  allowedDecisions,
  availableDecisions,
  isCaseStatus,
  isFinalStatus,
  isOverdue,
  isRiskTier,
} from "@/lib/domain/kyc";
import { CUSTOMER_TYPE_LABELS, SIGNAL_LABELS, formatDateTime } from "@/lib/format";
import type { CaseDetail } from "@/lib/services/kycService";
import { AuditTimeline } from "./AuditTimeline";
import { DecisionActions } from "./DecisionActions";

function readOnlyReason(role: Role, status: string): string {
  if (isCaseStatus(status) && isFinalStatus(status)) return "This case is finalized. No further actions are available.";
  if (role === "VIEWER") return "Your role (Viewer) is read-only.";
  if (status === "ESCALATED") return "Escalated cases can only be resolved by an admin.";
  return "No actions available.";
}

export function CaseDetailPanel({ detail, role, closeHref }: { detail: CaseDetail; role: Role; closeHref: string }) {
  const status = isCaseStatus(detail.status) ? detail.status : "PENDING";
  // Unknown tiers are treated as high risk so the approval restriction fails closed.
  const riskTier = isRiskTier(detail.riskTier) ? detail.riskTier : "HIGH";
  const decisions = availableDecisions(role, status, riskTier);
  const approvalRestricted =
    decisions.length > 0 && allowedDecisions(status).includes("APPROVE") && !decisions.includes("APPROVE");
  const overdue = isOverdue(detail.reviewDeadline, status);

  return (
    <aside aria-label={`Case ${detail.id} details`} className="flex h-full flex-col bg-surface" data-testid="case-panel">
      <div className="flex items-start justify-between gap-3 px-5 pt-5 pb-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold tracking-[0.06em] text-fg-subtle uppercase">KYC case</p>
          <h2 className="mt-0.5 truncate text-[17px] leading-6 font-semibold tracking-[-0.01em]">{detail.id}</h2>
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
            approvalRestriction={approvalRestricted ? `${HIGH_RISK_APPROVAL_MESSAGE} You can reject or escalate it.` : null}
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
              <span className={overdue ? "font-medium text-danger" : ""}>
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
          <ul className="divide-y divide-stroke-subtle rounded-[10px] border border-stroke">
            {detail.signals.map((s) => (
              <li key={s.id} className="flex gap-2.5 px-3 py-2.5">
                <span className="mt-0.5 shrink-0">
                  <SignalOutcomeIcon outcome={s.outcome} />
                </span>
                <div>
                  <div className="font-medium">
                    {SIGNAL_LABELS[s.type] ?? s.type}{" "}
                    <span className="font-normal text-fg-muted">· {s.outcome === "REVIEW" ? "Needs review" : s.outcome === "PASS" ? "Pass" : "Fail"}</span>
                  </div>
                  <p className="mt-0.5 text-[12px] text-fg-muted">{s.explanation}</p>
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
