"use client";

import { motion } from "framer-motion";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { MobileSidebar, Sidebar } from "@/components/shell/sidebar";
import { Topbar } from "@/components/shell/topbar";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const [menu, setMenu] = useState(false);
  const pathname = usePathname();

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
