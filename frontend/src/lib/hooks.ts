"use client";

import {
  keepPreviousData,
  useMutation,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import { useEffect, useState } from "react";
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

export const useContributions = () =>
  useQuery({
    queryKey: keys.contributions,
    queryFn: ({ signal }) => api.contributions(signal),
  });

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

/** Full sync. On success, everything on screen is stale — drop it all. */
export function useSync() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.sync,
    onSuccess: () => qc.invalidateQueries(),
  });
}
