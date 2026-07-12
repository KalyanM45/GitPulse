"use client";

import { motion } from "framer-motion";
import { UserMinus, UserPlus } from "lucide-react";
import { Dialog, DrawerContent } from "@/components/ui/overlays";
import { EmptyState, Skeleton } from "@/components/ui/primitives";
import { formatDateTime, relativeTime } from "@/lib/format";
import { useFollowerHistory } from "@/lib/hooks";
import { cn } from "@/lib/utils";

/**
 * Follower history. The backend resolves this by github_id, so the timeline
 * spans username changes — searching an old handle still finds the person.
 */
export function HistoryDrawer({
  login,
  onClose,
}: {
  login: string | null;
  onClose: () => void;
}) {
  const { data, isLoading } = useFollowerHistory(login);

  return (
    <Dialog open={!!login} onOpenChange={(o) => !o && onClose()}>
      {login && (
        <DrawerContent title={`@${login}`} description="Follow history">
          <div className="p-6">
            {isLoading ? (
              <div className="space-y-3">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="h-16" />
                ))}
              </div>
            ) : !data?.length ? (
              <EmptyState
                icon={<UserPlus className="size-6" />}
                title="No history recorded"
                description="This account has no follow or unfollow events yet."
              />
            ) : (
              <ol className="relative space-y-1">
                {/* Spine */}
                <span
                  aria-hidden
                  className="absolute top-2 bottom-2 left-[19px] w-px bg-hairline"
                />

                {data.map((ev, i) => {
                  const gained = ev.event_type === "followed";
                  const Icon = gained ? UserPlus : UserMinus;

                  return (
                    <motion.li
                      key={`${ev.event_at}-${ev.event_type}`}
                      initial={{ opacity: 0, x: -8 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{
                        duration: 0.4,
                        delay: i * 0.06,
                        ease: [0.16, 1, 0.3, 1],
                      }}
                      className="relative flex gap-4 rounded-xl p-2 transition-colors hover:bg-white/[0.03]"
                    >
                      <span
                        className={cn(
                          "relative z-10 flex size-10 shrink-0 items-center justify-center rounded-full border",
                          gained
                            ? "border-positive/25 bg-positive/12 text-positive"
                            : "border-negative/25 bg-negative/12 text-negative",
                        )}
                      >
                        <Icon className="size-4" />
                      </span>

                      <div className="min-w-0 pt-1.5">
                        <p className="text-[13.5px] font-medium text-ink">
                          {gained ? "Followed you" : "Unfollowed you"}
                        </p>
                        <p className="mt-0.5 text-[12px] text-ink-3">
                          {formatDateTime(ev.event_at)} · {relativeTime(ev.event_at)}
                        </p>
                        {/* If the login on the event differs from the one we searched,
                            it's the same person under an older name. */}
                        {ev.login !== login && (
                          <p className="mt-1 text-[11px] text-ink-3">as @{ev.login}</p>
                        )}
                      </div>
                    </motion.li>
                  );
                })}
              </ol>
            )}
          </div>
        </DrawerContent>
      )}
    </Dialog>
  );
}
