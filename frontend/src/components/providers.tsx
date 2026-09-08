"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useEffect, useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/overlays";
import { ApiError } from "@/lib/api";
import { persistCache, restoreCache } from "@/lib/persist";
import { PrefsProvider } from "@/lib/prefs";

export function Providers({ children }: { children: ReactNode }) {
  const [client] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            /**
             * This is the stale-while-revalidate behaviour the old vanilla app
             * hand-rolled against localStorage: serve the cached value instantly,
             * refetch in the background. React Query also dedupes in-flight
             * requests and discards responses for queries that are no longer
             * mounted — which is what the old `activeView === view && page === reqPage`
             * race guard was doing by hand.
             */
            staleTime: 60_000,
            /**
             * Long, because the cache now outlives the tab (see lib/persist).
             * The old 5 minutes would have evicted a restored entry almost
             * immediately, so the restore would have bought nothing.
             */
            gcTime: 24 * 60 * 60_000,
            /**
             * On, because syncs happen outside the browser — the cron runs four
             * times a day and the scheduler hourly. Coming back to a tab is the
             * clearest signal that what is on screen may be old. staleTime above
             * keeps this from firing on every alt-tab.
             */
            refetchOnWindowFocus: true,
            retry: (failureCount, error) => {
              // Don't retry a 404 — the resource genuinely isn't there.
              if (error instanceof ApiError && error.status === 404) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

  /**
   * Restore in an effect rather than in the `useState` initialiser: the initialiser
   * also runs during SSR-less prerender, and filling the cache before hydration
   * would make the client's first render disagree with the server's markup. Running
   * a tick later costs one frame of skeleton and keeps hydration clean.
   */
  useEffect(() => {
    restoreCache(client);
    return persistCache(client);
  }, [client]);

  return (
    <QueryClientProvider client={client}>
      <PrefsProvider>
        <TooltipProvider delayDuration={220} skipDelayDuration={400}>
          {children}
        </TooltipProvider>
      </PrefsProvider>
    </QueryClientProvider>
  );
}
