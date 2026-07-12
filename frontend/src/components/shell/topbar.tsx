"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Check, Menu, RefreshCw, TriangleAlert } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Tooltip } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";
import { relativeTime } from "@/lib/format";
import { useProfile, useSync } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/** Toast — success and failure both land here. Never fake a success. */
function Toast({ tone, children }: { tone: "ok" | "err"; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 16, scale: 0.96 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: 8, scale: 0.98 }}
      transition={{ type: "spring", stiffness: 340, damping: 28 }}
      role="status"
      className={cn(
        "fixed bottom-6 left-1/2 z-[80] flex -translate-x-1/2 items-center gap-2.5",
        "rounded-xl border px-4 py-2.5 text-[13px] shadow-2xl backdrop-blur-2xl",
        tone === "ok"
          ? "border-positive/25 bg-positive/10 text-positive"
          : "border-negative/25 bg-negative/10 text-negative",
      )}
    >
      {tone === "ok" ? (
        <Check className="size-4 shrink-0" />
      ) : (
        <TriangleAlert className="size-4 shrink-0" />
      )}
      {children}
    </motion.div>
  );
}

export function Topbar({ onMenu }: { onMenu: () => void }) {
  const { data: profile, isLoading } = useProfile();
  const sync = useSync();
  const [toast, setToast] = useState<{ tone: "ok" | "err"; msg: string } | null>(null);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 4200);
    return () => clearTimeout(t);
  }, [toast]);

  const runSync = () => {
    sync.mutate(undefined, {
      onSuccess: (r) => {
        const bits = [`${r.total_followers.toLocaleString()} followers`];
        if (r.new_followers) bits.push(`+${r.new_followers} new`);
        if (r.lost_followers) bits.push(`−${r.lost_followers} lost`);
        if (r.renamed) bits.push(`${r.renamed} renamed`);
        setToast({ tone: "ok", msg: `Synced — ${bits.join(" · ")}` });
      },
      onError: (e) =>
        setToast({ tone: "err", msg: e instanceof Error ? e.message : "Sync failed" }),
    });
  };

  return (
    <>
      <header className="sticky top-0 z-20 border-b border-hairline bg-base/70 backdrop-blur-2xl">
        <div className="flex h-16 items-center gap-4 px-5 lg:px-8">
          <button
            onClick={onMenu}
            aria-label="Open navigation"
            className="flex size-9 items-center justify-center rounded-lg text-ink-3 transition hover:bg-glass hover:text-ink lg:hidden"
          >
            <Menu className="size-4.5" />
          </button>

          <div className="ml-auto flex items-center gap-3">
            <Tooltip content="Pull the latest data from GitHub">
              <Button
                variant="secondary"
                size="sm"
                onClick={runSync}
                loading={sync.isPending}
                className="gap-2"
              >
                {!sync.isPending && <RefreshCw className="size-3.5" />}
                {sync.isPending ? "Syncing…" : "Sync"}
              </Button>
            </Tooltip>

            <div className="h-6 w-px bg-hairline" aria-hidden />

            {isLoading ? (
              <div className="flex items-center gap-2.5">
                <Skeleton className="size-8 rounded-full" />
                <Skeleton className="h-3.5 w-24" />
              </div>
            ) : profile ? (
              <a
                href={profile.html_url}
                target="_blank"
                rel="noopener noreferrer"
                className="group flex items-center gap-2.5 rounded-lg py-1 pr-2 pl-1 transition hover:bg-glass"
              >
                <Image
                  src={profile.avatar_url}
                  alt=""
                  width={32}
                  height={32}
                  className="size-8 rounded-full ring-1 ring-hairline"
                  priority
                />
                <span className="hidden text-left sm:block">
                  <span className="block text-[13px] leading-tight font-medium text-ink">
                    {profile.name || profile.login}
                  </span>
                  <span className="block text-[11px] leading-tight text-ink-3">
                    @{profile.login}
                  </span>
                </span>
              </a>
            ) : null}
          </div>
        </div>
      </header>

      <AnimatePresence>
        {toast && (
          <Toast key="toast" tone={toast.tone}>
            {toast.msg}
          </Toast>
        )}
      </AnimatePresence>
    </>
  );
}

/** Small "last synced" line for page headers. */
export function LastSynced({ at }: { at: string | null | undefined }) {
  if (!at) return null;
  return (
    <span className="text-[13px] text-ink-3">
      Synced <span className="text-ink-2">{relativeTime(at)}</span>
    </span>
  );
}
