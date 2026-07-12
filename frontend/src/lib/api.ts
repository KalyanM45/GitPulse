import type {
  ContributionsSummary,
  ContributionYear,
  FollowerEvent,
  FollowerStats,
  GitHubUser,
  Paginated,
  Profile,
  Repo,
  ReposOverview,
  StarPoint,
  SyncResult,
  TrafficDay,
} from "./types";

/**
 * Where the backend lives. Set via NEXT_PUBLIC_API_BASE:
 *
 *   local        frontend/.env.local   -> http://localhost:8000
 *   Vercel       project env var       -> https://<your-service>.onrender.com
 *   docker       compose build arg     -> http://localhost:8000
 *
 * NEXT_PUBLIC_* is inlined at BUILD time, not read at runtime — so this must be
 * set before `next build`, and changing it on Vercel requires a redeploy.
 *
 * Falls back to localhost rather than a hardcoded production URL: a deploy that
 * forgot the env var should fail obviously in development terms, not silently
 * point at someone else's backend.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_BASE ?? "http://localhost:8000";

export const API = `${API_BASE.replace(/\/$/, "")}/api`;

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

async function get<T>(path: string, signal?: AbortSignal): Promise<T> {
  const res = await fetch(`${API}${path}`, { signal });
  if (!res.ok) {
    throw new ApiError(
      res.status === 404 ? "Not found" : `Request failed (${res.status})`,
      res.status,
    );
  }
  return res.json() as Promise<T>;
}

function query(params: Record<string, string | number | undefined>) {
  const q = new URLSearchParams();
  for (const [k, v] of Object.entries(params)) {
    if (v !== undefined && v !== "") q.set(k, String(v));
  }
  const s = q.toString();
  return s ? `?${s}` : "";
}

export interface ListArgs {
  page?: number;
  per_page?: number;
  search?: string;
}

/** Fields the backend will sort repositories on. Anything else falls back to stars. */
export type RepoSort =
  | "name"
  | "stars"
  | "pushed_at"
  | "watchers"
  | "commits_total"
  | "branches"
  | "views_all_time";
export type SortOrder = "asc" | "desc";
export type Visibility = "all" | "public" | "private";

export interface RepoListArgs extends ListArgs {
  sort?: RepoSort;
  order?: SortOrder;
  visibility?: Visibility;
}

export const api = {
  profile: (signal?: AbortSignal) => get<Profile>("/profile", signal),

  followers: ({ page = 1, per_page = 24, search }: ListArgs, signal?: AbortSignal) =>
    get<Paginated<GitHubUser>>(`/followers${query({ page, per_page, search })}`, signal),

  following: ({ page = 1, per_page = 24, search }: ListArgs, signal?: AbortSignal) =>
    get<Paginated<GitHubUser>>(`/following${query({ page, per_page, search })}`, signal),

  unfollowed: ({ page = 1, per_page = 24, search }: ListArgs, signal?: AbortSignal) =>
    get<Paginated<FollowerEvent>>(
      `/followers/unfollowed${query({ page, per_page, search })}`,
      signal,
    ),

  followerStats: (signal?: AbortSignal) => get<FollowerStats>("/followers/stats", signal),

  followerHistory: (login: string, signal?: AbortSignal) =>
    get<FollowerEvent[]>(`/followers/${encodeURIComponent(login)}/history`, signal),

  reposOverview: (signal?: AbortSignal) => get<ReposOverview>("/repos/overview", signal),

  repos: (
    {
      page = 1,
      per_page = 30,
      search,
      sort = "pushed_at",
      order = "desc",
      visibility = "all",
    }: RepoListArgs,
    signal?: AbortSignal,
  ) =>
    get<Paginated<Repo>>(
      `/repos${query({ page, per_page, search, sort, order, visibility })}`,
      signal,
    ),

  repoTraffic: (name: string, signal?: AbortSignal) =>
    get<TrafficDay[]>(`/repos/${encodeURIComponent(name)}/traffic`, signal),

  repo: (name: string, signal?: AbortSignal) =>
    get<Repo>(`/repos/${encodeURIComponent(name)}`, signal),

  starHistory: (name: string, signal?: AbortSignal) =>
    get<StarPoint[]>(`/repos/${encodeURIComponent(name)}/star-history`, signal),

  contributions: (signal?: AbortSignal) => get<ContributionsSummary>("/contributions", signal),

  contributionYear: (year: number, signal?: AbortSignal) =>
    get<ContributionYear>(`/contributions/${year}`, signal),

  sync: async (): Promise<SyncResult> => {
    const res = await fetch(`${API}/sync`, { method: "POST" });
    if (!res.ok) throw new ApiError(`Sync failed (${res.status})`, res.status);
    return res.json() as Promise<SyncResult>;
  },
};
