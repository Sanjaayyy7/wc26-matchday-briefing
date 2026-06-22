/**
 * "Forecast Pulse" — the homepage hero visualization. Every settled call is a
 * spike off the chance baseline: low Brier rises (a sharp call), high Brier
 * sinks (a miss). Pure geometry + a data join, so it is unit-testable and
 * renders server-side (no chart lib, no blank first paint).
 */

import fixturesJson from "@/data/fixtures.json";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";

export type PulseVerdict = "hit" | "close" | "miss";

export type PulsePoint = {
  i: number;
  brier: number;
  verdict: PulseVerdict;
  slug: string;
};

/** Brier of the uniform 1/3-1/3-1/3 baseline — the "chance" line. */
export const PULSE_BASELINE = 0.667;
/** Worst Brier we plot before clamping (a 3-way miss tops out near 2). */
export const PULSE_BRIER_MAX = 2;

type FixtureLite = { slug: string; homeId: string; awayId: string; kickoffISO: string };
type EntryLite = { slug: string; modelBrier?: number };
type RowLite = { slug: string; verdict: PulseVerdict };

const fixtures = fixturesJson as FixtureLite[];
const entries = (predictionsJson as { entries: EntryLite[] }).entries;
const rows = (accountabilityJson as { official: { rows: RowLite[] } }).official.rows;

/** Map a Brier score to a y coordinate: 0 (best) → top, MAX (worst) → bottom. */
export function pulseY(brier: number, height: number, pad = 0): number {
  const clamped = Math.max(0, Math.min(PULSE_BRIER_MAX, brier));
  return pad + (clamped / PULSE_BRIER_MAX) * (height - pad * 2);
}

/** Settled calls in chronological order, with Brier + canonical verdict. */
export function buildPulsePoints(): PulsePoint[] {
  const verdictBySlug = new Map(rows.map((r) => [r.slug, r.verdict] as const));
  const kickoffBySlug = new Map(fixtures.map((f) => [f.slug, f.kickoffISO] as const));

  return entries
    .filter((e) => e.modelBrier !== undefined && verdictBySlug.has(e.slug))
    .sort(
      (a, b) =>
        new Date(kickoffBySlug.get(a.slug) ?? 0).getTime() -
        new Date(kickoffBySlug.get(b.slug) ?? 0).getTime(),
    )
    .map((e, i) => ({
      i,
      brier: e.modelBrier!,
      verdict: verdictBySlug.get(e.slug)!,
      slug: e.slug,
    }));
}

/** Build an SVG path string through the points across a w×h box (with padding). */
export function pulsePath(points: PulsePoint[], w: number, h: number, pad = 0): string {
  if (points.length === 0) return "";
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  return points
    .map((p, idx) => {
      const x = pad + idx * step;
      const y = pulseY(p.brier, h, pad);
      return `${idx === 0 ? "M" : "L"} ${x.toFixed(2)},${y.toFixed(2)}`;
    })
    .join(" ");
}
