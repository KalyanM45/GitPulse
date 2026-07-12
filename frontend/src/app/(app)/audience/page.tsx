"use client";

import { ExternalLink, PartyPopper, SearchX, UserRound, Users } from "lucide-react";
import Image from "next/image";
import { useEffect, useState } from "react";
import { HistoryDrawer } from "@/components/audience/history-drawer";
import { Panel } from "@/components/ui/card";
import { Column, DataTable, Pagination } from "@/components/ui/data-table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/overlays";
import { Badge, EmptyState, PageHeading, SearchInput } from "@/components/ui/primitives";
import { formatDate, relativeTime } from "@/lib/format";
import { usePrefs } from "@/lib/prefs";
import {
  isEvent,
  useAudience,
  useDebounced,
  useFollowerStats,
  useProfile,
  type AudienceRow,
  type AudienceView,
} from "@/lib/hooks";

const COPY: Record<AudienceView, { title: string; empty: string; emptyHint: string }> = {
  followers: {
    title: "Followers",
    empty: "No followers yet",
    emptyHint: "Run a sync to pull your audience from GitHub.",
  },
  following: {
    title: "Following",
    empty: "Not following anyone",
    emptyHint: "Run a sync to pull the accounts you follow.",
  },
  unfollowed: {
    title: "Lost followers",
    empty: "Nobody has unfollowed you",
    emptyHint: "Everyone who followed you is still here.",
  },
};

function UserCell({ row }: { row: AudienceRow }) {
  const previous =
    "previous_logins" in row && row.previous_logins?.length
      ? row.previous_logins[row.previous_logins.length - 1]
      : null;

  return (
    <div className="flex min-w-0 items-center gap-3">
      <Image
        src={row.avatar_url}
        alt=""
        width={32}
        height={32}
        className="size-8 shrink-0 rounded-full ring-1 ring-hairline"
        loading="lazy"
      />
      <div className="min-w-0">
        {/* Display name leads when there is one; the handle is the identifier
            underneath. Plenty of profiles have no name — then the handle leads
            alone rather than showing an empty row. */}
        {row.name ? (
          <>
            <p className="truncate text-[13.5px] font-medium text-ink">{row.name}</p>
            <p className="truncate text-[11.5px] text-ink-3">
              @{row.login}
              {previous && <span className="text-ink-3/70"> · formerly @{previous}</span>}
            </p>
          </>
        ) : (
          <>
            <p className="truncate text-[13.5px] font-medium text-ink">{row.login}</p>
            {previous && (
              <p className="truncate text-[11.5px] text-ink-3">formerly @{previous}</p>
            )}
          </>
        )}
      </div>
    </div>
  );
}

export default function AudiencePage() {
  const [view, setView] = useState<AudienceView>("followers");
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  const { prefs } = usePrefs();
  const perPage = prefs.pageSize;
  const debounced = useDebounced(search);

  // Searching, switching tabs, or resizing the page must reset to page 1 —
  // otherwise you land on a page that no longer exists.
  useEffect(() => {
    setPage(1);
  }, [debounced, view, perPage]);

  const stats = useFollowerStats();
  const profile = useProfile();
  const q = useAudience(view, { page, per_page: perPage, search: debounced });

  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;
  // isFetching (not isLoading) — with keepPreviousData the old page stays mounted,
  // so this is what tells us a refresh is in flight.
  const busy = q.isFetching;

  const columns: Column<AudienceRow>[] = [
    {
      id: "user",
      header: "User",
      minWidth: 200,
      cell: (row) => <UserCell row={row} />,
    },
    // No status column: the tab already says what these rows are. Repeating
    // "Follower" on all 1,217 rows of the Followers tab is pure noise.
    {
      id: "when",
      header: isEventView(view) ? "Unfollowed" : "First seen",
      width: 190,
      cell: (row) => {
        const iso = isEvent(row) ? row.event_at : row.captured_at;
        return (
          <span className="text-[12.5px] text-ink-3" title={formatDate(iso)}>
            {relativeTime(iso)}
          </span>
        );
      },
    },
    {
      id: "actions",
      header: "",
      width: 150,
      align: "right",
      cell: (row) => (
        <div className="flex items-center justify-end gap-1">
          <Button
            size="sm"
            variant="ghost"
            onClick={(e) => {
              e.stopPropagation();
              setHistoryFor(row.login);
            }}
          >
            History
          </Button>
          <Button size="icon" variant="ghost" asChild className="size-8">
            <a
              href={row.html_url}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Open ${row.login} on GitHub`}
              onClick={(e) => e.stopPropagation()}
            >
              <ExternalLink className="size-3.5" />
            </a>
          </Button>
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeading
        title="Audience"
        description="Everyone who follows you, everyone you follow, and everyone who left."
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-5 py-4">
          <Tabs value={view} onValueChange={(v) => setView(v as AudienceView)}>
            <TabsList>
              <TabsTrigger value="followers" count={stats.data?.total_followers}>
                Followers
              </TabsTrigger>
              <TabsTrigger value="following" count={profile.data?.following}>
                Following
              </TabsTrigger>
              <TabsTrigger value="unfollowed" count={stats.data?.total_unfollowed_events}>
                Lost
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search by username…"
            busy={busy && !!debounced}
            className="w-full sm:w-72"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => String(r.github_id ?? r.login)}
          empty={
            debounced ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title={`No results for “${debounced}”`}
                description="Try a different username."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={
                  view === "unfollowed" ? (
                    <PartyPopper className="size-6" />
                  ) : view === "following" ? (
                    <UserRound className="size-6" />
                  ) : (
                    <Users className="size-6" />
                  )
                }
                title={COPY[view].empty}
                description={COPY[view].emptyHint}
              />
            )
          }
        />

        <Pagination page={page} perPage={perPage} total={total} onPage={setPage} />
      </Panel>

      {q.isError && (
        <Badge tone="negative">
          Could not reach the API — is the backend running?
        </Badge>
      )}

      <HistoryDrawer login={historyFor} onClose={() => setHistoryFor(null)} />
    </div>
  );
}

function isEventView(v: AudienceView) {
  return v === "unfollowed";
}
