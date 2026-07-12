"use client";

import { AnimatePresence, motion } from "framer-motion";
import { ChevronLeft, ChevronRight, ChevronsUpDown, ChevronDown, ChevronUp } from "lucide-react";
import { useCallback, useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";
import { Button } from "./button";
import { Skeleton } from "./primitives";

export interface Column<T> {
  id: string;
  header: ReactNode;
  /** Initial width in px. Omit for the flexible column (there should be exactly one). */
  width?: number;
  minWidth?: number;
  align?: "left" | "right";
  cell: (row: T, index: number) => ReactNode;
}

/**
 * Enterprise table: sticky header, drag-to-resize columns, rounded row hover.
 *
 * Rows are <div role="row"> rather than <tr> — a real <table> can't do rounded,
 * independently-transformed rows without fighting border-collapse. Roles keep it
 * announced correctly to screen readers.
 */
export function DataTable<T>({
  columns,
  rows,
  loading,
  skeletonRows = 8,
  empty,
  onRowClick,
  rowKey,
}: {
  columns: Column<T>[];
  rows: T[];
  loading?: boolean;
  skeletonRows?: number;
  empty?: ReactNode;
  onRowClick?: (row: T) => void;
  rowKey: (row: T, index: number) => string;
}) {
  const [widths, setWidths] = useState<Record<string, number>>(() =>
    Object.fromEntries(columns.filter((c) => c.width).map((c) => [c.id, c.width!])),
  );
  const drag = useRef<{ id: string; startX: number; startW: number } | null>(null);

  const onPointerDown = useCallback(
    (e: React.PointerEvent, col: Column<T>) => {
      e.preventDefault();
      e.stopPropagation();
      drag.current = {
        id: col.id,
        startX: e.clientX,
        startW: widths[col.id] ?? col.width ?? 160,
      };
    },
    [widths],
  );

  useEffect(() => {
    const move = (e: PointerEvent) => {
      const d = drag.current;
      if (!d) return;
      const col = columns.find((c) => c.id === d.id);
      const min = col?.minWidth ?? 80;
      setWidths((w) => ({ ...w, [d.id]: Math.max(min, d.startW + (e.clientX - d.startX)) }));
    };
    const up = () => {
      drag.current = null;
    };
    window.addEventListener("pointermove", move);
    window.addEventListener("pointerup", up);
    return () => {
      window.removeEventListener("pointermove", move);
      window.removeEventListener("pointerup", up);
    };
  }, [columns]);

  const template = columns
    .map((c) => {
      const w = widths[c.id] ?? c.width;
      return w ? `${w}px` : "minmax(0,1fr)";
    })
    .join(" ");

  return (
    <div className="overflow-x-auto">
      <div role="table" className="min-w-[720px]">
        {/* Header */}
        <div
          role="row"
          className={cn(
            "sticky top-0 z-10 grid items-center gap-4 px-5 py-3",
            "border-b border-hairline bg-surface/80 backdrop-blur-xl",
            "text-[11px] font-medium tracking-wider text-ink-3 uppercase",
          )}
          style={{ gridTemplateColumns: template }}
        >
          {columns.map((col, i) => (
            <div
              key={col.id}
              role="columnheader"
              className={cn(
                "relative flex items-center",
                col.align === "right" && "justify-end",
              )}
            >
              <span className="truncate">{col.header}</span>
              {i < columns.length - 1 && (
                <span
                  onPointerDown={(e) => onPointerDown(e, col)}
                  role="separator"
                  aria-orientation="vertical"
                  aria-label={`Resize column`}
                  className={cn(
                    "absolute -right-2 z-20 h-5 w-4 cursor-col-resize",
                    "after:absolute after:top-0 after:left-1/2 after:h-full after:w-px",
                    "after:bg-hairline after:transition-colors hover:after:bg-indigo-lift",
                  )}
                />
              )}
            </div>
          ))}
        </div>

        {/* Body */}
        <div role="rowgroup" className="p-2">
          {loading ? (
            Array.from({ length: skeletonRows }).map((_, i) => (
              <div
                key={i}
                className="grid items-center gap-4 px-3 py-3"
                style={{ gridTemplateColumns: template }}
              >
                {columns.map((c) => (
                  <Skeleton key={c.id} className="h-5" />
                ))}
              </div>
            ))
          ) : rows.length === 0 ? (
            empty
          ) : (
            <AnimatePresence initial={false} mode="popLayout">
              {rows.map((row, i) => (
                <motion.div
                  key={rowKey(row, i)}
                  role="row"
                  layout
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.28, delay: Math.min(i * 0.018, 0.2), ease: [0.16, 1, 0.3, 1] }}
                  onClick={onRowClick ? () => onRowClick(row) : undefined}
                  tabIndex={onRowClick ? 0 : undefined}
                  onKeyDown={
                    onRowClick
                      ? (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            onRowClick(row);
                          }
                        }
                      : undefined
                  }
                  className={cn(
                    "grid items-center gap-4 rounded-xl px-3 py-2.5",
                    "transition-colors duration-200",
                    "hover:bg-white/[0.035]",
                    onRowClick &&
                      "cursor-pointer focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-lift",
                  )}
                  style={{ gridTemplateColumns: template }}
                >
                  {columns.map((col) => (
                    <div
                      key={col.id}
                      role="cell"
                      className={cn("min-w-0", col.align === "right" && "text-right")}
                    >
                      {col.cell(row, i)}
                    </div>
                  ))}
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>
      </div>
    </div>
  );
}

/* ── Sortable header ───────────────────────────────────────────────────────── */

/**
 * A clickable column header. Cycles asc → desc on repeat clicks.
 *
 * Sorting is applied by the API, not to the rows already on screen — sorting a
 * single page client-side would reorder 20 of 79 repositories and quietly lie
 * about which is really the most-starred.
 */
export function SortHeader<S extends string>({
  label,
  field,
  active,
  order,
  onSort,
  align = "left",
}: {
  label: string;
  field: S;
  active: S;
  order: "asc" | "desc";
  onSort: (field: S, order: "asc" | "desc") => void;
  align?: "left" | "right";
}) {
  const isActive = active === field;
  const next: "asc" | "desc" = isActive && order === "asc" ? "desc" : "asc";

  const Icon = !isActive ? ChevronsUpDown : order === "asc" ? ChevronUp : ChevronDown;

  return (
    <button
      type="button"
      onClick={() => onSort(field, next)}
      aria-label={`Sort by ${label}, ${next}ending`}
      aria-sort={isActive ? (order === "asc" ? "ascending" : "descending") : "none"}
      className={cn(
        "group/sort -mx-1.5 flex items-center gap-1 rounded-md px-1.5 py-0.5",
        "text-[11px] font-medium tracking-wider uppercase",
        "transition-colors duration-150",
        "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
        align === "right" && "ml-auto flex-row-reverse",
        isActive ? "text-ink" : "text-ink-3 hover:text-ink-2",
      )}
    >
      <span className="truncate">{label}</span>
      <Icon
        className={cn(
          "size-3 shrink-0 transition-opacity",
          isActive ? "text-indigo-lift opacity-100" : "opacity-40 group-hover/sort:opacity-70",
        )}
      />
    </button>
  );
}

/* ── Pagination ────────────────────────────────────────────────────────────── */

export function Pagination({
  page,
  perPage,
  total,
  onPage,
}: {
  page: number;
  perPage: number;
  total: number;
  onPage: (p: number) => void;
}) {
  const pages = Math.max(1, Math.ceil(total / perPage));
  if (total === 0) return null;

  const from = (page - 1) * perPage + 1;
  const to = Math.min(page * perPage, total);

  // Windowed page numbers: always show first/last, and a 3-wide window around current.
  const window_ = new Set<number>([1, pages, page - 1, page, page + 1]);
  const visible = [...window_].filter((p) => p >= 1 && p <= pages).sort((a, b) => a - b);

  return (
    <nav
      aria-label="Pagination"
      className="flex flex-wrap items-center justify-between gap-4 border-t border-hairline px-5 py-4"
    >
      <p className="tnum text-[13px] text-ink-3">
        <span className="text-ink-2">{from.toLocaleString()}</span>–
        <span className="text-ink-2">{to.toLocaleString()}</span> of{" "}
        <span className="text-ink-2">{total.toLocaleString()}</span>
      </p>

      <div className="flex items-center gap-1">
        <Button
          size="icon"
          variant="ghost"
          onClick={() => onPage(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
          className="size-9"
        >
          <ChevronLeft className="size-4" />
        </Button>

        {visible.map((p, i) => {
          const gap = i > 0 && p - visible[i - 1] > 1;
          return (
            <div key={p} className="flex items-center">
              {gap && <span className="px-1.5 text-ink-3">…</span>}
              <button
                onClick={() => onPage(p)}
                aria-current={p === page ? "page" : undefined}
                aria-label={`Page ${p}`}
                className={cn(
                  "tnum size-9 rounded-lg text-[13px] font-medium transition-all duration-200",
                  "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
                  p === page
                    ? "border border-indigo-2/40 bg-indigo-2/15 text-ink shadow-[0_0_20px_-6px_rgba(99,102,241,0.8)]"
                    : "text-ink-3 hover:bg-glass hover:text-ink",
                )}
              >
                {p}
              </button>
            </div>
          );
        })}

        <Button
          size="icon"
          variant="ghost"
          onClick={() => onPage(page + 1)}
          disabled={page >= pages}
          aria-label="Next page"
          className="size-9"
        >
          <ChevronRight className="size-4" />
        </Button>
      </div>
    </nav>
  );
}
