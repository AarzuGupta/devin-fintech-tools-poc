"use client";

import { SearchBox, Spinner } from "@fluentui/react-components";
import { useEffect, useRef, useState } from "react";
import { useUrlState } from "@/hooks/useUrlState";

export function AuditSearch({ count }: { count: number }) {
  const { params, setParams, isPending } = useUrlState();
  const [value, setValue] = useState(params.get("q") ?? "");
  const last = useRef(value);

  useEffect(() => {
    if (value === last.current) return;
    const t = setTimeout(() => {
      last.current = value;
      setParams({ q: value.trim() || null });
    }, 300);
    return () => clearTimeout(t);
  }, [value, setParams]);

  return (
    <div className="flex items-center gap-3 border-y border-stroke bg-surface px-4 py-1.5">
      <SearchBox size="small" className="w-72" placeholder="Search record ID, actor, reason" aria-label="Search audit events" value={value} onChange={(_, d) => setValue(d.value)} />
      <div className="ml-auto flex items-center gap-2 text-fg-muted" aria-live="polite">
        {isPending && <Spinner size="extra-tiny" aria-label="Loading" />}
        {count} {count === 1 ? "event" : "events"}
      </div>
    </div>
  );
}
