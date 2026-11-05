"use client";

import { Button, Spinner, Toolbar, ToolbarDivider } from "@fluentui/react-components";
import { ArrowClockwise20Regular, FilterDismiss20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { FilterSelect, UrlSearchBox } from "@/components/FilterControls";
import { useUrlState } from "@/hooks/useUrlState";
import { CASE_STATUSES, CUSTOMER_TYPES, RISK_TIERS } from "@/lib/domain/kyc";
import { CUSTOMER_TYPE_LABELS, RISK_LABELS, STATUS_LABELS } from "@/lib/format";

export function CaseToolbar({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const { params, setParams, isPending } = useUrlState();
  const [refreshing, startRefresh] = useTransition();
  const [searchKey, setSearchKey] = useState(0);

  const hasFilters = ["q", "status", "risk", "type"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-stroke bg-surface px-3 py-2">
      <Toolbar aria-label="Queue commands" size="small" className="!p-0">
        <Button
          appearance="subtle"
          icon={<ArrowClockwise20Regular />}
          onClick={() => startRefresh(() => router.refresh())}
          disabled={refreshing}
        >
          Refresh
        </Button>
        <Button
          appearance="subtle"
          icon={<FilterDismiss20Regular />}
          disabled={!hasFilters}
          onClick={() => {
            setSearchKey((k) => k + 1);
            setParams({ q: null, status: null, risk: null, type: null });
          }}
        >
          Clear filters
        </Button>
        <ToolbarDivider />
      </Toolbar>
      <UrlSearchBox key={searchKey} placeholder="Search case, customer, reason, analyst" label="Search cases" className="w-44" />
      <FilterSelect label="Status" param="status" options={CASE_STATUSES} labels={STATUS_LABELS} />
      <FilterSelect label="Risk" param="risk" options={RISK_TIERS} labels={RISK_LABELS} />
      <FilterSelect label="Type" param="type" options={CUSTOMER_TYPES} labels={CUSTOMER_TYPE_LABELS} />
      <div className="relative ml-auto flex items-center text-[12px] whitespace-nowrap text-fg-muted" aria-live="polite">
        {(isPending || refreshing) && (
          <Spinner size="extra-tiny" aria-label="Loading" className="absolute right-full mr-2" />
        )}
        <span>
          {resultCount} {resultCount === 1 ? "case" : "cases"}
        </span>
      </div>
    </div>
  );
}
