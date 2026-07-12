"use client";

import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Fine film grain. Rendered as an inline SVG data URI so it ships in the CSS —
 * no network request, no CSP exception. This is what stops the big indigo
 * gradients from banding into visible steps on OLED panels.
 */
const NOISE =
  "data:image/svg+xml;utf8," +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="140" height="140">
      <filter id="n">
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="3" stitchTiles="stitch"/>
        <feColorMatrix type="saturate" values="0"/>
      </filter>
      <rect width="100%" height="100%" filter="url(#n)" opacity="0.42"/>
    </svg>`,
  );

export function Grain({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn("pointer-events-none absolute inset-0 opacity-[0.035] mix-blend-overlay", className)}
      style={{ backgroundImage: `url("${NOISE}")`, backgroundRepeat: "repeat" }}
    />
  );
}

/** Perspective grid that fades out toward the horizon. */
export function GridOverlay() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute inset-0"
      style={{
        backgroundImage: `linear-gradient(to right, rgba(255,255,255,0.045) 1px, transparent 1px),
                          linear-gradient(to bottom, rgba(255,255,255,0.045) 1px, transparent 1px)`,
        backgroundSize: "64px 64px",
        maskImage:
          "radial-gradient(ellipse 100% 60% at 50% 0%, #000 20%, transparent 75%)",
        WebkitMaskImage:
          "radial-gradient(ellipse 100% 60% at 50% 0%, #000 20%, transparent 75%)",
      }}
    />
  );
}

/**
 * Slow-drifting colour blobs. Each is a blurred radial gradient on its own
 * compositor layer — animating only `transform`, never filter or background,
 * so this stays on the GPU and off the main thread.
 */
export function MeshBlobs() {
  const reduce = useReducedMotion();

  const blobs = [
    { c: "rgba(79,70,229,0.42)", size: 620, x: "8%", y: "-12%", dur: 24 },
    { c: "rgba(139,92,246,0.30)", size: 540, x: "62%", y: "-4%", dur: 30 },
    { c: "rgba(56,189,248,0.20)", size: 480, x: "38%", y: "36%", dur: 27 },
  ];

  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {blobs.map((b, i) => (
        <motion.div
          key={i}
          className="absolute rounded-full blur-[110px]"
          style={{
            width: b.size,
            height: b.size,
            left: b.x,
            top: b.y,
            background: `radial-gradient(circle, ${b.c}, transparent 68%)`,
            willChange: "transform",
          }}
          animate={
            reduce
              ? undefined
              : {
                  x: [0, 40, -30, 0],
                  y: [0, -30, 25, 0],
                  scale: [1, 1.09, 0.95, 1],
                }
          }
          transition={{
            duration: b.dur,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 2,
          }}
        />
      ))}
    </div>
  );
}

/** The full ambient stack, composited in the right order. */
export function Ambient({ grid = true }: { grid?: boolean }) {
  return (
    <div aria-hidden className="absolute inset-0 -z-10 overflow-hidden">
      <div className="absolute inset-0 bg-base" />
      <MeshBlobs />
      {grid && <GridOverlay />}
      <Grain />
      {/* Vignette — pulls focus to the centre and hides the blob edges. */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_80%_at_50%_-10%,transparent,rgba(5,7,10,0.85))]" />
    </div>
  );
}
