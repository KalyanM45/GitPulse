/**
 * Chart palettes — every value below was produced by the dataviz validator
 * (OKLCH lightness band · chroma floor · Machado-2009 CVD ΔE · WCAG contrast),
 * not by eye. Surface assumed: #0B0F14. Re-run the validator before changing a hex.
 *
 * Why these aren't just the brand indigo/violet/blue:
 * that set fails hard. #818CF8 vs #A78BFA is ΔE 1.9 under protanopia — the two
 * series are indistinguishable to a red-blind viewer. Indigo is kept as the brand
 * anchor in slot 0 and the remaining hues are spread far enough apart to survive
 * protan/deutan/tritan simulation.
 *
 * Slot order is FIXED. Never cycle it, never reassign by rank — a filter that
 * removes a series must not repaint the survivors.
 */

/** Categorical — contribution types. ALL CHECKS PASS (worst adjacent ΔE 51.0, protan). */
export const SERIES = {
  commits: "#6366F1", // indigo — brand anchor
  reviews: "#0E9F8E", // teal
  issues: "#BC7E26", // amber
  prs: "#D65F9C", // pink
} as const;

/**
 * Sequential — contribution heatmap. One hue, monotone lightness.
 * Index 0 is "no contributions" and is intentionally surface-toned, not part of
 * the ramp. Steps 1–4 all clear 2:1 against the surface, so the dimmest active
 * day is actually visible (the naive alpha ramp bottomed out at 1.36:1).
 */
export const HEAT = [
  "rgba(255,255,255,0.04)",
  "#3D4489",
  "#5058B8",
  "#6A72E2",
  "#A5AEFC",
] as const;

/**
 * Sequential — language donut. Slices are ordered by magnitude, so share-of-code
 * is a magnitude job, not an identity job: one hue, light→dark, rather than eight
 * competing hues that no CVD check would survive. Identity is carried by the
 * direct labels and the legend, never by colour alone.
 */
export const RAMP_6 = [
  "#C3C9FE",
  "#A5AEFC",
  "#8B95F7",
  "#6A72E2",
  "#5058B8",
  "#3D4489",
] as const;

/** Single-series accent (star history). One series ⇒ no legend; the title names it. */
export const ACCENT = "#818CF8";

/** Recessive chrome — grid and axes must never compete with the data. */
export const CHART_INK = {
  grid: "rgba(255,255,255,0.06)",
  axis: "#8b96a8",
} as const;
