import { PageHeader } from "@/components/PageHeader";
import { Pagination } from "@/components/Pagination";
import { RefundDetailPanel } from "@/components/refunds/RefundDetailPanel";
import { RefundMetrics } from "@/components/refunds/RefundMetrics";
import { RefundTable } from "@/components/refunds/RefundTable";
import { RefundToolbar } from "@/components/refunds/RefundToolbar";
import { UpstreamError } from "@/components/refunds/UpstreamError";
import { RANGE_LABELS } from "@/components/refunds/labels";
import type { RefundRow, UpstreamErrorView } from "@/components/refunds/types";
import type { Actor } from "@/lib/auth/roles";
import { requireActor } from "@/lib/auth/current";
import type { Refund } from "@/lib/domain/refunds";
import { isAppError } from "@/lib/errors";
import { formatDateTime } from "@/lib/format";
import { RefundsApiError } from "@/lib/integrations/refundsApi/client";
import { refundsApiFromEnv } from "@/lib/integrations/refundsApi/server";
import { getRefundDashboard, getRefundDetail } from "@/lib/services/refundService";
import { flattenSearchParams, type RawSearchParams } from "@/lib/searchParams";

export const dynamic = "force-dynamic";

function toErrorView(error: unknown): UpstreamErrorView {
  if (error instanceof RefundsApiError) {
    return { kind: error.kind, message: error.message, requestId: error.details.requestId, retryAfterSeconds: error.details.retryAfterSeconds, retryable: error.retryable };
  }
  throw error;
}

const cardClass = "flex min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-stroke bg-surface shadow-card";
const panelClass =
  "absolute top-0 right-6 bottom-6 z-20 w-[384px] max-w-[calc(100%-3rem)] overflow-hidden rounded-xl border border-stroke bg-surface shadow-float xl:static xl:max-w-none xl:shrink-0 xl:shadow-card";

export default async function RefundsPage({ searchParams }: { searchParams: Promise<RawSearchParams> }) {
  const actor = await requireActor();
  const params = flattenSearchParams(await searchParams);
  return (
    <>
      <PageHeader
        title="Refunds"
        description="Monitor refunds reported by the finance service. Read-only: refunds are issued in the payment provider."
        meta={<span className="text-[12px]">Source: Finance API (local mock)</span>}
      />
      {/* No Suspense/loading boundary here: in production builds a streamed boundary left
          the table un-hydrated long enough to drop clicks (same failure as KYC's removed
          loading.tsx). Pending state is shown by the toolbar and sidebar spinners instead. */}
      <RefundsWorkspace actor={actor} params={params} />
    </>
  );
}

async function RefundsWorkspace({ actor, params }: { actor: Actor; params: Record<string, string> }) {
  const api = refundsApiFromEnv(params.simulate);
  const now = new Date();

  type Dashboard = Awaited<ReturnType<typeof getRefundDashboard>>;
  type Loaded<T> = { value: T; error?: undefined } | { value?: undefined; error: UpstreamErrorView };

  const [listResult, detailResult] = await Promise.all([
    getRefundDashboard(api, actor, params, now).then(
      (value): Loaded<Dashboard> => ({ value }),
      (e): Loaded<Dashboard> => ({ error: toErrorView(e) }),
    ),
    params.refund
      ? getRefundDetail(api, actor, params.refund).then(
          (value): Loaded<Refund | null> => ({ value }),
          (e): Loaded<Refund | null> => (isAppError(e) && e.code === "VALIDATION" ? { value: null } : { error: toErrorView(e) }),
        )
      : Promise.resolve(null),
  ]);

  const closeParams = new URLSearchParams(params);
  closeParams.delete("refund");
  const closeHref = closeParams.size ? `/refunds?${closeParams}` : "/refunds";

  const data = listResult.value ?? null;
  const rows: RefundRow[] = (data?.items ?? []).map((r) => ({
    id: r.id,
    transactionId: r.transactionId,
    customerId: r.customerId,
    customerName: r.customerName,
    originalAmountMinor: r.originalAmountMinor,
    refundAmountMinor: r.refundAmountMinor,
    currency: r.currency,
    reason: r.reason,
    status: r.status,
    createdAt: r.createdAt.toISOString(),
    completedAt: r.completedAt?.toISOString() ?? null,
  }));

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      {data && (
        <div className="px-6 pb-3">
          <p className="mb-2 text-[12px] text-fg-muted" data-testid="metrics-scope">
            Figures cover all {data.total} {data.total === 1 ? "refund" : "refunds"} matching the filters ({RANGE_LABELS[data.query.range].toLowerCase()}, by created date), not just this page · Data as of {formatDateTime(data.asOf)}
          </p>
          <RefundMetrics metrics={data.metrics} />
        </div>
      )}
      <div className="relative flex min-h-0 flex-1 gap-3 px-6 pb-6">
        <div className={cardClass}>
          <RefundToolbar resultCount={data ? data.total : null} />
          {data ? (
            <>
              <div className="min-h-0 flex-1 overflow-auto">
                <RefundTable rows={rows} selectedId={params.refund ?? null} />
              </div>
              <Pagination page={data.page} pageCount={data.pageCount} start={data.start} shown={rows.length} total={data.total} />
            </>
          ) : (
            listResult.error && <UpstreamError error={listResult.error} attemptedAt={now} />
          )}
        </div>
        {detailResult && (
          <div className={panelClass}>
            {detailResult.error ? (
              <UpstreamError error={detailResult.error} attemptedAt={now} compact />
            ) : detailResult.value ? (
              <RefundDetailPanel refund={detailResult.value} closeHref={closeHref} />
            ) : (
              <div role="alert" className="h-full bg-surface p-5">
                <h2 className="font-semibold">Refund not found</h2>
                <p className="mt-1 text-fg-muted">No refund with ID {params.refund} exists in the finance service.</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
