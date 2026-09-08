"use client";

import { dehydrate, hydrate, type QueryClient } from "@tanstack/react-query";

/**
 * Persist the React Query cache to localStorage.
 *
 * Without this, every time the app is opened the cache starts empty, so the first
 * paint is a full screen of skeletons that lasts as long as the slowest request.
 * That is painful against a warm backend and brutal against a cold one — the API
 * runs on Render's free plan, which spins down after ~15 minutes idle and takes
 * ~50s to come back, so "open the app" routinely meant "stare at skeletons".
 *
 * Restoring the last known-good cache turns that into: the app renders immediately
 * with the data you last saw, and each query revalidates in the background and
 * swaps in the fresh value when it lands. Nothing here changes what is *fetched* —
 * only what is on screen while the fetch is in flight.
 *
 * Deliberately hand-rolled rather than pulling in @tanstack/query-persist-client:
 * it is this much code, and it avoids a dependency for one behaviour.
 */

const KEY = "gitpulse:query-cache:v1";

/** Older than this and we throw it away rather than show it. */
const MAX_AGE = 24 * 60 * 60 * 1000;

/**
 * localStorage is a synchronous main-thread API with a ~5MB budget shared by the
 * whole origin. Contribution years carry a week-by-week array each, so the cache
 * can get chunky; past this we skip the write instead of throwing QuotaExceeded
 * (or blocking the main thread for tens of ms on every cache update).
 */
const MAX_BYTES = 2_000_000;

interface Stored {
  savedAt: number;
  state: ReturnType<typeof dehydrate>;
}

export function restoreCache(client: QueryClient): void {
  if (typeof window === "undefined") return;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return;

    const stored = JSON.parse(raw) as Stored;
    if (!stored?.state || Date.now() - stored.savedAt > MAX_AGE) {
      window.localStorage.removeItem(KEY);
      return;
    }

    // hydrate() will not clobber anything already in the cache that is newer, so
    // a request that resolved before this ran keeps its fresher result.
    hydrate(client, stored.state);
  } catch {
    // A corrupt or unreadable entry must never break boot — drop it and move on.
    try {
      window.localStorage.removeItem(KEY);
    } catch {
      /* private mode / storage disabled */
    }
  }
}

export function persistCache(client: QueryClient): () => void {
  if (typeof window === "undefined") return () => {};

  let timer: ReturnType<typeof setTimeout> | undefined;

  const write = () => {
    try {
      const state = dehydrate(client, {
        // Only settled, successful queries are worth restoring. Persisting a
        // pending or errored query would replay a stale failure as if it were
        // this session's.
        shouldDehydrateQuery: (q) => q.state.status === "success",
      });
      const payload = JSON.stringify({ savedAt: Date.now(), state } satisfies Stored);
      if (payload.length > MAX_BYTES) return;
      window.localStorage.setItem(KEY, payload);
    } catch {
      /* quota exceeded or storage disabled — the cache is an optimisation only */
    }
  };

  // The cache emits on every observer add/remove and every fetch transition, so
  // writing synchronously would serialise the whole cache dozens of times per page.
  const unsubscribe = client.getQueryCache().subscribe(() => {
    clearTimeout(timer);
    timer = setTimeout(write, 1000);
  });

  // A debounced write loses the last second of updates if the tab is closed
  // mid-timer; this is the flush that makes "navigate away immediately" work.
  const flush = () => {
    clearTimeout(timer);
    write();
  };
  window.addEventListener("pagehide", flush);

  return () => {
    clearTimeout(timer);
    unsubscribe();
    window.removeEventListener("pagehide", flush);
  };
}

/** Wipe the persisted copy — used when the user asks for a genuinely fresh load. */
export function clearPersistedCache(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* nothing to do */
  }
}
