"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState } from "react";
import { DemoBanner } from "@/components/demo/demo-banner";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Read-only demo of the owner's dashboard, at /demo/dashboard, /demo/audience and
 * /demo/repositories. The pages are the real dashboard pages (re-exported); the
 * API client switches to the read-only /demo/api/* endpoints on /demo URLs
 * (lib/api.ts).
 *
 * Who gets in: anyone. No sign-in needed; the data is read-only and private
 * repositories are hidden (backend/app/demo.py).
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  // A separate, non-persisted cache: demo data must never show up in (or be
  // overwritten by) the visitor's own dashboard cache, which uses the same keys.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } } }),
  );

  return (
    <QueryClientProvider client={client}>
      <AppShell banner={<DemoBanner />}>{children}</AppShell>
    </QueryClientProvider>
  );
}
