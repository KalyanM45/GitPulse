const IST = "Asia/Kolkata";

/**
 * The API stores UTC (`datetime.now(timezone.utc)`) but MongoDB hands back naive
 * datetimes — pymongo drops the tzinfo — so the JSON carries no `Z` and no offset:
 *
 *     "2026-07-12T06:55:50.067000"
 *
 * `new Date()` reads a bare timestamp like that as LOCAL time, which silently
 * shifts every date by the viewer's UTC offset (5h30m in IST) — a sync from a
 * minute ago renders as "6 hours ago".
 *
 * So: if the string carries no timezone marker, it is UTC. Say so explicitly.
 */
export function parseApiDate(iso: string | null | undefined): Date | null {
  if (!iso) return null;
  const hasZone = /(?:[Zz]|[+-]\d{2}:?\d{2})$/.test(iso);
  const d = new Date(hasZone ? iso : `${iso}Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** 1_234 → "1.2k". Keeps KPI tiles from reflowing on large numbers. */
export function compact(n: number | null | undefined): string {
  if (n == null) return "—";
  if (Math.abs(n) < 1000) return String(n);
  if (Math.abs(n) < 1_000_000) {
    const v = n / 1000;
    return `${v % 1 === 0 ? v : v.toFixed(1)}k`;
  }
  const v = n / 1_000_000;
  return `${v % 1 === 0 ? v : v.toFixed(1)}M`;
}

export function comma(n: number | null | undefined): string {
  return n == null ? "—" : n.toLocaleString("en-US");
}

export function bytes(n: number): string {
  if (n < 1024) return `${n} B`;
  if (n < 1024 ** 2) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 ** 2).toFixed(1)} MB`;
}

export function formatDate(iso: string | null | undefined): string {
  const d = parseApiDate(iso);
  if (!d) return "—";
  return d.toLocaleDateString("en-US", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined): string {
  const d = parseApiDate(iso);
  if (!d) return "—";
  return d.toLocaleString("en-US", {
    timeZone: IST,
    day: "numeric",
    month: "short",
    hour: "numeric",
    minute: "2-digit",
  });
}

export function relativeTime(iso: string | null | undefined): string {
  const d = parseApiDate(iso);
  if (!d) return "—";
  const then = d.getTime();

  const secs = Math.round((then - Date.now()) / 1000);
  const abs = Math.abs(secs);
  const rtf = new Intl.RelativeTimeFormat("en", { numeric: "auto" });

  if (abs < 60) return rtf.format(Math.round(secs), "second");
  if (abs < 3600) return rtf.format(Math.round(secs / 60), "minute");
  if (abs < 86400) return rtf.format(Math.round(secs / 3600), "hour");
  if (abs < 2_592_000) return rtf.format(Math.round(secs / 86400), "day");
  if (abs < 31_536_000) return rtf.format(Math.round(secs / 2_592_000), "month");
  return rtf.format(Math.round(secs / 31_536_000), "year");
}

/** GitHub's own language colours — recognisable at a glance, so don't re-theme them. */
export const LANGUAGE_COLORS: Record<string, string> = {
  TypeScript: "#3178c6",
  JavaScript: "#f1e05a",
  Python: "#3572A5",
  Java: "#b07219",
  "C++": "#f34b7d",
  C: "#555555",
  "C#": "#178600",
  Go: "#00ADD8",
  Rust: "#dea584",
  Ruby: "#701516",
  PHP: "#4F5D95",
  Swift: "#F05138",
  Kotlin: "#A97BFF",
  Dart: "#00B4AB",
  HTML: "#e34c26",
  CSS: "#563d7c",
  SCSS: "#c6538c",
  Shell: "#89e051",
  Vue: "#41b883",
  Svelte: "#ff3e00",
  "Jupyter Notebook": "#DA5B0B",
  Dockerfile: "#384d54",
  Makefile: "#427819",
  R: "#198CE7",
  Lua: "#000080",
  Perl: "#0298c3",
  Scala: "#c22d40",
  Elixir: "#6e4a7e",
  Haskell: "#5e5086",
};

const FALLBACK_HUES = ["#818cf8", "#a78bfa", "#38bdf8", "#34d399", "#fbbf24", "#fb7185"];

export function languageColor(name: string): string {
  if (LANGUAGE_COLORS[name]) return LANGUAGE_COLORS[name];
  // Stable per-name colour so a language doesn't change hue between renders.
  let h = 0;
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) >>> 0;
  return FALLBACK_HUES[h % FALLBACK_HUES.length];
}
