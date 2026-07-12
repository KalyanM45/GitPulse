"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/overlays";
import { ApiError } from "@/lib/api";
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
            gcTime: 5 * 60_000,
            refetchOnWindowFocus: false,
            retry: (failureCount, error) => {
              // Don't retry a 404 — the resource genuinely isn't there.
              if (error instanceof ApiError && error.status === 404) return false;
              return failureCount < 2;
            },
          },
        },
      }),
  );

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
