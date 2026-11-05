"use client";

import { ArrowSortDown16Regular, ArrowSortUp16Regular, ArrowSort16Regular } from "@fluentui/react-icons";
import type { KeyboardEvent, ReactNode } from "react";

export interface Column<T> {
  key: string;
  header: string;
  render: (row: T) => ReactNode;
  /** When set, the column header becomes a sort button for this field. */
  sortKey?: string;
  className?: string;
}

interface DataTableProps<T> {
  label: string;
  rows: T[];
  columns: Column<T>[];
  getRowId: (row: T) => string;
  selectedId?: string | null;
  onRowClick?: (row: T) => void;
  sort?: { field: string; dir: "asc" | "desc" };
  onSort?: (field: string) => void;
  empty?: ReactNode;
}

/** Compact, accessible data grid in the style of model-driven app views. */
export function DataTable<T>({
  label,
  rows,
  columns,
  getRowId,
  selectedId,
  onRowClick,
  sort,
  onSort,
  empty,
}: DataTableProps<T>) {
  const handleKey = (event: KeyboardEvent, row: T) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      onRowClick?.(row);
    }
  };

  return (
    <table className="w-full border-collapse text-left text-[13px]" aria-label={label}>
      <thead className="sticky top-0 z-10 bg-surface">
        <tr className="border-b border-stroke">
          {columns.map((col) => {
            const active = sort && col.sortKey === sort.field;
            const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : col.sortKey ? "none" : undefined;
            return (
              <th key={col.key} scope="col" aria-sort={ariaSort} className={`h-9 px-3 font-semibold text-fg ${col.className ?? ""}`}>
                {col.sortKey && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sortKey!)}
                    className="-mx-1 inline-flex items-center gap-1 rounded px-1 py-0.5 whitespace-nowrap hover:bg-stroke-subtle focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {col.header}
                    {active ? (
                      sort.dir === "asc" ? <ArrowSortUp16Regular /> : <ArrowSortDown16Regular />
                    ) : (
                      <ArrowSort16Regular className="text-fg-subtle" />
                    )}
                  </button>
                ) : (
                  <span className="whitespace-nowrap">{col.header}</span>
                )}
              </th>
            );
          })}
        </tr>
      </thead>
      <tbody>
        {rows.length === 0 ? (
          <tr>
            <td colSpan={columns.length} className="px-3 py-12 text-center text-fg-muted">
              {empty ?? "No records found."}
            </td>
          </tr>
        ) : (
          rows.map((row) => {
            const id = getRowId(row);
            const selected = id === selectedId;
            return (
              <tr
                key={id}
                data-row-id={id}
                aria-selected={onRowClick ? selected : undefined}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={onRowClick ? () => onRowClick(row) : undefined}
                onKeyDown={onRowClick ? (e) => handleKey(e, row) : undefined}
                className={`border-b border-stroke-subtle ${onRowClick ? "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" : ""} ${
                  selected ? "bg-brand-subtle" : onRowClick ? "hover:bg-[#f5f5f5]" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`h-10 px-3 align-middle ${col.className ?? ""}`}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            );
          })
        )}
      </tbody>
    </table>
  );
}
