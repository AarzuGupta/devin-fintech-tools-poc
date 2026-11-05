"use client";

import { Button, SearchBox, Select, Spinner, Toolbar, ToolbarDivider } from "@fluentui/react-components";
import { ArrowClockwise20Regular, FilterDismiss20Regular } from "@fluentui/react-icons";
import { useRouter } from "next/navigation";
import { useEffect, useId, useRef, useState, useTransition } from "react";
import { useUrlState } from "@/hooks/useUrlState";
import { CASE_STATUSES, CUSTOMER_TYPES, RISK_TIERS } from "@/lib/domain/kyc";
import { CUSTOMER_TYPE_LABELS, RISK_LABELS, STATUS_LABELS } from "@/lib/format";

function FilterSelect({
  label,
  param,
  options,
  labels,
}: {
  label: string;
  param: string;
  options: readonly string[];
  labels: Record<string, string>;
}) {
  const { params, setParams } = useUrlState();
  const id = useId();
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-fg-muted">
        {label}
      </label>
      <Select id={id} size="small" value={params.get(param) ?? ""} onChange={(_, d) => setParams({ [param]: d.value || null })}>
        <option value="">All</option>
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </Select>
    </div>
  );
}

export function CaseToolbar({ resultCount }: { resultCount: number }) {
  const router = useRouter();
  const { params, setParams, isPending } = useUrlState();
  const [refreshing, startRefresh] = useTransition();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const lastPushed = useRef(params.get("q") ?? "");

  useEffect(() => {
    if (search === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = search;
      setParams({ q: search.trim() || null });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, setParams]);

  const hasFilters = ["q", "status", "risk", "type"].some((k) => params.get(k));

  return (
    <div className="flex flex-wrap items-center gap-x-3 gap-y-2 border-y border-stroke bg-surface px-4 py-1.5">
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
            setSearch("");
            lastPushed.current = "";
            setParams({ q: null, status: null, risk: null, type: null });
          }}
        >
          Clear filters
        </Button>
        <ToolbarDivider />
      </Toolbar>
      <SearchBox
        size="small"
        placeholder="Search case, customer, reason, analyst"
        aria-label="Search cases"
        value={search}
        onChange={(_, d) => setSearch(d.value)}
        className="w-72"
      />
      <FilterSelect label="Status" param="status" options={CASE_STATUSES} labels={STATUS_LABELS} />
      <FilterSelect label="Risk" param="risk" options={RISK_TIERS} labels={RISK_LABELS} />
      <FilterSelect label="Type" param="type" options={CUSTOMER_TYPES} labels={CUSTOMER_TYPE_LABELS} />
      <div className="ml-auto flex items-center gap-2 text-fg-muted" aria-live="polite">
        {(isPending || refreshing) && <Spinner size="extra-tiny" aria-label="Loading" />}
        <span>
          {resultCount} {resultCount === 1 ? "case" : "cases"}
        </span>
      </div>
    </div>
  );
}
