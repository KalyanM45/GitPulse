"use client";

import { useMemo } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip as RTooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Skeleton } from "@/components/ui/primitives";
import { ACCENT, CHART_INK, RAMP_6, SERIES } from "@/lib/chart-palette";
import { bytes, comma, compact, formatDate, parseApiDate } from "@/lib/format";
import type { ContributionYearSummary, StarPoint } from "@/lib/types";

const SURFACE = "#0B0F14";

/* ── Shared chrome ─────────────────────────────────────────────────────────── */

const axisProps = {
  stroke: CHART_INK.axis,
  tick: { fill: CHART_INK.axis, fontSize: 11 },
  tickLine: false,
  axisLine: false,
} as const;

interface TipRow {
  label: string;
  value: string;
  color?: string;
}

function TipBox({ title, rows }: { title: string; rows: TipRow[] }) {
  return (
    <div className="rounded-xl border border-hairline bg-elevated/95 px-3 py-2.5 shadow-2xl backdrop-blur-xl">
      <p className="mb-1.5 text-[11px] font-medium text-ink">{title}</p>
      <div className="space-y-1">
        {rows.map((r) => (
          <div key={r.label} className="flex items-center gap-3 text-[11px]">
            {r.color && (
              <span
                className="size-2 shrink-0 rounded-[3px]"
                style={{ background: r.color }}
                aria-hidden
              />
            )}
            {/* Text wears text tokens — never the series colour. */}
            <span className="text-ink-3">{r.label}</span>
            <span className="tnum ml-auto font-medium text-ink-2">{r.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

/** Legend — always present for ≥2 series, so identity is never colour-alone. */
function Legend({ items }: { items: { label: string; color: string }[] }) {
  return (
    <ul className="flex flex-wrap items-center gap-x-5 gap-y-2 px-6 pb-5">
      {items.map((i) => (
        <li key={i.label} className="flex items-center gap-2 text-[12px] text-ink-3">
          <span
            className="size-2.5 rounded-[3px]"
            style={{ background: i.color }}
            aria-hidden
          />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/* ── Contributions by year — stacked bar ────────────────────────────────────
   Discrete years × four contribution types. Stacked (not dual-axis, not grouped
   lines): the question is "how much, split how", and the total matters. */

const STACK = [
  { key: "total_commits" as const, label: "Commits", color: SERIES.commits },
  { key: "total_reviews" as const, label: "Reviews", color: SERIES.reviews },
  { key: "total_issues" as const, label: "Issues", color: SERIES.issues },
  { key: "total_prs" as const, label: "Pull requests", color: SERIES.prs },
];

export function ContributionsByYear({
  years,
  loading,
}: {
  years: ContributionYearSummary[] | undefined;
  loading?: boolean;
}) {
  const data = useMemo(() => (years ? [...years].sort((a, b) => a.year - b.year) : []), [years]);

  if (loading) return <Skeleton className="mx-6 mb-6 h-64" />;
  if (!data.length)
    return <p className="px-6 pb-6 text-[13px] text-ink-3">No contribution history yet.</p>;

  return (
    <>
      <div className="h-64 min-w-0 px-3">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={data} margin={{ top: 8, right: 12, left: 0, bottom: 0 }}>
            <CartesianGrid
              stroke={CHART_INK.grid}
              strokeDasharray="0"
              vertical={false}
            />
            <XAxis dataKey="year" {...axisProps} />
            <YAxis {...axisProps} width={44} tickFormatter={(v: number) => compact(v)} />
            <RTooltip
              cursor={{ fill: "rgba(255,255,255,0.035)" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const total = payload.reduce((s, p) => s + (Number(p.value) || 0), 0);
                return (
                  <TipBox
                    title={String(label)}
                    rows={[
                      ...payload.map((p) => ({
                        label: String(p.name),
                        value: comma(Number(p.value)),
                        color: String(p.color),
                      })),
                      { label: "Total", value: comma(total) },
                    ]}
                  />
                );
              }}
            />
            {STACK.map((s, i) => (
              <Bar
                key={s.key}
                dataKey={s.key}
                name={s.label}
                stackId="c"
                fill={s.color}
                /* 2px surface gap between stacked segments — they must not touch. */
                stroke={SURFACE}
                strokeWidth={2}
                /* Round only the top of the stack, anchored to the baseline. */
                radius={i === STACK.length - 1 ? [4, 4, 0, 0] : undefined}
                isAnimationActive
                animationDuration={700}
                animationEasing="ease-out"
              />
            ))}
          </BarChart>
        </ResponsiveContainer>
      </div>
      <Legend items={STACK.map((s) => ({ label: s.label, color: s.color }))} />
    </>
  );
}

/* ── Language distribution — donut ──────────────────────────────────────────
   Slices are ordered by share, so this is a magnitude job: one hue, light→dark.
   Eight competing brand hues would not survive a CVD check; the labels carry
   identity instead. Anything past the top 6 folds into "Other" — never a
   generated 9th hue. */

export function LanguageDonut({
  languages,
  loading,
}: {
  languages: { name: string; bytes: number }[] | undefined;
  loading?: boolean;
}) {
  const { slices, total } = useMemo(() => {
    if (!languages?.length) return { slices: [], total: 0 };
    const sorted = [...languages].sort((a, b) => b.bytes - a.bytes);
    const t = sorted.reduce((s, l) => s + l.bytes, 0);

    const top = sorted.slice(0, 6);
    const rest = sorted.slice(6);
    const out = top.map((l) => ({ name: l.name, bytes: l.bytes }));
    if (rest.length) {
      out.push({ name: "Other", bytes: rest.reduce((s, l) => s + l.bytes, 0) });
    }
    return { slices: out, total: t };
  }, [languages]);

  if (loading) return <Skeleton className="mx-6 mb-6 h-64" />;
  if (!slices.length)
    return <p className="px-6 pb-6 text-[13px] text-ink-3">No language data yet.</p>;

  const pct = (b: number) => (total ? `${((b / total) * 100).toFixed(1)}%` : "—");

  return (
    // The ring and its labels read as one object, so centre the pair as a group.
    // The old fixed 180px column pinned the donut to the far left of a much wider
    // panel, which is what made it look off-centre.
    <div className="flex min-w-0 flex-col items-center justify-center gap-8 px-6 pb-6 sm:flex-row sm:gap-12">
      <div className="relative size-48 shrink-0">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={slices}
              dataKey="bytes"
              nameKey="name"
              cx="50%"
              cy="50%"
              innerRadius="64%"
              outerRadius="96%"
              paddingAngle={2} /* the 2px surface gap, in polar form */
              stroke={SURFACE}
              strokeWidth={2}
              isAnimationActive
              animationDuration={800}
            >
              {slices.map((_, i) => (
                <Cell key={i} fill={RAMP_6[Math.min(i, RAMP_6.length - 1)]} />
              ))}
            </Pie>
            <RTooltip
              content={({ active, payload }) => {
                if (!active || !payload?.length) return null;
                const p = payload[0];
                const b = Number(p.value);
                return (
                  <TipBox
                    title={String(p.name)}
                    rows={[
                      { label: "Share", value: pct(b) },
                      { label: "Size", value: bytes(b) },
                    ]}
                  />
                );
              }}
            />
          </PieChart>
        </ResponsiveContainer>

        {/* Hero number in the hole — the donut's total, so the ring isn't the only readout. */}
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="tnum text-xl font-semibold text-ink">{slices.length}</span>
          <span className="text-[10px] tracking-wide text-ink-3 uppercase">languages</span>
        </div>
      </div>

      {/* Direct labels — identity and value, never colour alone. */}
      <ul className="w-full max-w-xs min-w-0 space-y-1.5">
        {slices.map((s, i) => (
          <li key={s.name} className="flex items-center gap-2.5 text-[12px]">
            <span
              className="size-2.5 shrink-0 rounded-[3px]"
              style={{ background: RAMP_6[Math.min(i, RAMP_6.length - 1)] }}
              aria-hidden
            />
            <span className="truncate text-ink-2">{s.name}</span>
            <span className="tnum ml-auto shrink-0 text-ink-3">{pct(s.bytes)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/* ── Star history — single-series area ──────────────────────────────────────
   One series ⇒ no legend box; the panel title names it. */

export function StarHistory({
  points,
  loading,
}: {
  points: StarPoint[] | undefined;
  loading?: boolean;
}) {
  if (loading) return <Skeleton className="h-48 w-full" />;

  if (!points || points.length < 2) {
    return (
      <div className="flex h-48 items-center justify-center rounded-xl border border-hairline bg-white/[0.02]">
        <p className="max-w-xs text-center text-[13px] leading-relaxed text-ink-3">
          Star history needs at least two syncs. Only one snapshot exists so far.
        </p>
      </div>
    );
  }

  return (
    <div className="h-48">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={points} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id="star-fill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={ACCENT} stopOpacity={0.28} />
              <stop offset="100%" stopColor={ACCENT} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke={CHART_INK.grid} vertical={false} />
          <XAxis
            dataKey="captured_at"
            {...axisProps}
            tickFormatter={(v: string) =>
              // parseApiDate, not new Date — these timestamps carry no timezone.
              parseApiDate(v)?.toLocaleDateString("en-US", {
                month: "short",
                day: "numeric",
              }) ?? ""
            }
            minTickGap={28}
          />
          <YAxis
            {...axisProps}
            width={44}
            domain={["dataMin - 1", "dataMax + 1"]}
            tickFormatter={(v: number) => compact(v)}
          />
          <RTooltip
            cursor={{ stroke: CHART_INK.axis, strokeDasharray: "3 3" }}
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload as StarPoint;
              return (
                <TipBox
                  title={formatDate(p.captured_at)}
                  rows={[{ label: "Stars", value: comma(p.stars) }]}
                />
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="stars"
            stroke={ACCENT}
            strokeWidth={2}
            fill="url(#star-fill)"
            dot={false}
            activeDot={{ r: 4, fill: ACCENT, stroke: SURFACE, strokeWidth: 2 }}
            isAnimationActive
            animationDuration={900}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
