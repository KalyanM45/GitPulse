"use client";

import {
  BookMarked,
  Copy,
  Eye,
  GitCommitHorizontal,
  GitFork,
  Globe,
  // `Lock` alone collides with the DOM's Web Locks API type.
  Lock as LockIcon,
  Star,
  UserMinus,
  UserRoundCheck,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { ContributionsByYear, LanguageDonut } from "@/components/dashboard/charts";
import { ContributionHeatmap } from "@/components/dashboard/heatmap";
import { KpiGrid, type Kpi } from "@/components/dashboard/kpi";
import { TopRepos } from "@/components/dashboard/top-repos";
import { LastSynced } from "@/components/shell/topbar";
import { Panel, PanelHeader } from "@/components/ui/card";
import {
  Dropdown,
  DropdownContent,
  DropdownItem,
  DropdownTrigger,
} from "@/components/ui/overlays";
import { Button } from "@/components/ui/button";
import { PageHeading } from "@/components/ui/primitives";
import { comma } from "@/lib/format";
import {
  useContributionYear,
  useContributions,
  useFollowerStats,
  useProfile,
  useReposOverview,
} from "@/lib/hooks";

export default function DashboardPage() {
  const profile = useProfile();
  const stats = useFollowerStats();
  const repos = useReposOverview();
  const contrib = useContributions();

  // Default to the most recent year we actually have data for — not `new Date()`,
  // which would 404 in January before the first sync of the year.
  const availableYears = useMemo(
    () => (contrib.data?.years ?? []).map((y) => y.year).sort((a, b) => b - a),
    [contrib.data],
  );
  const [year, setYear] = useState<number | null>(null);
  const activeYear = year ?? availableYears[0];

  const yearData = useContributionYear(activeYear);

  const kpis: Kpi[] = [
    {
      label: "Followers",
      value: stats.data?.total_followers,
      icon: Users,
      tone: "brand",
      sub: "People following you",
    },
    {
      label: "Following",
      value: profile.data?.following,
      icon: UserRoundCheck,
      tone: "brand",
      sub: "Accounts you follow",
    },
    {
      label: "Lost followers",
      value: stats.data?.total_unfollowed_events,
      icon: UserMinus,
      tone: "negative",
      sub: "Unfollowed and not returned",
    },
  ];

  // Kept as its own row of three. Folding these into the audience row made six
  // cards, which wrapped and left "Private repos" orphaned on a line of its own.
  const countKpis: Kpi[] = [
    {
      label: "Repositories",
      value: repos.data?.total_repos,
      icon: BookMarked,
      tone: "brand",
      sub: "Owned by you",
    },
    {
      label: "Public repos",
      value: repos.data?.public_repos,
      icon: Globe,
      tone: "positive",
      sub: "Visible to everyone",
    },
    {
      label: "Private repos",
      value: repos.data?.private_repos,
      icon: LockIcon,
      tone: "negative",
      sub: "Visible only to you",
    },
  ];

  const repoKpis: Kpi[] = [
    {
      label: "Total stars",
      value: repos.data?.total_stars,
      icon: Star,
      tone: "brand",
      sub: repos.data ? `across ${comma(repos.data.total_repos)} repos` : undefined,
    },
    {
      label: "Forks",
      value: repos.data?.total_forks,
      icon: GitFork,
      sub: repos.data ? `${comma(repos.data.total_watchers)} watchers` : undefined,
    },
    {
      label: "Repository views",
      value: repos.data?.total_views,
      icon: Eye,
      // Say what the window actually is — this is accumulated history, not GitHub's 14 days.
      sub: repos.data
        ? `${comma(repos.data.total_views_unique)} unique · ${repos.data.traffic_days_recorded}d recorded`
        : undefined,
    },
    {
      label: "Clones",
      value: repos.data?.total_clones,
      icon: Copy,
      sub: repos.data ? `${comma(repos.data.total_clones_unique)} unique` : undefined,
    },
    {
      label: "Commits",
      value: repos.data?.total_commits,
      icon: GitCommitHorizontal,
      // All-time, with the last-52-weeks figure as context rather than as the headline.
      sub: repos.data
        ? `${comma(repos.data.total_commits_year)} in the last year`
        : undefined,
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeading
        title="Overview"
        description="Your audience, repositories and contribution history — all from the last sync."
        action={<LastSynced at={repos.data?.synced_at} />}
      />

      <KpiGrid kpis={kpis} loading={stats.isLoading || repos.isLoading} />
      <KpiGrid kpis={countKpis} loading={repos.isLoading} />

      {/* Contribution heatmap */}
      <Panel>
        <PanelHeader
          title="Contributions"
          description={
            yearData.data
              ? `${comma(yearData.data.total_contributions)} contributions in ${activeYear}`
              : "Commits, issues, pull requests and reviews"
          }
          action={
            availableYears.length > 0 && (
              <Dropdown>
                <DropdownTrigger asChild>
                  <Button variant="secondary" size="sm">
                    {activeYear ?? "—"}
                  </Button>
                </DropdownTrigger>
                <DropdownContent>
                  {availableYears.map((y) => (
                    <DropdownItem key={y} onSelect={() => setYear(y)} selected={y === activeYear}>
                      {y}
                    </DropdownItem>
                  ))}
                </DropdownContent>
              </Dropdown>
            )
          }
        />
        <ContributionHeatmap
          weeks={yearData.data?.weeks}
          loading={contrib.isLoading || yearData.isLoading}
        />
      </Panel>

      <div className="grid gap-6 xl:grid-cols-2">
        <Panel>
          <PanelHeader
            title="Contributions by year"
            description="Split by commits, reviews, issues and pull requests"
          />
          <ContributionsByYear years={contrib.data?.years} loading={contrib.isLoading} />
        </Panel>

        <Panel>
          <PanelHeader
            title="Languages"
            description="Share of code across every repository you own"
          />
          <LanguageDonut languages={repos.data?.top_languages} loading={repos.isLoading} />
        </Panel>
      </div>

      <KpiGrid kpis={repoKpis} loading={repos.isLoading} />

      <Panel>
        <PanelHeader
          title="Top repositories"
          description="Ranked by stars"
          action={
            <Button asChild variant="ghost" size="sm">
              <Link href="/repositories">View all</Link>
            </Button>
          }
        />
        <TopRepos repos={repos.data?.most_starred} loading={repos.isLoading} />
      </Panel>
    </div>
  );
}
