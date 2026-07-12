"use client";

import {
  Award,
  BookMarked,
  Building2,
  CalendarDays,
  Github,
  Link as LinkIcon,
  Mail,
  MapPin,
  Star,
  Users,
} from "lucide-react";
import Image from "next/image";
import { comma, compact } from "@/lib/format";
import { useFollowerStats, useProfile, useReposOverview } from "@/lib/hooks";
import type { Profile } from "@/lib/types";
import { Tooltip } from "@/components/ui/overlays";
import { Skeleton } from "@/components/ui/primitives";
import { cn } from "@/lib/utils";

/* ── Meta row (company / location / joined) ────────────────────────────────── */

function Meta({ icon: Icon, children }: { icon: typeof MapPin; children: React.ReactNode }) {
  return (
    <li className="flex items-center gap-2 text-[11.5px] text-ink-3">
      <Icon className="size-3 shrink-0" />
      <span className="truncate">{children}</span>
    </li>
  );
}

/* ── External link chip ─────────────────────────────────────────────────────── */

function LinkChip({
  href,
  label,
  icon: Icon,
}: {
  href: string;
  label: string;
  // Not `typeof Github` — the X glyph is a plain SVG component, not a Lucide icon.
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <Tooltip content={label}>
      <a
        href={href}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={label}
        className={cn(
          "flex size-8 items-center justify-center rounded-lg border border-hairline bg-white/[0.03]",
          "text-ink-3 transition-all duration-200",
          "hover:-translate-y-0.5 hover:border-hairline-strong hover:bg-glass hover:text-ink",
          "focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo-lift",
        )}
      >
        <Icon className="size-3.5" />
      </a>
    </Tooltip>
  );
}

/* ── Milestones ─────────────────────────────────────────────────────────────
   Derived from real synced totals. GitHub's own "Achievements" (Pull Shark etc.)
   are not exposed by any API, so these are computed, not scraped — and each one
   states the number it came from. */

function Milestones({
  stars,
  followers,
  repos,
}: {
  stars?: number;
  followers?: number;
  repos?: number;
}) {
  const items = [
    { icon: Star, value: stars, tiers: [10, 100, 1000, 5000], label: "stars" },
    { icon: Users, value: followers, tiers: [10, 100, 500, 1000], label: "followers" },
    { icon: BookMarked, value: repos, tiers: [5, 20, 50, 100], label: "repos" },
  ];

  return (
    <div className="flex items-center gap-1.5">
      {items.map(({ icon: Icon, value, tiers, label }) => {
        const tier = value === undefined ? 0 : tiers.filter((t) => value >= t).length;
        const earned = tier > 0;

        return (
          <Tooltip
            key={label}
            content={
              value === undefined
                ? "—"
                : `${comma(value)} ${label}${earned ? ` · tier ${tier}/${tiers.length}` : ""}`
            }
          >
            <div
              className={cn(
                "flex flex-1 cursor-default items-center justify-center gap-1 rounded-lg border py-1.5",
                earned
                  ? "border-indigo-2/25 bg-indigo-2/10 text-indigo-lift"
                  : "border-hairline bg-white/[0.02] text-ink-3",
              )}
            >
              <Icon className="size-3" />
              <span className="tnum text-[11px] font-medium">
                {value === undefined ? "—" : compact(value)}
              </span>
            </div>
          </Tooltip>
        );
      })}
    </div>
  );
}

/* ── Card ───────────────────────────────────────────────────────────────────── */

function Links({ p }: { p: Profile }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      <LinkChip href={p.html_url} label={`@${p.login} on GitHub`} icon={Github} />
      {p.blog && <LinkChip href={p.blog} label={p.blog} icon={LinkIcon} />}
      {p.twitter_username && (
        <LinkChip
          href={`https://x.com/${p.twitter_username}`}
          label={`@${p.twitter_username} on X`}
          icon={XIcon}
        />
      )}
      {p.email && <LinkChip href={`mailto:${p.email}`} label={p.email} icon={Mail} />}
    </div>
  );
}

/** X's glyph isn't in lucide — inline it rather than mislabel it as Twitter. */
function XIcon({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
    </svg>
  );
}

export function SidebarProfile() {
  const { data: p, isLoading } = useProfile();
  const stats = useFollowerStats();
  const repos = useReposOverview();

  if (isLoading || !p) {
    return (
      <div className="space-y-3 rounded-2xl border border-hairline bg-glass p-4">
        <div className="flex items-center gap-3">
          <Skeleton className="size-10 rounded-full" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className="h-3.5 w-full" />
            <Skeleton className="h-3 w-2/3" />
          </div>
        </div>
        <Skeleton className="h-8 w-full" />
      </div>
    );
  }

  const joined = p.created_at
    ? new Date(p.created_at).getUTCFullYear()
    : null;

  return (
    <div className="rounded-2xl border border-hairline bg-glass p-4 backdrop-blur-xl">
      {/* Identity */}
      <a
        href={p.html_url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 rounded-lg transition-opacity hover:opacity-80"
      >
        <Image
          src={p.avatar_url}
          alt=""
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-full ring-1 ring-hairline"
        />
        <div className="min-w-0">
          <p className="truncate text-[13px] font-semibold text-ink">{p.name}</p>
          <p className="truncate text-[11.5px] text-ink-3">@{p.login}</p>
        </div>
      </a>

      {p.bio && (
        <p className="mt-3 line-clamp-2 text-[11.5px] leading-relaxed text-ink-3">
          {p.bio}
        </p>
      )}

      {/* Only rows that actually have a value — no empty slots. */}
      {(p.company || p.location || joined) && (
        <ul className="mt-3 space-y-1.5">
          {p.company && <Meta icon={Building2}>{p.company}</Meta>}
          {p.location && <Meta icon={MapPin}>{p.location}</Meta>}
          {joined && <Meta icon={CalendarDays}>Joined {joined}</Meta>}
        </ul>
      )}

      <div className="my-3.5 h-px bg-hairline" />

      <div className="mb-3 flex items-center gap-1.5 text-[10px] font-medium tracking-wider text-ink-3 uppercase">
        <Award className="size-3" />
        Milestones
      </div>
      <Milestones
        stars={repos.data?.total_stars}
        followers={stats.data?.total_followers}
        repos={repos.data?.total_repos}
      />

      <div className="mt-3.5">
        <Links p={p} />
      </div>
    </div>
  );
}
