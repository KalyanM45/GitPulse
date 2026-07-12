"use client";

import { motion } from "framer-motion";
import { forwardRef, type HTMLAttributes, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/**
 * The single surface of the app. Glass fill + hairline + a top-edge sheen —
 * the sheen is doing most of the work; blur alone reads as muddy, not as glass.
 */
export const Panel = forwardRef<HTMLDivElement, HTMLAttributes<HTMLDivElement>>(
  function Panel({ className, children, ...props }, ref) {
    return (
      <div
        ref={ref}
        className={cn(
          // min-w-0: a panel is nearly always a grid/flex child, and those default
          // to min-width:auto — they refuse to shrink below their content's intrinsic
          // width. Recharts' ResponsiveContainer measures wide and feeds that back,
          // which is enough to blow the page out sideways on mobile.
          "relative isolate min-w-0 rounded-panel border border-hairline bg-glass",
          "backdrop-blur-2xl backdrop-saturate-150",
          "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
          "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
          className,
        )}
        {...props}
      >
        {children}
      </div>
    );
  },
);

/** Panel that lifts and glows on hover. Use for anything clickable. */
export function LiftPanel({
  children,
  className,
  onClick,
}: {
  children: ReactNode;
  className?: string;
  onClick?: () => void;
}) {
  return (
    <motion.div
      onClick={onClick}
      whileHover={{ y: -3 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "group relative isolate min-w-0 rounded-card border border-hairline bg-glass",
        "backdrop-blur-2xl backdrop-saturate-150",
        "transition-[border-color,box-shadow] duration-300",
        "hover:border-hairline-strong hover:shadow-[0_24px_60px_-24px_rgba(0,0,0,0.8)]",
        "before:pointer-events-none before:absolute before:inset-x-0 before:top-0 before:h-px",
        "before:bg-gradient-to-r before:from-transparent before:via-white/20 before:to-transparent",
        onClick && "cursor-pointer",
        className,
      )}
    >
      {/* Brand glow, revealed on hover only. */}
      <div
        aria-hidden
        className="pointer-events-none absolute -inset-px -z-10 rounded-[inherit] opacity-0 blur-xl transition-opacity duration-500 group-hover:opacity-100"
        style={{
          background:
            "linear-gradient(135deg, rgba(79,70,229,0.28), rgba(139,92,246,0.16), rgba(56,189,248,0.20))",
        }}
      />
      {children}
    </motion.div>
  );
}

export function PanelHeader({
  title,
  description,
  action,
  className,
}: {
  title: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  className?: string;
}) {
  return (
    <div className={cn("flex items-start justify-between gap-4 px-6 pt-6 pb-4", className)}>
      <div className="min-w-0 space-y-1">
        <h2 className="text-[15px] font-semibold tracking-tight text-ink">{title}</h2>
        {description && (
          <p className="text-[13px] leading-relaxed text-ink-3">{description}</p>
        )}
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}
