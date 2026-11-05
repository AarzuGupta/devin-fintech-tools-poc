"use client";

import { Button } from "@fluentui/react-components";
import { ChevronLeft16Regular, ChevronRight16Regular } from "@fluentui/react-icons";
import { useUrlState } from "@/hooks/useUrlState";

export function Pagination({ page, pageCount, start, shown, total }: { page: number; pageCount: number; start: number; shown: number; total: number }) {
  const { setParams } = useUrlState();
  const go = (p: number) => setParams({ page: p > 1 ? String(p) : null });
  return (
    <nav aria-label="Pagination" className="flex items-center justify-between border-t border-stroke bg-surface px-3 py-1.5 text-[12px] text-fg-muted">
      <span data-testid="pagination-range">{total === 0 ? "0 results" : `${start + 1}–${start + shown} of ${total}`}</span>
      <div className="flex items-center gap-1">
        <Button size="small" appearance="subtle" icon={<ChevronLeft16Regular />} disabled={page <= 1} onClick={() => go(page - 1)} aria-label="Previous page" />
        <span className="tabular-nums">
          Page {page} of {pageCount}
        </span>
        <Button size="small" appearance="subtle" icon={<ChevronRight16Regular />} disabled={page >= pageCount} onClick={() => go(page + 1)} aria-label="Next page" />
      </div>
    </nav>
  );
}
