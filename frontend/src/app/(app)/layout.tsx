"use client";

import { motion } from "framer-motion";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/components/auth/auth-provider";
import { NoAccess } from "@/components/access/no-access";
import { AuthLoading } from "@/components/auth/auth-ui";
import { MobileSidebar, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();
  const router = useRouter();
  const { status, appUser } = useAuth();

  // Not ready for the dashboard yet: no GitHub connected, or nothing synced so far.
  // (appUser is null only if the API was unreachable: let the dashboard handle that.)
  const needsOnboarding =
    !!appUser && (!appUser.github.connected || !!appUser.github.needs_reconnect || !appUser.last_synced_at);

  // Every page in this group needs a signed-in, verified user with GitHub data.
  useEffect(() => {
    if (status === "anonymous") router.replace(`/login?next=${encodeURIComponent(pathname)}`);
    else if (status === "unverified") router.replace("/verify-email");
    else if (status === "authenticated" && needsOnboarding) router.replace("/connect");
  }, [status, needsOnboarding, pathname, router]);

  if (status === "forbidden") return <NoAccess />;
  if (status !== "authenticated" || needsOnboarding) return <AuthLoading />;

  return (
    <div className="relative min-h-dvh">
      {/* Ambient wash — static here, unlike the landing page. The dashboard needs
          to stay legible, so this is a fixed backdrop, not an animated one. */}
      <div aria-hidden className="pointer-events-none fixed inset-0 -z-10">
        <div className="absolute inset-0 bg-base" />
        <div
          className="absolute -top-40 -left-40 size-[520px] rounded-full opacity-40 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(79,70,229,0.35), transparent 70%)",
          }}
        />
        <div
          className="absolute top-1/3 -right-40 size-[420px] rounded-full opacity-30 blur-[120px]"
          style={{
            background: "radial-gradient(circle, rgba(56,189,248,0.25), transparent 70%)",
          }}
        />
      </div>

      <Sidebar />
      <MobileSidebar open={menu} onClose={() => setMenu(false)} />

      <div className="lg:pl-60">
        <Topbar onMenu={() => setMenu(true)} />

        <main id="main" className="px-5 py-8 lg:px-8 lg:py-10">
          {/* Page transition — keyed on route, so each page fades/slides in. */}
          <motion.div
            key={pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            className="mx-auto max-w-7xl"
          >
            {children}
          </motion.div>
        </main>
      </div>
    </div>
  );
}
