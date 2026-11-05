"use client";

import { SearchBox, Select } from "@fluentui/react-components";
import { useEffect, useId, useRef, useState } from "react";
import { useUrlState } from "@/hooks/useUrlState";

/** Changing a filter returns to the first page (no-op for unpaginated views). */
const RESET_PAGE = { page: null };

export function FilterSelect({
  label,
  param,
  options,
  labels,
  defaultValue,
}: {
  label: string;
  param: string;
  options: readonly string[];
  labels: Record<string, string>;
  /** When set, there is no "All" option and this value is implied by an absent param. */
  defaultValue?: string;
}) {
  const { params, setParams } = useUrlState();
  const id = useId();
  return (
    <div className="flex items-center gap-1.5">
      <label htmlFor={id} className="text-[12px] font-medium text-fg-muted">
        {label}
      </label>
      <Select
        id={id}
        size="small"
        value={params.get(param) ?? defaultValue ?? ""}
        onChange={(_, d) => setParams({ [param]: d.value && d.value !== defaultValue ? d.value : null, ...RESET_PAGE })}
      >
        {defaultValue === undefined && <option value="">All</option>}
        {options.map((o) => (
          <option key={o} value={o}>
            {labels[o]}
          </option>
        ))}
      </Select>
    </div>
  );
}

/** Debounced search bound to the `q` URL param. Remount (change `key`) to reset it. */
export function UrlSearchBox({ placeholder, label, className }: { placeholder: string; label: string; className?: string }) {
  const { params, setParams } = useUrlState();
  const [search, setSearch] = useState(params.get("q") ?? "");
  const lastPushed = useRef(params.get("q") ?? "");

  useEffect(() => {
    if (search === lastPushed.current) return;
    const timer = setTimeout(() => {
      lastPushed.current = search;
      setParams({ q: search.trim() || null, ...RESET_PAGE });
    }, 300);
    return () => clearTimeout(timer);
  }, [search, setParams]);

  return (
    <SearchBox
      size="small"
      placeholder={placeholder}
      aria-label={label}
      value={search}
      onChange={(_, d) => setSearch(d.value)}
      className={className}
    />
  );
}
