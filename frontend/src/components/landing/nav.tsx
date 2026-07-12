"use client";

import { Activity, ArrowRight } from "lucide-react";
import Link from "next/link";
import { Magnetic } from "@/components/motion/primitives";
import { Button } from "@/components/ui/button";

export function LandingNav() {
  return (
    <header className="absolute inset-x-0 top-0 z-50">
      <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6 lg:px-8">
        <Link href="/" className="flex items-center gap-2.5" aria-label="GitPulse home">
          <span className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#6366f1,#4f46e5)] shadow-[0_4px_16px_-4px_rgba(79,70,229,0.9)]">
            <Activity className="size-4 text-white" strokeWidth={2.5} />
          </span>
          <span className="text-[15px] font-semibold tracking-tight text-ink">GitPulse</span>
        </Link>

        <Magnetic strength={0.25}>
          <Button asChild variant="primary" size="sm">
            <Link href="/dashboard">
              Open dashboard
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </Magnetic>
      </nav>
    </header>
  );
}
