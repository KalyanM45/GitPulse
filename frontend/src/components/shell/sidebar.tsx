"use client";

import { AnimatePresence, motion } from "framer-motion";
import { Activity, BookMarked, LayoutDashboard, Users, X } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { SidebarProfile } from "./profile-card";
import { cn } from "@/lib/utils";

const NAV = [
  { href: "/dashboard", label: "Overview", icon: LayoutDashboard },
  { href: "/audience", label: "Audience", icon: Users },
  { href: "/repositories", label: "Repositories", icon: BookMarked },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const pathname = usePathname();

  return (
    <nav className="flex flex-col gap-0.5 px-3" aria-label="Primary">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname === href || pathname.startsWith(`${href}/`);
        return (
          <Link
            key={href}
            href={href}
            onClick={onNavigate}
            aria-current={active ? "page" : undefined}
            className={cn(
              "group relative flex items-center gap-3 rounded-xl px-3 py-2.5",
              "text-[13.5px] font-medium transition-colors duration-200",
              "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
              active ? "text-ink" : "text-ink-3 hover:text-ink-2",
            )}
          >
            {/* Shared element — the pill slides between items instead of fading. */}
            {active && (
              <motion.span
                layoutId="nav-active"
                transition={{ type: "spring", stiffness: 380, damping: 32 }}
                className="absolute inset-0 -z-10 rounded-xl border border-hairline bg-glass"
              />
            )}
            <Icon
              className={cn(
                "size-4 shrink-0 transition-colors",
                active ? "text-indigo-lift" : "text-ink-3 group-hover:text-ink-2",
              )}
            />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}

function Brand() {
  return (
    <Link
      href="/"
      className="flex items-center gap-2.5 px-6 py-6"
      aria-label="GitPulse home"
    >
      <span className="flex size-8 items-center justify-center rounded-lg bg-[linear-gradient(135deg,#6366f1,#4f46e5)] shadow-[0_4px_16px_-4px_rgba(79,70,229,0.9)]">
        <Activity className="size-4 text-white" strokeWidth={2.5} />
      </span>
      <span className="text-[15px] font-semibold tracking-tight text-ink">GitPulse</span>
    </Link>
  );
}

export function Sidebar() {
  return (
    <aside className="fixed inset-y-0 left-0 z-30 hidden w-60 flex-col border-r border-hairline bg-surface/50 backdrop-blur-2xl lg:flex">
      <Brand />
      <NavList />
      {/* mt-auto pins this to the bottom, so the dead space between the nav and
          the fold is filled by something real rather than left blank. */}
      <div className="mt-auto p-3">
        <SidebarProfile />
      </div>
    </aside>
  );
}

/** Mobile drawer version of the same nav. */
export function MobileSidebar({
  open,
  onClose,
}: {
  open: boolean;
  onClose: () => void;
}) {
  // Lock the page behind the drawer; restore on close.
  useEffect(() => {
    if (!open) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prev;
      window.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-base/70 backdrop-blur-md lg:hidden"
          />
          <motion.aside
            initial={{ x: "-100%" }}
            animate={{ x: 0 }}
            exit={{ x: "-100%" }}
            transition={{ type: "spring", stiffness: 300, damping: 34 }}
            className="fixed inset-y-0 left-0 z-50 flex w-64 flex-col border-r border-hairline bg-surface/95 backdrop-blur-2xl lg:hidden"
          >
            <div className="flex items-center justify-between pr-3">
              <Brand />
              <button
                onClick={onClose}
                aria-label="Close navigation"
                className="flex size-9 items-center justify-center rounded-lg text-ink-3 transition hover:bg-glass hover:text-ink"
              >
                <X className="size-4" />
              </button>
            </div>
            <NavList onNavigate={onClose} />
            <div className="mt-auto p-3">
              <SidebarProfile />
            </div>
          </motion.aside>
        </>
      )}
    </AnimatePresence>
  );
}
