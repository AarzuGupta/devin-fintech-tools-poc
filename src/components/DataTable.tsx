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
    <table className="w-full border-collapse text-left text-[13px] tabular-nums" aria-label={label}>
      <thead className="sticky top-0 z-10 bg-[#fafafb]">
        <tr className="border-b border-stroke">
          {columns.map((col) => {
            const active = sort && col.sortKey === sort.field;
            const ariaSort = active ? (sort.dir === "asc" ? "ascending" : "descending") : col.sortKey ? "none" : undefined;
            return (
              <th key={col.key} scope="col" aria-sort={ariaSort} className={`h-9 px-3 text-[12px] font-medium ${active ? "text-fg" : "text-fg-muted"} ${col.className ?? ""}`}>
                {col.sortKey && onSort ? (
                  <button
                    type="button"
                    onClick={() => onSort(col.sortKey!)}
                    className="group -mx-1.5 inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 whitespace-nowrap hover:bg-black/[0.04] hover:text-fg focus-visible:outline-2 focus-visible:outline-brand"
                  >
                    {col.header}
                    {active ? (
                      sort.dir === "asc" ? <ArrowSortUp16Regular /> : <ArrowSortDown16Regular />
                    ) : (
                      <ArrowSort16Regular className="text-fg-subtle opacity-50 group-hover:opacity-100 group-focus-visible:opacity-100" />
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
                className={`border-b border-stroke-subtle last:border-b-0 ${onRowClick ? "cursor-pointer focus-visible:outline-2 focus-visible:-outline-offset-2 focus-visible:outline-brand" : ""} ${
                  selected ? "bg-brand-subtle shadow-[inset_3px_0_0_var(--color-brand)]" : onRowClick ? "hover:bg-[#f7f7f9]" : ""
                }`}
              >
                {columns.map((col) => (
                  <td key={col.key} className={`h-11 px-3 align-middle ${col.className ?? ""}`}>
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
