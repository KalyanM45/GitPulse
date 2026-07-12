"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

/**
 * Local preferences. There is no settings API — these are this browser's
 * choices, stored in localStorage. Every one of them is wired to something
 * real; none are decorative.
 */
export interface Prefs {
  /** Force-disable animation regardless of the OS setting. */
  reduceMotion: boolean;
  /** Rows per page in the audience and repository tables. */
  pageSize: 10 | 20 | 50;
  /** Show exact figures instead of 1.2k-style abbreviations. */
  exactNumbers: boolean;
}

const DEFAULTS: Prefs = {
  reduceMotion: false,
  pageSize: 20,
  // Exact by default: "1,217" is the number people actually want to read.
  // The 1.2k abbreviation is opt-in.
  exactNumbers: true,
};

const KEY = "gitpulse:prefs";

interface Ctx {
  prefs: Prefs;
  setPref: <K extends keyof Prefs>(key: K, value: Prefs[K]) => void;
  reset: () => void;
}

const PrefsContext = createContext<Ctx | null>(null);

export function PrefsProvider({ children }: { children: ReactNode }) {
  // Start from defaults so server and first client render agree — then hydrate
  // from localStorage in an effect. Reading storage during render would mismatch.
  const [prefs, setPrefs] = useState<Prefs>(DEFAULTS);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(KEY);
      if (raw) setPrefs({ ...DEFAULTS, ...JSON.parse(raw) });
    } catch {
      /* corrupt or unavailable storage — defaults are fine */
    }
  }, []);

  // The motion pref has to reach CSS, so stamp it on <html>.
  useEffect(() => {
    document.documentElement.dataset.motion = prefs.reduceMotion ? "off" : "on";
  }, [prefs.reduceMotion]);

  const setPref = useCallback<Ctx["setPref"]>((key, value) => {
    setPrefs((p) => {
      const next = { ...p, [key]: value };
      try {
        localStorage.setItem(KEY, JSON.stringify(next));
      } catch {
        /* private mode — the pref still applies for this session */
      }
      return next;
    });
  }, []);

  const reset = useCallback(() => {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
    setPrefs(DEFAULTS);
  }, []);

  const value = useMemo(() => ({ prefs, setPref, reset }), [prefs, setPref, reset]);

  return <PrefsContext.Provider value={value}>{children}</PrefsContext.Provider>;
}

export function usePrefs() {
  const ctx = useContext(PrefsContext);
  if (!ctx) throw new Error("usePrefs must be used inside PrefsProvider");
  return ctx;
}
