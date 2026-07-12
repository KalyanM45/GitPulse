"use client";

import { cva, type VariantProps } from "class-variance-authority";
import { Search, X } from "lucide-react";
import {
  forwardRef,
  type HTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
} from "react";
import { cn } from "@/lib/utils";

/* ── Badge ─────────────────────────────────────────────────────────────────── */

const badge = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-medium tracking-wide whitespace-nowrap",
  {
    variants: {
      tone: {
        neutral: "border-hairline bg-glass text-ink-2",
        brand: "border-indigo-2/30 bg-indigo-2/12 text-indigo-lift",
        positive: "border-positive/25 bg-positive/12 text-positive",
        negative: "border-negative/25 bg-negative/12 text-negative",
        warning: "border-warning/25 bg-warning/12 text-warning",
      },
    },
    defaultVariants: { tone: "neutral" },
  },
);

export interface BadgeProps
  extends HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badge> {}

export function Badge({ className, tone, ...props }: BadgeProps) {
  return <span className={cn(badge({ tone }), className)} {...props} />;
}

/** Status pill with a leading dot — for table rows. */
export function StatusPill({
  tone = "neutral",
  children,
}: {
  tone?: "neutral" | "brand" | "positive" | "negative" | "warning";
  children: ReactNode;
}) {
  const dot = {
    neutral: "bg-ink-3",
    brand: "bg-indigo-lift",
    positive: "bg-positive",
    negative: "bg-negative",
    warning: "bg-warning",
  }[tone];

  return (
    <Badge tone={tone}>
      <span className={cn("size-1.5 rounded-full", dot)} aria-hidden />
      {children}
    </Badge>
  );
}

/* ── Input ─────────────────────────────────────────────────────────────────── */

export const Input = forwardRef<HTMLInputElement, InputHTMLAttributes<HTMLInputElement>>(
  function Input({ className, ...props }, ref) {
    return (
      <input
        ref={ref}
        className={cn(
          "h-10 w-full rounded-control border border-hairline bg-black/20 px-3.5 text-sm text-ink",
          "placeholder:text-ink-3",
          "transition-[border-color,box-shadow,background-color] duration-200",
          "hover:border-hairline-strong",
          "focus:border-indigo-2/60 focus:bg-black/30 focus:outline-none",
          "focus:shadow-[0_0_0_3px_rgba(99,102,241,0.15)]",
          className,
        )}
        {...props}
      />
    );
  },
);

/** Search field with an icon, a clear button, and an optional busy spinner. */
export function SearchInput({
  value,
  onChange,
  placeholder = "Search…",
  busy,
  className,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  busy?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("relative", className)}>
      <Search
        className="pointer-events-none absolute top-1/2 left-3.5 size-4 -translate-y-1/2 text-ink-3"
        aria-hidden
      />
      <Input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="pr-10 pl-10 [&::-webkit-search-cancel-button]:hidden"
      />
      {busy ? (
        <span
          className="absolute top-1/2 right-3.5 size-3.5 -translate-y-1/2 animate-spin rounded-full border-2 border-hairline border-t-indigo-lift"
          aria-hidden
        />
      ) : (
        value && (
          <button
            type="button"
            onClick={() => onChange("")}
            aria-label="Clear search"
            className="absolute top-1/2 right-2.5 flex size-6 -translate-y-1/2 items-center justify-center rounded-md text-ink-3 transition hover:bg-glass hover:text-ink"
          >
            <X className="size-3.5" />
          </button>
        )
      )}
    </div>
  );
}

/* ── Skeleton ──────────────────────────────────────────────────────────────── */

export function Skeleton({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("shimmer rounded-lg bg-white/[0.045]", className)}
    />
  );
}

/* ── Empty state ───────────────────────────────────────────────────────────── */

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: ReactNode;
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center px-6 py-20 text-center">
      <div className="relative mb-5">
        <div
          aria-hidden
          className="absolute inset-0 -z-10 rounded-full bg-indigo-2/20 blur-2xl"
        />
        <div className="flex size-14 items-center justify-center rounded-2xl border border-hairline bg-glass text-ink-2 backdrop-blur-xl">
          {icon}
        </div>
      </div>
      <h3 className="text-base font-semibold tracking-tight text-ink">{title}</h3>
      {description && (
        <p className="mt-1.5 max-w-sm text-sm leading-relaxed text-ink-3">{description}</p>
      )}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

/* ── Section heading ───────────────────────────────────────────────────────── */

export function PageHeading({
  title,
  description,
  action,
}: {
  title: string;
  description?: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-6">
      <div className="space-y-2">
        <h1 className="text-3xl font-semibold tracking-[-0.02em] text-ink">{title}</h1>
        {description && (
          <p className="max-w-xl text-[15px] leading-relaxed text-ink-3">{description}</p>
        )}
      </div>
      {action}
    </div>
  );
}
