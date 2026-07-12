"use client";

import {
  animate,
  motion,
  useInView,
  useMotionValue,
  useReducedMotion,
  useScroll,
  useSpring,
  useTransform,
  type MotionValue,
} from "framer-motion";
import { useEffect, useRef, useState, type ReactNode } from "react";
import { cn } from "@/lib/utils";

/* One spring vocabulary for the whole app. Everything that moves uses one of these. */
export const spring = {
  /** UI response to a direct input — must feel instant. */
  snappy: { type: "spring", stiffness: 420, damping: 32, mass: 0.6 },
  /** Content settling into place. */
  soft: { type: "spring", stiffness: 180, damping: 26 },
  /** Big surfaces (drawers, dialogs). */
  heavy: { type: "spring", stiffness: 260, damping: 34, mass: 0.9 },
} as const;

/* ── Reveal ─────────────────────────────────────────────────────────────────
   Fade + slide as an element scrolls in. Fires once. `once` + a rootMargin
   that triggers slightly early keeps it from feeling laggy. */

export function Reveal({
  children,
  delay = 0,
  y = 18,
  className,
}: {
  children: ReactNode;
  delay?: number;
  y?: number;
  className?: string;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? false : { opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: "-64px" }}
      transition={{ duration: 0.7, delay, ease: [0.16, 1, 0.3, 1] }}
    >
      {children}
    </motion.div>
  );
}

/** Staggers direct children of a Reveal-like container. */
export function Stagger({
  children,
  className,
  gap = 0.06,
}: {
  children: ReactNode;
  className?: string;
  gap?: number;
}) {
  const reduce = useReducedMotion();
  return (
    <motion.div
      className={className}
      initial={reduce ? undefined : "hidden"}
      whileInView="show"
      viewport={{ once: true, margin: "-48px" }}
      variants={{ show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  );
}

export const staggerItem = {
  hidden: { opacity: 0, y: 16 },
  show: { opacity: 1, y: 0, transition: { duration: 0.6, ease: [0.16, 1, 0.3, 1] } },
} as const;

/* ── CountUp ────────────────────────────────────────────────────────────────
   Animates only when the value is first seen, and only when on-screen.
   Formats through the caller's formatter so "1.2k" counts up correctly. */

export function CountUp({
  value,
  format = (n) => Math.round(n).toLocaleString("en-US"),
  duration = 1.1,
  className,
}: {
  value: number;
  format?: (n: number) => string;
  duration?: number;
  className?: string;
}) {
  const ref = useRef<HTMLSpanElement>(null);
  const inView = useInView(ref, { once: true, margin: "-40px" });
  const reduce = useReducedMotion();
  const [display, setDisplay] = useState(() => format(reduce ? value : 0));

  useEffect(() => {
    if (!inView) return;
    if (reduce) {
      setDisplay(format(value));
      return;
    }
    const mv = { n: 0 };
    const controls = animate(mv.n, value, {
      duration,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (n) => setDisplay(format(n)),
    });
    return () => controls.stop();
    // `format` is intentionally not a dep — callers pass inline lambdas.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [inView, value, reduce, duration]);

  return (
    <span ref={ref} className={cn("tnum", className)}>
      {display}
    </span>
  );
}

/* ── Magnetic ───────────────────────────────────────────────────────────────
   The button leans toward the cursor. Subtle — 0.35 of the offset, capped by
   the element's own bounds, so it never detaches from its hit area. */

export function Magnetic({
  children,
  strength = 0.35,
  className,
}: {
  children: ReactNode;
  strength?: number;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const sx = useSpring(x, spring.snappy);
  const sy = useSpring(y, spring.snappy);

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={cn("inline-flex", className)}
      style={{ x: sx, y: sy }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        x.set((e.clientX - (r.left + r.width / 2)) * strength);
        y.set((e.clientY - (r.top + r.height / 2)) * strength);
      }}
      onPointerLeave={() => {
        x.set(0);
        y.set(0);
      }}
    >
      {children}
    </motion.div>
  );
}

/* ── Tilt ───────────────────────────────────────────────────────────────────
   3D card tilt + a specular highlight that tracks the cursor. The highlight is
   what makes it read as glass rather than as a rotating rectangle. */

export function Tilt({
  children,
  className,
  max = 6,
  glow = true,
}: {
  children: ReactNode;
  className?: string;
  max?: number;
  glow?: boolean;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const reduce = useReducedMotion();

  const px = useMotionValue(0.5);
  const py = useMotionValue(0.5);
  const rx = useSpring(useTransform(py, [0, 1], [max, -max]), spring.soft);
  const ry = useSpring(useTransform(px, [0, 1], [-max, max]), spring.soft);

  // Must be computed before the early return below — hooks cannot be conditional.
  const sheen = useTransform(
    [px, py],
    ([gx, gy]: number[]) =>
      `radial-gradient(400px circle at ${gx * 100}% ${gy * 100}%, rgba(129,140,248,0.10), transparent 65%)`,
  );

  if (reduce) return <div className={className}>{children}</div>;

  return (
    <motion.div
      ref={ref}
      className={cn("relative [transform-style:preserve-3d]", className)}
      style={{ rotateX: rx, rotateY: ry, perspective: 1000 }}
      onPointerMove={(e) => {
        const el = ref.current;
        if (!el) return;
        const r = el.getBoundingClientRect();
        px.set((e.clientX - r.left) / r.width);
        py.set((e.clientY - r.top) / r.height);
      }}
      onPointerLeave={() => {
        px.set(0.5);
        py.set(0.5);
      }}
    >
      {children}
      {glow && (
        <motion.div
          aria-hidden
          className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover:opacity-100"
          style={{ background: sheen }}
        />
      )}
    </motion.div>
  );
}

/* ── Scroll progress ────────────────────────────────────────────────────────
   Hairline at the top of the viewport. transform-only, so it never triggers layout. */

export function ScrollProgress() {
  const { scrollYProgress } = useScroll();
  const scaleX: MotionValue<number> = useSpring(scrollYProgress, {
    stiffness: 260,
    damping: 40,
    restDelta: 0.001,
  });

  return (
    <motion.div
      aria-hidden
      style={{ scaleX }}
      className="fixed inset-x-0 top-0 z-[100] h-px origin-left bg-gradient-to-r from-indigo via-violet to-sky"
    />
  );
}
