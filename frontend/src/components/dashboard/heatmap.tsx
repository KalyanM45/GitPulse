"use client";

import { motion, useReducedMotion } from "framer-motion";
import { useMemo } from "react";
import { Tooltip } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";
import { HEAT as FILL } from "@/lib/chart-palette";
import type { ContributionWeek } from "@/lib/types";
import { cn } from "@/lib/utils";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Five buckets, quantile-ish against the year's own max — matches GitHub's feel. */
function level(count: number, max: number): number {
  if (count === 0) return 0;
  if (max <= 4) return Math.min(4, count);
  const r = count / max;
  if (r <= 0.25) return 1;
  if (r <= 0.5) return 2;
  if (r <= 0.75) return 3;
  return 4;
}

export function ContributionHeatmap({
  weeks,
  loading,
}: {
  weeks: ContributionWeek[] | undefined;
  loading?: boolean;
}) {
  const reduce = useReducedMotion();

  const { max, monthLabels } = useMemo(() => {
    if (!weeks?.length) return { max: 0, monthLabels: [] as { i: number; label: string }[] };

    let m = 0;
    for (const w of weeks) for (const d of w.contributionDays) m = Math.max(m, d.contributionCount);

    // One label per month, placed at the first week that month appears in.
    const labels: { i: number; label: string }[] = [];
    let lastMonth = -1;
    weeks.forEach((w, i) => {
      const first = w.contributionDays[0];
      if (!first) return;
      const month = new Date(first.date).getUTCMonth();
      if (month !== lastMonth) {
        labels.push({ i, label: MONTHS[month] });
        lastMonth = month;
      }
    });

    return { max: m, monthLabels: labels };
  }, [weeks]);

  if (loading) {
    return (
      <div className="px-6 pb-6">
        <Skeleton className="h-[132px] w-full" />
      </div>
    );
  }

  if (!weeks?.length) {
    return (
      <p className="px-6 pb-6 text-[13px] text-ink-3">
        No contribution data for this year — run a sync.
      </p>
    );
  }

  return (
    <div className="px-6 pb-6">
      <div className="overflow-x-auto pb-1">
        <div className="inline-block min-w-full">
          {/* Month ruler */}
          <div
            className="relative mb-1.5 h-4"
            style={{ width: weeks.length * 15 - 3, marginLeft: 0 }}
          >
            {monthLabels.map(({ i, label }) => (
              <span
                key={`${label}-${i}`}
                className="absolute text-[10px] text-ink-3"
                style={{ left: i * 15 }}
              >
                {label}
              </span>
            ))}
          </div>

          <div className="flex gap-[3px]">
            {weeks.map((week, wi) => (
              <div key={wi} className="flex flex-col gap-[3px]">
                {Array.from({ length: 7 }).map((_, di) => {
                  const day = week.contributionDays.find((d) => d.weekday === di);
                  if (!day) return <span key={di} className="size-3" />;

                  const lv = level(day.contributionCount, max);
                  return (
                    <Tooltip
                      key={di}
                      content={
                        <span>
                          <span className="font-medium text-ink">
                            {day.contributionCount}
                          </span>{" "}
                          {day.contributionCount === 1 ? "contribution" : "contributions"} ·{" "}
                          {new Date(day.date).toLocaleDateString("en-US", {
                            month: "short",
                            day: "numeric",
                            year: "numeric",
                            timeZone: "UTC",
                          })}
                        </span>
                      }
                    >
                      <motion.span
                        tabIndex={0}
                        aria-label={`${day.contributionCount} contributions on ${day.date}`}
                        className={cn(
                          "size-3 rounded-[3px] outline-none",
                          "transition-[transform,box-shadow] duration-150",
                          "hover:scale-125 hover:shadow-[0_0_12px_-2px_rgba(129,140,248,0.9)]",
                          "focus-visible:ring-2 focus-visible:ring-indigo-lift",
                        )}
                        style={{ background: FILL[lv] }}
                        initial={reduce ? false : { opacity: 0, scale: 0.5 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{
                          duration: 0.3,
                          delay: Math.min(wi * 0.008, 0.5),
                          ease: [0.16, 1, 0.3, 1],
                        }}
                      />
                    </Tooltip>
                  );
                })}
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Legend */}
      <div className="mt-4 flex items-center justify-end gap-2 text-[11px] text-ink-3">
        <span>Less</span>
        {FILL.map((f, i) => (
          <span key={i} className="size-3 rounded-[3px]" style={{ background: f }} />
        ))}
        <span>More</span>
      </div>
    </div>
  );
}
