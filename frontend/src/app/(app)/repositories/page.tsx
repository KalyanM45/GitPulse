"use client";

import { BookMarked, ExternalLink, SearchX, Sparkles, Star } from "lucide-react";
import { useEffect, useState } from "react";
import { RepoDrawer } from "@/components/repos/repo-drawer";
import { Panel } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Column, DataTable, Pagination, SortHeader } from "@/components/ui/data-table";
import { Tabs, TabsList, TabsTrigger, Tooltip } from "@/components/ui/overlays";
import { Badge, EmptyState, PageHeading, SearchInput } from "@/components/ui/primitives";
import type { RepoSort, SortOrder, Visibility } from "@/lib/api";
import { comma, formatDate, languageColor, relativeTime } from "@/lib/format";
import type { Repo } from "@/lib/types";
import { useDebounced, useReposOverview, useRepos } from "@/lib/hooks";
import { usePrefs } from "@/lib/prefs";

export default function RepositoriesPage() {
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Repo | null>(null);

  const [sort, setSort] = useState<RepoSort>("stars");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [visibility, setVisibility] = useState<Visibility>("all");

  const { prefs } = usePrefs();
  const perPage = prefs.pageSize;
  const debounced = useDebounced(search);

  // Any change to the result set must return to page 1 — otherwise you can be
  // stranded on page 4 of a list that now has two pages.
  useEffect(() => setPage(1), [debounced, perPage, sort, order, visibility]);

  const q = useRepos({
    page,
    per_page: perPage,
    search: debounced,
    sort,
    order,
    visibility,
  });

  // Counts for the scope tabs come from the overview, not the paged list, so they
  // show the full totals rather than what happens to be on this page.
  const overview = useReposOverview();

  const onSort = (field: RepoSort, next: SortOrder) => {
    setSort(field);
    setOrder(next);
  };
  const rows = q.data?.data ?? [];
  const total = q.data?.total ?? 0;

  const columns: Column<Repo>[] = [
    {
      id: "name",
      header: (
        <SortHeader
          label="Repository"
          field="name"
          active={sort}
          order={order}
          onSort={onSort}
        />
      ),
      minWidth: 220,
      cell: (r) => (
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate text-[13.5px] font-medium text-ink">{r.name}</span>
            {r.is_private && <Badge tone="warning">Private</Badge>}
            {r.is_fork && <Badge tone="neutral">Fork</Badge>}
            {r.is_archived && <Badge tone="neutral">Archived</Badge>}
          </div>
          {r.description && (
            <p className="mt-0.5 truncate text-[12px] text-ink-3">{r.description}</p>
          )}
        </div>
      ),
    },
    {
      id: "analysis",
      header: "Analysis report",
      width: 130,
      cell: (r) => (
        <Tooltip content="AI repository analysis — shipping in the next update">
          {/* Deliberately inert: present in the UI so the column exists, but it
              does nothing yet. aria-disabled + disabled keeps it out of the tab
              order and announces it correctly rather than faking a live control. */}
          <span className="inline-flex">
            <Button
              size="sm"
              variant="ghost"
              disabled
              aria-disabled
              aria-label={`Analysis report for ${r.name} — coming soon`}
              onClick={(e) => e.stopPropagation()}
              className="gap-1.5 text-ink-3"
            >
              <Sparkles className="size-3.5" />
              Analyse
            </Button>
          </span>
        </Tooltip>
      ),
    },
    {
      id: "language",
      header: "Language",
      width: 140,
      cell: (r) =>
        r.language ? (
          <span className="flex items-center gap-2 text-[12.5px] text-ink-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: languageColor(r.language) }}
              aria-hidden
            />
            <span className="truncate">{r.language}</span>
          </span>
        ) : (
          <span className="text-[12.5px] text-ink-3">—</span>
        ),
    },
    {
      id: "stars",
      header: (
        <SortHeader
          label="Stars"
          field="stars"
          active={sort}
          order={order}
          onSort={onSort}
          align="right"
        />
      ),
      width: 110,
      align: "right",
      cell: (r) => (
        <span className="tnum inline-flex items-center gap-1.5 text-[12.5px] text-ink-2">
          <Star className="size-3 text-ink-3" />
          {comma(r.stars)}
        </span>
      ),
    },
    {
      id: "views",
      header: "Views",
      width: 100,
      align: "right",
      cell: (r) => (
        <span className="tnum text-[12.5px] text-ink-2">{comma(r.traffic_views_total)}</span>
      ),
    },
    {
      id: "updated",
      header: (
        <SortHeader
          label="Last commit"
          field="pushed_at"
          active={sort}
          order={order}
          onSort={onSort}
          align="right"
        />
      ),
      width: 150,
      align: "right",
      // pushed_at, not updated_at: updated_at moves whenever any metadata changes
      // (a description edit, someone starring it), which is not "last updated"
      // in the sense anyone reading this column means.
      cell: (r) => (
        <Tooltip content={formatDate(r.pushed_at)}>
          <span className="cursor-default text-[12.5px] text-ink-3">
            {relativeTime(r.pushed_at)}
          </span>
        </Tooltip>
      ),
    },
    {
      id: "link",
      header: "",
      width: 56,
      align: "right",
      cell: (r) => (
        <Button size="icon" variant="ghost" asChild className="size-8">
          <a
            href={r.html_url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Open ${r.name} on GitHub`}
            onClick={(e) => e.stopPropagation()}
          >
            <ExternalLink className="size-3.5" />
          </a>
        </Button>
      ),
    },
  ];

  return (
    <div className="space-y-8">
      <PageHeading
        title="Repositories"
        description="Traffic, stars and clones for everything you own. Select a row for detail."
      />

      <Panel className="overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-4 border-b border-hairline px-5 py-4">
          {/* Scope narrows what is searched and counted — it's applied server-side,
              so the totals and pagination reflect the scope, not just the page. */}
          <Tabs value={visibility} onValueChange={(v) => setVisibility(v as Visibility)}>
            <TabsList>
              <TabsTrigger value="all" count={overview.data?.total_repos}>
                All
              </TabsTrigger>
              <TabsTrigger value="public" count={overview.data?.public_repos}>
                Public
              </TabsTrigger>
              <TabsTrigger value="private" count={overview.data?.private_repos}>
                Private
              </TabsTrigger>
            </TabsList>
          </Tabs>

          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Search repositories…"
            busy={q.isFetching && !!debounced}
            className="w-full sm:w-72"
          />
        </div>

        <DataTable
          columns={columns}
          rows={rows}
          loading={q.isLoading}
          rowKey={(r) => r.name}
          onRowClick={setSelected}
          empty={
            debounced ? (
              <EmptyState
                icon={<SearchX className="size-6" />}
                title={`No results for “${debounced}”`}
                description="Try a different repository name."
                action={
                  <Button variant="secondary" size="sm" onClick={() => setSearch("")}>
                    Clear search
                  </Button>
                }
              />
            ) : (
              <EmptyState
                icon={<BookMarked className="size-6" />}
                title="No repositories synced"
                description="Run a sync to pull your repositories from GitHub."
              />
            )
          }
        />

        <Pagination page={page} perPage={perPage} total={total} onPage={setPage} />
      </Panel>

      <RepoDrawer repo={selected} onClose={() => setSelected(null)} />
    </div>
  );
}
