import { CaseDetailPanel } from "@/components/kyc/CaseDetailPanel";
import { CaseTable } from "@/components/kyc/CaseTable";
import { CaseToolbar } from "@/components/kyc/CaseToolbar";
import type { CaseRow } from "@/components/kyc/types";
import { PageHeader } from "@/components/PageHeader";
import { requireActor } from "@/lib/auth/current";
import { prisma } from "@/lib/db";
import { isCaseStatus, isOverdue } from "@/lib/domain/kyc";
import { isAppError } from "@/lib/errors";
import { getCase, getQueueSummary, listCases, type CaseDetail } from "@/lib/services/kycService";
import { flattenSearchParams, type RawSearchParams } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

export default async function KycQueuePage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const actor = await requireActor();
  const params = flattenSearchParams(await searchParams);
  const now = new Date();

  const [cases, summary] = await Promise.all([listCases(prisma, actor, params), getQueueSummary(prisma, actor, now)]);

  let detail: CaseDetail | null = null;
  let detailError: string | null = null;
  if (params.case) {
    try {
      detail = await getCase(prisma, actor, params.case);
    } catch (error) {
      if (isAppError(error) && error.code === "NOT_FOUND") detailError = error.message;
      else throw error;
    }
  }

  const rows: CaseRow[] = cases.map((c) => ({
    id: c.id,
    customerId: c.customerId,
    customerName: c.customerName,
    customerType: c.customerType,
    riskTier: c.riskTier,
    reviewReason: c.reviewReason,
    status: c.status,
    assignedReviewer: c.assignedReviewer?.name ?? null,
    createdAt: c.createdAt.toISOString(),
    reviewDeadline: c.reviewDeadline.toISOString(),
    overdue: isCaseStatus(c.status) && isOverdue(c.reviewDeadline, c.status, now),
  }));

  const closeParams = new URLSearchParams(params);
  closeParams.delete("case");
  const closeHref = closeParams.size ? `/kyc?${closeParams}` : "/kyc";

  return (
    <>
      <PageHeader
        title="KYC review queue"
        description="Review identity verification cases and record decisions."
        meta={
          <span data-testid="queue-summary">
            {summary.pending} pending · {summary.escalated} escalated ·{" "}
            <span className={summary.overdue ? "font-semibold text-[#b10e1c]" : ""}>{summary.overdue} overdue</span>
          </span>
        }
      />
      <CaseToolbar resultCount={rows.length} />
      <div className="relative flex min-h-0 flex-1">
        <div className="min-w-0 flex-1 overflow-auto bg-surface">
          <CaseTable rows={rows} selectedId={params.case ?? null} />
        </div>
        {(detail || detailError) && (
          <div className="absolute inset-y-0 right-0 z-20 w-[440px] max-w-full border-l border-stroke shadow-[-4px_0_12px_rgba(0,0,0,0.06)] xl:static xl:shadow-none">
            {detail ? (
              <CaseDetailPanel detail={detail} role={actor.role} closeHref={closeHref} />
            ) : (
              <div role="alert" className="h-full bg-surface p-5">
                <h2 className="font-semibold">Case not found</h2>
                <p className="mt-1 text-fg-muted">{detailError}</p>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
