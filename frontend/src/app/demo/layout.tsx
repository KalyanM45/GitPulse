"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthLoading } from "@/components/auth/auth-ui";
import { DemoBanner } from "@/components/demo/demo-banner";
import { AppShell } from "@/components/shell/app-shell";

/**
 * Read-only demo of the owner's dashboard, at /demo/dashboard, /demo/audience and
 * /demo/repositories. The pages are the real dashboard pages (re-exported); the
 * API client switches to the read-only /demo/api/* endpoints on /demo URLs
 * (lib/api.ts).
 *
 * Who gets in: anyone signed in with a verified email, invited or not. Visitors
 * who aren't signed in are sent to sign in first, then brought back here.
 */
export default function DemoLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status } = useAuth();

  // A separate, non-persisted cache: demo data must never show up in (or be
  // overwritten by) the visitor's own dashboard cache, which uses the same keys.
  const [client] = useState(
    () => new QueryClient({ defaultOptions: { queries: { staleTime: 5 * 60_000, retry: 1 } } }),
  );

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === "unverified") router.replace(`/verify-email?next=${encodeURIComponent(pathname)}`);
  }, [status, pathname, router]);

  if (status !== "authenticated" && status !== "forbidden") return <AuthLoading />;

  return (
    <QueryClientProvider client={client}>
      <AppShell banner={<DemoBanner />}>{children}</AppShell>
    </QueryClientProvider>
  );
}
