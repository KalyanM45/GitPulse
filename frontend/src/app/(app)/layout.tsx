"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { NoAccess } from "@/components/access/no-access";
import { useAuth } from "@/components/auth/auth-provider";
import { AuthLoading } from "@/components/auth/auth-ui";
import { AppShell } from "@/components/shell/app-shell";

/**
 * The signed-in user's own dashboard (/dashboard, /audience, /repositories,
 * /admin). Who gets in:
 *
 *   not signed in            → /login, then back here
 *   email not verified       → /verify-email
 *   signed in, not invited   → "invite-only" screen (request access / view demo)
 *   invited, no GitHub data  → /connect (connect GitHub, first sync)
 *   invited, has data        → their dashboard
 */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { status, appUser } = useAuth();

  // appUser is null only if the API was unreachable; let the pages show that.
  const needsOnboarding =
    !!appUser && (!appUser.github.connected || !!appUser.github.needs_reconnect || !appUser.last_synced_at);

  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === "unverified") router.replace("/verify-email");
    else if (status === "authenticated" && needsOnboarding) router.replace("/connect");
  }, [status, needsOnboarding, pathname, router]);

  if (status === "forbidden") return <NoAccess />;
  if (status !== "authenticated" || needsOnboarding) return <AuthLoading />;

  return <AppShell>{children}</AppShell>;
}
