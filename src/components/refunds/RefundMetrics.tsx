import { CURRENCIES, RECENT_WINDOW_DAYS, formatMoney, type MoneyByCurrency, type RefundMetrics as Metrics } from "@/lib/domain/refunds";

function amounts(m: MoneyByCurrency): string[] {
  return CURRENCIES.filter((c) => m[c] !== undefined).map((c) => formatMoney(m[c]!, c));
}

function Tile({ label, value, detail, testId, tone }: { label: string; value: string; detail: string; testId: string; tone?: "danger" }) {
  return (
    <div className="min-w-0 rounded-xl border border-stroke bg-surface px-4 py-3 shadow-card" data-testid={testId}>
      <p className="text-[12px] text-fg-muted">{label}</p>
      <p className={`mt-0.5 truncate text-[20px] leading-7 font-semibold tracking-[-0.01em] tabular-nums ${tone === "danger" ? "text-danger" : "text-fg"}`}>{value}</p>
      <p className="truncate text-[12px] text-fg-muted tabular-nums" title={detail}>{detail}</p>
    </div>
  );
}

/** Primary currency as the headline; other currencies listed separately, never summed together. */
function moneyTile(m: MoneyByCurrency, countLabel: string) {
  const [first, ...rest] = amounts(m);
  return { value: first ?? formatMoney(0, "USD"), detail: [countLabel, ...rest].join(" · ") };
}

export function RefundMetrics({ metrics }: { metrics: Metrics }) {
  const refunded = moneyTile(metrics.refunded.amount, `${metrics.refunded.count} succeeded`);
  const recent = moneyTile(metrics.recent.amount, `${metrics.recent.count} created`);
  const inFlight = amounts(metrics.inFlight.amount).join(" · ") || "No open refunds";
  const failed = amounts(metrics.failed.amount).join(" · ") || "No failures";
  return (
    <div className="grid grid-cols-4 gap-3">
      <Tile testId="metric-refunded" label="Total refunded" {...refunded} />
      <Tile testId="metric-in-flight" label="Pending or processing" value={String(metrics.inFlight.count)} detail={inFlight} />
      <Tile testId="metric-failed" label="Failed" value={String(metrics.failed.count)} detail={failed} tone={metrics.failed.count ? "danger" : undefined} />
      <Tile testId="metric-recent" label={`Created in last ${RECENT_WINDOW_DAYS} days`} {...recent} />
    </div>
  );
}
