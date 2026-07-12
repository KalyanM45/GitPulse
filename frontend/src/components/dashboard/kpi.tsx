"use client";

import { type LucideIcon } from "lucide-react";
import { CountUp } from "@/components/motion/primitives";
import { LiftPanel } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { compact, comma } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import { cn } from "@/lib/utils";

export interface Kpi {
  label: string;
  value: number | undefined;
  icon: LucideIcon;
  hint?: string;
  /** Rendered under the value — must be a real, derived figure, never a guess. */
  sub?: string;
  tone?: "brand" | "positive" | "negative";
}

export function KpiCard({ kpi, loading }: { kpi: Kpi; loading?: boolean }) {
  const Icon = kpi.icon;
  const { prefs } = usePrefs();
  const fmt = prefs.exactNumbers ? comma : compact;

  const ring = {
    brand: "text-indigo-lift",
    positive: "text-positive",
    negative: "text-negative",
  }[kpi.tone ?? "brand"];

  return (
    <LiftPanel className="p-5">
      <div className="flex items-start justify-between">
        <span className="text-[12px] font-medium tracking-wide text-ink-3">{kpi.label}</span>
        <span
          className={cn(
            "flex size-8 items-center justify-center rounded-lg border border-hairline bg-white/[0.03]",
            ring,
          )}
        >
          <Icon className="size-3.5" />
        </span>
      </div>

      <div className="mt-4">
        {loading || kpi.value === undefined ? (
          <Skeleton className="h-9 w-24" />
        ) : (
          <Tooltip content={comma(kpi.value)}>
            <span className="inline-block cursor-default text-[32px] leading-none font-semibold tracking-[-0.02em] text-ink">
              <CountUp value={kpi.value} format={(n) => fmt(Math.round(n))} />
            </span>
          </Tooltip>
        )}
      </div>

      {kpi.sub && !loading && (
        <p className="mt-2 text-[12px] text-ink-3">{kpi.sub}</p>
      )}
    </LiftPanel>
  );
}

export function KpiGrid({ kpis, loading }: { kpis: Kpi[]; loading?: boolean }) {
  return (
    // auto-fit rather than a fixed column count: the row stays balanced whether
    // it holds 4 cards or 5, instead of leaving an orphan on its own line.
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-[repeat(auto-fit,minmax(190px,1fr))]">
      {kpis.map((k) => (
        <KpiCard key={k.label} kpi={k} loading={loading} />
      ))}
    </div>
  );
}
