/**
 * Mirrors the FastAPI response shapes exactly. If a field isn't here,
 * the backend doesn't return it — don't invent one.
 */

export interface Paginated<T> {
  data: T[];
  total: number;
  page: number;
  per_page: number;
}

export interface Profile {
  login: string;
  name: string;
  avatar_url: string;
  html_url: string;
  bio: string | null;
  public_repos: number;
  followers: number;
  following: number;
  /** Optional on GitHub — "" when the profile doesn't set it. Skip the row, don't render a blank. */
  company: string;
  location: string;
  blog: string;
  email: string;
  twitter_username: string;
  created_at: string | null;
  public_gists: number;
}

export interface GitHubUser {
  github_id: number | null;
  login: string;
  /** Display name. Empty when the profile has none set — fall back to login. */
  name?: string;
  avatar_url: string;
  html_url: string;
  captured_at: string;
  is_initial?: boolean;
  previous_logins?: string[];
}

export type FollowerEventType = "followed" | "unfollowed";

export interface FollowerEvent {
  github_id: number | null;
  login: string;
  name?: string;
  avatar_url: string;
  html_url: string;
  event_type: FollowerEventType;
  event_at: string;
}

export interface FollowerStats {
  total_followers: number;
  total_followed_events: number;
  total_unfollowed_events: number;
}

export interface Repo {
  name: string;
  full_name: string;
  description: string;
  html_url: string;
  homepage: string;
  is_fork: boolean;
  is_archived: boolean;
  is_private: boolean;
  language: string;
  languages: Record<string, number>;
  topics: string[];
  stars: number;
  forks: number;
  watchers: number;
  open_issues: number;
  size: number;
  created_at: string;
  updated_at: string;
  /** Last commit push. This — not updated_at — is what "last updated" means. */
  pushed_at: string;
  /** Total commits on the default branch — what GitHub shows on the repo page. */
  commits_total: number;
  /** Last 52 weeks only. A finished repo can have hundreds of commits and 0 here. */
  commits_last_year: number;
  branches: number;
  /** GitHub's rolling 14-day window. */
  traffic_views_total: number;
  traffic_views_unique: number;
  traffic_clones_total: number;
  traffic_clones_unique: number;
  /** Accumulated day-by-day in our DB — keeps growing past GitHub's 14 days. */
  views_all_time: number;
  views_uniques_all_time: number;
  clones_all_time: number;
  clones_uniques_all_time: number;
  traffic_days_recorded: number;
  referrers: { referrer: string; count: number; uniques: number }[];
  popular_paths: { path: string; title: string; count: number; uniques: number }[];
  stars_since_last_sync: number;
  synced_at: string;
}

export type RepoSummary = Pick<
  Repo,
  | "name"
  | "stars"
  | "forks"
  | "language"
  | "html_url"
  | "description"
  | "is_private"
  | "watchers"
  | "commits_total"
  | "commits_last_year"
  | "branches"
  | "pushed_at"
  | "traffic_views_total"
  | "traffic_views_unique"
  | "views_all_time"
>;

export interface TrafficDay {
  repo: string;
  date: string;
  views: number;
  views_uniques: number;
  clones: number;
  clones_uniques: number;
}

export interface ReposOverview {
  total_repos: number;
  public_repos: number;
  private_repos: number;
  total_stars: number;
  total_forks: number;
  total_watchers: number;
  total_branches: number;
  total_views: number;
  total_views_unique: number;
  total_clones: number;
  total_clones_unique: number;
  /** All-time commits across every repo. */
  total_commits: number;
  /** Last 52 weeks only. */
  total_commits_year: number;
  /** How many distinct days of traffic we have on record. */
  traffic_days_recorded: number;
  top_languages: { name: string; bytes: number; count: number }[];
  most_starred: RepoSummary[];
  most_viewed: RepoSummary[];
  synced_at: string | null;
}

export interface StarPoint {
  stars: number;
  captured_at: string;
}

export interface ContributionDay {
  contributionCount: number;
  date: string;
  weekday: number;
}

export interface ContributionWeek {
  contributionDays: ContributionDay[];
}

export interface ContributionYear {
  username: string;
  year: number;
  synced_at: string;
  total_contributions: number;
  total_commits: number;
  total_issues: number;
  total_prs: number;
  total_reviews: number;
  restricted: number;
  weeks: ContributionWeek[];
}

export type ContributionYearSummary = Omit<ContributionYear, "weeks" | "restricted" | "username">;

export interface ContributionsSummary {
  years: ContributionYearSummary[];
  total_all_time: number;
  synced_at: string | null;
}

export interface SyncResult {
  synced_at: string;
  total_followers: number;
  new_followers: number;
  lost_followers: number;
  renamed: number;
  total_following: number;
  total_repos: number;
  total_contributions: number;
}
