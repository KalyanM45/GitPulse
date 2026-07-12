"use client";

import { motion } from "framer-motion";
import {
  ArrowRight,
  Github,
  LineChart,
  ShieldCheck,
  Sparkles,
  Users,
} from "lucide-react";
import Link from "next/link";
import { Magnetic } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";
import { DashboardMockup } from "./mockup";

const ease = [0.16, 1, 0.3, 1] as const;

/**
 * Word-by-word rise. Cheap (transform + opacity only) and it sets the tone.
 *
 * The claim lands on the second line, so that's the one wearing the brand
 * gradient — the eye finishes on "GitPulse doesn't."
 */
function Headline() {
  const lines: { words: string[]; className: string }[] = [
    { words: ["GitHub", "forgets."], className: "text-gradient" },
    { words: ["GitPulse", "doesn't."], className: "text-gradient-brand" },
  ];

  let i = 0;
  return (
    // Scales with viewport HEIGHT as well as width — on a 720px-tall laptop the
    // width-only clamp was still rendering at full size and pushing the page
    // into a scroll.
    <h1 className="text-[clamp(2.5rem,min(5.2vw,7.4vh),4.5rem)] leading-[1.02] font-semibold tracking-[-0.035em] text-balance">
      {lines.map((line, li) => (
        <span key={li} className="block overflow-hidden pb-1">
          {line.words.map((word) => {
            const delay = 0.08 + i++ * 0.055;
            return (
              <motion.span
                key={word + delay}
                initial={{ y: "100%", opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                transition={{ duration: 0.9, delay, ease }}
                className="mr-[0.22em] inline-block"
              >
                <span className={line.className}>{word}</span>
              </motion.span>
            );
          })}
        </span>
      ))}
    </h1>
  );
}

/**
 * The three pillars. AI analysis is not shipped yet, so it carries a "Soon" tag
 * rather than being presented as something the product does today.
 */
function Pillars() {
  const pillars = [
    {
      icon: Users,
      title: "Audience tracking",
      body: "Every follower, unfollower and re-follow — who, and exactly when.",
    },
    {
      icon: LineChart,
      title: "Repo traffic & stats",
      body: "Views and clones recorded daily, kept long after GitHub drops them.",
    },
    {
      icon: Sparkles,
      title: "AI repo analysis",
      body: "Reads your repository structure and writes the report.",
      soon: true,
    },
  ];

  return (
    <motion.ul
      initial={{ opacity: 0, y: 14 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.8, delay: 0.74, ease }}
      className="mt-7 grid gap-4 border-t border-hairline pt-5 sm:grid-cols-3 lg:mt-8 lg:pt-6"
    >
      {pillars.map(({ icon: Icon, title, body, soon }) => (
        <li key={title}>
          <div className="mb-2 flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg border border-indigo-2/25 bg-indigo-2/10 text-indigo-lift">
              <Icon className="size-3.5" />
            </span>
            {soon && (
              <span className="rounded-full border border-hairline bg-glass px-1.5 py-0.5 text-[9px] font-semibold tracking-wider text-ink-3 uppercase">
                Soon
              </span>
            )}
          </div>
          <p className="text-[13px] font-medium text-ink">{title}</p>
          <p className="mt-0.5 text-[12px] leading-relaxed text-ink-3">{body}</p>
        </li>
      ))}
    </motion.ul>
  );
}

export function Hero() {
  return (
    // Single screen: the hero owns the whole viewport, so the page never scrolls
    // on desktop. min-h-dvh (not h-dvh) so it still grows if content wraps on mobile.
    <section className="relative isolate flex min-h-dvh items-center pt-24 pb-12 lg:pt-20 lg:pb-10">
      <div className="mx-auto grid w-full max-w-7xl items-center gap-12 px-6 lg:grid-cols-[1.05fr_1fr] lg:gap-16 lg:px-8">
        {/* ── Left ── */}
        <div>
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.7, ease }}
          >
            <span className="inline-flex items-center gap-2 rounded-full border border-hairline bg-glass py-1.5 pr-3.5 pl-1.5 backdrop-blur-xl">
              <span className="flex items-center gap-1 rounded-full bg-indigo-2/20 px-2 py-0.5 text-[10px] font-semibold tracking-wide text-indigo-lift uppercase">
                <ShieldCheck className="size-3" />
                v2
              </span>
              <span className="text-[13px] text-ink-2">
                Your GitHub history, kept on purpose
              </span>
            </span>
          </motion.div>

          <div className="mt-6 lg:mt-7">
            <Headline />
          </div>

          <motion.p
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.5, ease }}
            className="mt-5 max-w-xl text-[clamp(13.5px,1.9vh,15.5px)] leading-[1.65] text-ink-3 lg:mt-6"
          >
            See <span className="text-ink-2">who followed you, who left, and when</span> —
            all on one dashboard. GitHub keeps only{" "}
            <span className="text-ink-2">14 days</span> of repository traffic; GitPulse
            records views and clones <span className="text-ink-2">every day</span> and
            builds the full history it never gave you. Next up:{" "}
            <span className="text-ink">AI that reads your repos and writes the analysis.</span>
          </motion.p>

          <motion.div
            initial={{ opacity: 0, y: 14 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, delay: 0.62, ease }}
            className="mt-7 flex flex-wrap items-center gap-3 lg:mt-8"
          >
            <Magnetic>
              <Button asChild variant="primary" size="lg">
                <Link href="/dashboard">
                  Open dashboard
                  <ArrowRight className="size-4" />
                </Link>
              </Button>
            </Magnetic>
            <Button asChild variant="secondary" size="lg">
              <a
                href="https://github.com/KalyanM45"
                target="_blank"
                rel="noopener noreferrer"
              >
                <Github className="size-4" />
                View source
              </a>
            </Button>
          </motion.div>

          <Pillars />
        </div>

        {/* ── Right ── */}
        <DashboardMockup />
      </div>
    </section>
  );
}
