"use client";

import { motion, useReducedMotion } from "framer-motion";
import { ArrowUpRight, Users, Star, GitFork } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * The hero's product preview. This is an illustration of the interface, not a
 * live view — the figures are representative. Everything animates on a loop so
 * the panel reads as alive rather than as a screenshot.
 */

const BARS = [38, 52, 46, 68, 58, 82, 74, 95, 88, 72, 91, 100];
const HEAT = Array.from({ length: 7 * 18 }, (_, i) => (Math.sin(i * 1.7) * 0.5 + 0.5) * (i % 5 === 0 ? 0.3 : 1));

function Sparkline() {
  const pts = BARS.map((v, i) => `${(i / (BARS.length - 1)) * 100},${100 - v}`).join(" ");
  return (
    <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="h-full w-full">
      <defs>
        <linearGradient id="spark-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#818cf8" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#818cf8" stopOpacity="0" />
        </linearGradient>
      </defs>
      <motion.polyline
        points={pts}
        fill="none"
        stroke="#818cf8"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
        vectorEffect="non-scaling-stroke"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 2, ease: [0.16, 1, 0.3, 1], delay: 0.6 }}
      />
      <motion.polygon
        points={`0,100 ${pts} 100,100`}
        fill="url(#spark-fill)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1.2, delay: 1.6 }}
      />
    </svg>
  );
}

function Stat({
  icon: Icon,
  label,
  value,
  delta,
  delay,
}: {
  icon: typeof Users;
  label: string;
  value: string;
  delta: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, delay, ease: [0.16, 1, 0.3, 1] }}
      className="rounded-xl border border-hairline bg-white/[0.03] p-3"
    >
      <div className="flex items-center gap-1.5 text-ink-3">
        <Icon className="size-3" />
        <span className="text-[10px] font-medium tracking-wide uppercase">{label}</span>
      </div>
      <div className="mt-1.5 flex items-baseline gap-1.5">
        <span className="tnum text-lg font-semibold text-ink">{value}</span>
        <span className="tnum flex items-center text-[10px] font-medium text-positive">
          <ArrowUpRight className="size-2.5" />
          {delta}
        </span>
      </div>
    </motion.div>
  );
}

export function DashboardMockup({ className }: { className?: string }) {
  const reduce = useReducedMotion();

  return (
    <div className={cn("relative", className)}>
      {/* Glow bed behind the panel */}
      <div
        aria-hidden
        className="absolute -inset-8 -z-10 rounded-[40px] opacity-60 blur-3xl"
        style={{
          background:
            "linear-gradient(135deg, rgba(79,70,229,0.5), rgba(139,92,246,0.28), rgba(56,189,248,0.35))",
        }}
      />

      <motion.div
        initial={reduce ? false : { opacity: 0, y: 28, rotateX: 8 }}
        animate={{ opacity: 1, y: 0, rotateX: 0 }}
        transition={{ duration: 1.1, ease: [0.16, 1, 0.3, 1], delay: 0.15 }}
        style={{ perspective: 1200 }}
        className={cn(
          "relative overflow-hidden rounded-panel border border-hairline",
          "bg-surface/80 shadow-[0_50px_140px_-30px_rgba(0,0,0,0.95)] backdrop-blur-2xl",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
          "before:bg-gradient-to-r before:from-transparent before:via-white/25 before:to-transparent",
        )}
      >
        {/* Window chrome */}
        <div className="flex items-center gap-2 border-b border-hairline px-4 py-3">
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
          <span className="size-2.5 rounded-full bg-white/12" />
          <div className="mx-auto flex items-center gap-1.5 rounded-md border border-hairline bg-black/30 px-2.5 py-1">
            <span className="size-1.5 rounded-full bg-positive" />
            <span className="text-[10px] text-ink-3">gitpulse — synced</span>
          </div>
        </div>

        <div className="space-y-4 p-4">
          <div className="grid grid-cols-3 gap-3">
            <Stat icon={Users} label="Followers" value="1,217" delta="24" delay={0.35} />
            <Stat icon={Star} label="Stars" value="3,482" delta="112" delay={0.45} />
            <Stat icon={GitFork} label="Forks" value="641" delta="18" delay={0.55} />
          </div>

          {/* Growth panel */}
          <div className="rounded-xl border border-hairline bg-white/[0.03] p-4">
            <div className="mb-3 flex items-center justify-between">
              <span className="text-[11px] font-medium text-ink-2">Audience growth</span>
              <span className="rounded-full border border-positive/25 bg-positive/12 px-2 py-0.5 text-[10px] text-positive">
                +18.4%
              </span>
            </div>
            <div className="h-24">
              <Sparkline />
            </div>
          </div>

          {/* Contribution heatmap */}
          <div className="rounded-xl border border-hairline bg-white/[0.03] p-4">
            <span className="mb-3 block text-[11px] font-medium text-ink-2">
              Contributions
            </span>
            <div className="grid grid-flow-col grid-rows-7 gap-[3px]">
              {HEAT.map((v, i) => (
                <motion.span
                  key={i}
                  className="size-[7px] rounded-[2px]"
                  style={{
                    background:
                      v < 0.2
                        ? "rgba(255,255,255,0.05)"
                        : `rgba(99,102,241,${0.22 + v * 0.78})`,
                  }}
                  initial={reduce ? false : { opacity: 0, scale: 0.4 }}
                  animate={{ opacity: 1, scale: 1 }}
                  transition={{
                    duration: 0.4,
                    delay: 0.7 + (i % 18) * 0.012 + Math.floor(i / 18) * 0.01,
                    ease: [0.16, 1, 0.3, 1],
                  }}
                />
              ))}
            </div>
          </div>
        </div>

        {/* Reflection sweep — a single pass of light across the glass */}
        {!reduce && (
          <motion.div
            aria-hidden
            className="pointer-events-none absolute inset-0 -skew-x-12"
            style={{
              background:
                "linear-gradient(90deg, transparent, rgba(255,255,255,0.05), transparent)",
              width: "40%",
            }}
            animate={{ x: ["-60%", "360%"] }}
            transition={{ duration: 5, repeat: Infinity, repeatDelay: 4, ease: "easeInOut" }}
          />
        )}
      </motion.div>
    </div>
  );
}
