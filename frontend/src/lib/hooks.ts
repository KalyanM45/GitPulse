"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { api, type ListArgs, type RepoListArgs } from "./api";
import type { FollowerEvent, GitHubUser, Paginated } from "./types";

/** Followers/following return snapshots; unfollowed returns events. */
export type AudienceRow = GitHubUser | FollowerEvent;

export function isEvent(row: AudienceRow): row is FollowerEvent {
  return "event_at" in row;
}

/** Debounce a fast-changing value (search boxes) so we don't hammer the API. */
export function useDebounced<T>(value: T, delay = 280): T {
  const [debounced, setDebounced] = useState(value);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(value), delay);
    return () => clearTimeout(t);
  }, [value, delay]);
  return debounced;
}

export const keys = {
  profile: ["profile"] as const,
  syncStatus: ["sync-status"] as const,
  followerStats: ["follower-stats"] as const,
  reposOverview: ["repos-overview"] as const,
  contributions: ["contributions"] as const,
  contributionYear: (y: number) => ["contributions", y] as const,
  audience: (view: AudienceView, args: ListArgs) => ["audience", view, args] as const,
  repos: (args: RepoListArgs) => ["repos", args] as const,
  history: (login: string) => ["history", login] as const,
  starHistory: (name: string) => ["star-history", name] as const,
};

export type AudienceView = "followers" | "following" | "unfollowed";

export const useProfile = () =>
  useQuery({ queryKey: keys.profile, queryFn: ({ signal }) => api.profile(signal) });

export const useFollowerStats = () =>
  useQuery({
    queryKey: keys.followerStats,
    queryFn: ({ signal }) => api.followerStats(signal),
  });

export const useReposOverview = () =>
  useQuery({
    queryKey: keys.reposOverview,
    queryFn: ({ signal }) => api.reposOverview(signal),
  });

/**
 * Asks for the most recent year's full document alongside the per-year totals.
 *
 * The dashboard needs both, but it cannot know *which* year to request until the
 * summary tells it which years exist — so these were two strictly sequential
 * requests, and on a cold backend the heatmap waited out two full round trips.
 * The summary now carries the year it is about to be asked for, and the result is
 * written into that year's cache entry below.
 */
export const useContributions = () => {
  const qc = useQueryClient();
  return useQuery({
    queryKey: keys.contributions,
    queryFn: async ({ signal }) => {
      const summary = await api.contributions(true, signal);
      if (summary.latest) {
        // Seed the year query so useContributionYear resolves from cache instead
        // of issuing the request we just avoided.
        qc.setQueryData(keys.contributionYear(summary.latest.year), summary.latest);
      }
      return summary;
    },
  });
};

export const useContributionYear = (year: number | undefined) =>
  useQuery({
    queryKey: keys.contributionYear(year ?? 0),
    queryFn: ({ signal }) => api.contributionYear(year!, signal),
    enabled: year !== undefined,
  });

/**
 * `keepPreviousData` is what stops the skeleton from flashing when you page or
 * type — the previous page stays on screen, dimmed, until the next one lands.
 */
export const useAudience = (view: AudienceView, args: ListArgs) =>
  useQuery<Paginated<AudienceRow>>({
    queryKey: keys.audience(view, args),
    queryFn: async ({ signal }): Promise<Paginated<AudienceRow>> => {
      if (view === "followers") return api.followers(args, signal);
      if (view === "following") return api.following(args, signal);
      return api.unfollowed(args, signal);
    },
    placeholderData: keepPreviousData,
  });

export const useRepos = (args: RepoListArgs) =>
  useQuery({
    queryKey: keys.repos(args),
    queryFn: ({ signal }) => api.repos(args, signal),
    placeholderData: keepPreviousData,
  });

export const useFollowerHistory = (login: string | null) =>
  useQuery({
    queryKey: keys.history(login ?? ""),
    queryFn: ({ signal }) => api.followerHistory(login!, signal),
    enabled: !!login,
  });

export const useStarHistory = (name: string | null) =>
  useQuery({
    queryKey: keys.starHistory(name ?? ""),
    queryFn: ({ signal }) => api.starHistory(name!, signal),
    enabled: !!name,
  });

/**
 * The last sync timestamp the browser has acted on.
 *
 * Module scope rather than component state because both the watcher below and the
 * manual Sync button need to agree on it: without that, triggering a sync would
 * refetch everything, then the watcher would notice the new timestamp and refetch
 * everything a second time.
 */
let lastSeenSync: string | null | undefined;

/** Invalidate everything except the watcher's own query, which would loop. */
function invalidateData(qc: ReturnType<typeof useQueryClient>) {
  return qc.invalidateQueries({
    predicate: (q) => q.queryKey[0] !== keys.syncStatus[0],
  });
}

/**
 * Notices a sync that happened somewhere else and refreshes the screen.
 *
 * Syncs run in three places and two of them are nowhere near the browser: the
 * APScheduler job inside the API, and the GitHub Actions cron four times a day.
 * Neither can tell an open tab that its numbers are now out of date, so without
 * this a dashboard left open keeps showing pre-sync data indefinitely.
 *
 * Polling one tiny timestamp is far cheaper than polling the real endpoints, and
 * only while the tab is actually visible — a backgrounded tab refreshes when you
 * return to it via refetchOnWindowFocus instead.
 */
export function useSyncWatcher() {
  const qc = useQueryClient();
  const { data } = useQuery({
    queryKey: keys.syncStatus,
    queryFn: ({ signal }) => api.syncStatus(signal),
    refetchInterval: 2 * 60_000,
    refetchIntervalInBackground: false,
    staleTime: 0,
  });

  const at = data?.last_sync_at;
  useEffect(() => {
    if (at === undefined) return;
    // First reading establishes the baseline — the data on screen was just fetched
    // against this same sync, so there is nothing to refresh.
    if (lastSeenSync === undefined) {
      lastSeenSync = at;
      return;
    }
    if (at !== lastSeenSync) {
      lastSeenSync = at;
      invalidateData(qc);
    }
  }, [at, qc]);
}

/** Full sync. On success, everything on screen is stale — drop it all. */
export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.sync,
    onSuccess: (result) => {
      // Adopt this sync's own timestamp before refetching, so the watcher's next
      // poll sees no change and does not repeat the work.
      lastSeenSync = result.synced_at;
      qc.setQueryData(keys.syncStatus, { last_sync_at: result.synced_at });
      invalidateData(qc);
    },
  });
}
