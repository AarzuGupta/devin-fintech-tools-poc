import { ErrorCircle20Filled } from "@fluentui/react-icons";
import { formatDateTime } from "@/lib/format";
import { RetryButton } from "./RetryButton";
import type { UpstreamErrorView } from "./types";

const TITLES: Record<string, string> = {
  TIMEOUT: "Finance service timed out",
  UNAVAILABLE: "Finance service unavailable",
  UPSTREAM_ERROR: "Finance service error",
  INVALID_RESPONSE: "Unexpected data from finance service",
  UNAUTHORIZED: "Dashboard not authorized",
};

/** Shown instead of figures/rows: nothing from an earlier load is displayed as current. */
export function UpstreamError({ error, attemptedAt, compact }: { error: UpstreamErrorView; attemptedAt: Date; compact?: boolean }) {
  return (
    <div role="alert" data-testid="upstream-error" className={compact ? "p-5" : "grid flex-1 place-items-center p-8"}>
      <div className="max-w-md text-center">
        <ErrorCircle20Filled className="mx-auto text-danger" aria-hidden />
        <h2 className="mt-2 text-[15px] font-semibold text-fg">{TITLES[error.kind] ?? "Could not load refunds"}</h2>
        <p className="mt-1 text-fg-muted">{error.message}</p>
        <p className="mt-1 text-fg-muted">No refund data is shown because it could not be loaded. Figures from earlier loads are not displayed.</p>
        <p className="mt-2 text-[12px] text-fg-subtle">
          Attempted {formatDateTime(attemptedAt)}
          {error.requestId && <> · Request {error.requestId}</>}
          {error.retryAfterSeconds && <> · Suggested retry in {error.retryAfterSeconds}s</>}
        </p>
        {error.retryable && (
          <div className="mt-3">
            <RetryButton />
          </div>
        )}
      </div>
    </div>
  );
}
