"use client";

import { Button, Spinner, Toolbar, ToolbarDivider } from "@fluentui/react-components";
import { ArrowClockwise20Regular, FilterDismiss20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterSelect, UrlSearchBox } from "@/components/FilterControls";
import { useUrlState } from "@/hooks/useUrlState";
import { CREATED_RANGES, CURRENCIES, DEFAULT_RANGE, REFUND_STATUSES } from "@/lib/domain/refunds";
import { CURRENCY_LABELS, RANGE_LABELS, REFUND_STATUS_LABELS } from "./labels";

const FILTER_PARAMS = ["q", "status", "currency", "range", "simulate"];

/** `resultCount` is null when the upstream failed, so no count is claimed. */
export function RefundToolbar({ resultCount }: { resultCount: number | null }) {
  const router = useRouter();
  const { params, setParams, isPending } = useUrlState();
  const [refreshing, startRefresh] = useTransition();
  const [searchKey, setSearchKey] = useState(0);
  const hasFilters = FILTER_PARAMS.some((k) => params.get(k));
  const simulate = params.get("simulate");

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-stroke bg-surface px-3 py-2">
      <Toolbar aria-label="Refund commands" size="small" className="!p-0">
        <Button appearance="subtle" icon={<ArrowClockwise20Regular />} onClick={() => startRefresh(() => router.refresh())} disabled={refreshing}>
          Refresh
        </Button>
        <Button
          appearance="subtle"
          icon={<FilterDismiss20Regular />}
          disabled={!hasFilters}
          onClick={() => {
            setSearchKey((k) => k + 1);
            setParams(Object.fromEntries([...FILTER_PARAMS, "page"].map((k) => [k, null])));
          }}
        >
          Clear filters
        </Button>
        <ToolbarDivider />
      </Toolbar>
      <UrlSearchBox key={searchKey} placeholder="Refund, transaction, customer" label="Search refunds" className="w-36" />
      <FilterSelect label="Status" param="status" options={REFUND_STATUSES} labels={REFUND_STATUS_LABELS} />
      <FilterSelect label="Currency" param="currency" options={CURRENCIES} labels={CURRENCY_LABELS} />
      <FilterSelect label="Created" param="range" options={CREATED_RANGES} labels={RANGE_LABELS} defaultValue={DEFAULT_RANGE} />
      {simulate && (
        <span className="rounded-[5px] bg-[#fdf4e3] px-1.5 text-[11px] leading-[18px] font-medium text-[#8a4b00]" data-testid="simulation-chip">
          Demo: simulating “{simulate}” upstream
        </span>
      )}
      <div className="relative ml-auto flex items-center text-[12px] whitespace-nowrap text-fg-muted" aria-live="polite">
        {(isPending || refreshing) && <Spinner size="extra-tiny" aria-label="Loading" className="absolute right-full mr-2" />}
        {resultCount !== null && (
          <span>
            {resultCount} {resultCount === 1 ? "refund" : "refunds"}
          </span>
        )}
      </div>
    </div>
  );
}
