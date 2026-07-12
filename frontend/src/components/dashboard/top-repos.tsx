"use client";

import { motion } from "framer-motion";
import { ExternalLink } from "lucide-react";
import { Badge, Skeleton } from "@/components/ui/primitives";
import { Tooltip } from "@/components/ui/overlays";
import { comma, languageColor } from "@/lib/format";
import type { RepoSummary } from "@/lib/types";
import { cn } from "@/lib/utils";

/**
 * Headed table rather than a bare list. Columns are laid out on one grid template
 * shared by the header and every row, so they stay aligned without a <table> —
 * which can't do rounded, independently-animated rows.
 */
const GRID =
  "grid grid-cols-[minmax(0,1fr)_84px_72px_72px_72px_76px] items-center gap-3";

function Head({ children, right }: { children: React.ReactNode; right?: boolean }) {
  return (
    <div
      role="columnheader"
      className={cn(
        "text-[10px] font-medium tracking-wider text-ink-3 uppercase",
        right && "text-right",
      )}
    >
      {children}
    </div>
  );
}

export function TopRepos({
  repos,
  loading,
}: {
  repos: RepoSummary[] | undefined;
  loading?: boolean;
}) {
  if (loading) {
    return (
      <div className="space-y-1 px-4 pb-4">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    );
  }

  if (!repos?.length) {
    return <p className="px-6 pb-6 text-[13px] text-ink-3">No repositories synced yet.</p>;
  }

  const rows = repos.slice(0, 6);
  const max = Math.max(...rows.map((r) => r.stars), 1);

  return (
    <div className="overflow-x-auto px-4 pb-4">
      <div role="table" className="min-w-[560px]">
        <div
          role="row"
          className={cn(GRID, "border-b border-hairline px-3 pb-2.5")}
        >
          <Head>Repository</Head>
          <Head>Visibility</Head>
          <Head right>Stars</Head>
          <Head right>Watchers</Head>
          <Head right>Commits</Head>
          <Head right>Branches</Head>
        </div>

        <div role="rowgroup" className="pt-1">
          {rows.map((r, i) => (
            <motion.a
              key={r.name}
              role="row"
              href={r.html_url}
              target="_blank"
              rel="noopener noreferrer"
              initial={{ opacity: 0, x: -8 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.4, delay: i * 0.05, ease: [0.16, 1, 0.3, 1] }}
              className={cn(
                GRID,
                "group relative rounded-xl px-3 py-2.5 transition-colors hover:bg-white/[0.035]",
              )}
            >
              {/* Magnitude rail — the bar is the comparison, the number confirms it. */}
              <span
                aria-hidden
                className="absolute inset-y-1.5 left-0 -z-10 rounded-r-full bg-indigo-2/[0.07]"
                style={{ width: `${(r.stars / max) * 100}%` }}
              />

              <div className="min-w-0">
                <div className="flex items-center gap-1.5">
                  <span className="truncate text-[13px] font-medium text-ink">
                    {r.name}
                  </span>
                  <ExternalLink className="size-3 shrink-0 text-ink-3 opacity-0 transition-opacity group-hover:opacity-100" />
                </div>
                {r.language && (
                  <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-ink-3">
                    <span
                      className="size-2 rounded-full"
                      style={{ background: languageColor(r.language) }}
                      aria-hidden
                    />
                    {r.language}
                  </span>
                )}
              </div>

              <div>
                {r.is_private ? (
                  <Badge tone="warning">Private</Badge>
                ) : (
                  <Badge tone="neutral">Public</Badge>
                )}
              </div>

              <span className="tnum text-right text-[12.5px] text-ink-2">
                {comma(r.stars)}
              </span>
              <span className="tnum text-right text-[12.5px] text-ink-3">
                {comma(r.watchers)}
              </span>
              {/* All-time commits. commits_last_year is only the last 52 weeks —
                  showing it here made a 52-commit repo read as "9". */}
              <Tooltip content={`${comma(r.commits_last_year)} in the last year`}>
                <span className="tnum cursor-default text-right text-[12.5px] text-ink-3">
                  {comma(r.commits_total)}
                </span>
              </Tooltip>
              <span className="tnum text-right text-[12.5px] text-ink-3">
                {comma(r.branches)}
              </span>
            </motion.a>
          ))}
        </div>
      </div>
    </div>
  );
}
