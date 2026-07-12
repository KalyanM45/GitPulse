"use client";

import { Slot } from "@radix-ui/react-slot";
import { cva, type VariantProps } from "class-variance-authority";
import { Loader2 } from "lucide-react";
import { forwardRef, useCallback, useState, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

const button = cva(
  [
    "relative inline-flex select-none items-center justify-center gap-2 overflow-hidden",
    "whitespace-nowrap rounded-control font-medium",
    "transition-[transform,background-color,border-color,box-shadow,color] duration-200 ease-[cubic-bezier(0.16,1,0.3,1)]",
    "active:scale-[0.97]",
    "disabled:pointer-events-none disabled:opacity-45",
    "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
    "motion-reduce:active:scale-100 motion-reduce:transition-none",
  ],
  {
    variants: {
      variant: {
        // The one loud element on any given screen.
        primary: [
          "text-white",
          "bg-[linear-gradient(180deg,#6366f1,#4f46e5)]",
          "shadow-[0_1px_0_0_rgba(255,255,255,0.16)_inset,0_8px_24px_-8px_rgba(79,70,229,0.7)]",
          "hover:shadow-[0_1px_0_0_rgba(255,255,255,0.22)_inset,0_12px_34px_-8px_rgba(79,70,229,0.9)]",
          "hover:brightness-110",
        ],
        secondary: [
          "text-ink border border-hairline bg-glass backdrop-blur-xl",
          "hover:border-hairline-strong hover:bg-glass-hover",
        ],
        ghost: "text-ink-2 hover:bg-glass hover:text-ink",
        danger: [
          "text-negative border border-negative/25 bg-negative/10",
          "hover:border-negative/40 hover:bg-negative/15",
        ],
      },
      size: {
        sm: "h-8 px-3 text-[13px]",
        md: "h-10 px-4 text-sm",
        lg: "h-12 px-6 text-[15px]",
        icon: "size-10 p-0",
      },
    },
    defaultVariants: { variant: "secondary", size: "md" },
  },
);

interface Ripple {
  id: number;
  x: number;
  y: number;
}

export interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof button> {
  asChild?: boolean;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { className, variant, size, asChild, loading, children, onClick, disabled, ...props },
  ref,
) {
  const [ripples, setRipples] = useState<Ripple[]>([]);

  const handleClick = useCallback(
    (e: React.MouseEvent<HTMLButtonElement>) => {
      const r = e.currentTarget.getBoundingClientRect();
      const id = Date.now();
      setRipples((rs) => [...rs, { id, x: e.clientX - r.left, y: e.clientY - r.top }]);
      // Match the CSS animation duration; cheaper than an onAnimationEnd listener.
      window.setTimeout(() => setRipples((rs) => rs.filter((x) => x.id !== id)), 620);
      onClick?.(e);
    },
    [onClick],
  );

  if (asChild) {
    return (
      <Slot ref={ref} className={cn(button({ variant, size }), className)} {...props}>
        {children}
      </Slot>
    );
  }

  return (
    <button
      ref={ref}
      className={cn(button({ variant, size }), className)}
      onClick={handleClick}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...props}
    >
      {ripples.map((r) => (
        <span
          key={r.id}
          aria-hidden
          className="pointer-events-none absolute size-0 animate-[ripple_620ms_ease-out] rounded-full bg-white/25 motion-reduce:hidden"
          style={{ left: r.x, top: r.y }}
        />
      ))}
      {loading && <Loader2 className="size-4 animate-spin" aria-hidden />}
      {children}
    </button>
  );
});
