/**
 * "Forecast Pulse" — the homepage hero visualization. Every settled call is a
 * spike off the chance baseline: low Brier rises (a sharp call), high Brier
 * sinks (a miss). Pure geometry + a data join, so it is unit-testable and
 * renders server-side (no chart lib, no blank first paint).
 */

import fixturesJson from "@/data/fixtures.json";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";

export type PulseVerdict = "nailed" | "hit" | "close" | "miss";

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

/**
 * Build a smooth SVG path through the points across a w×h box (with padding),
 * using a Catmull-Rom → cubic-Bézier conversion so the trace reads as a clean,
 * premium curve rather than a jagged polyline.
 */
export function pulsePath(points: PulsePoint[], w: number, h: number, pad = 0): string {
  if (points.length === 0) return "";
  const step = points.length > 1 ? (w - pad * 2) / (points.length - 1) : 0;
  const pts = points.map((p, idx) => ({
    x: pad + idx * step,
    y: pulseY(p.brier, h, pad),
  }));
  if (pts.length === 1) return `M ${pts[0].x.toFixed(2)},${pts[0].y.toFixed(2)}`;

  const f = (n: number) => n.toFixed(2);
  let d = `M ${f(pts[0].x)},${f(pts[0].y)}`;
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i - 1] ?? pts[i];
    const p1 = pts[i];
    const p2 = pts[i + 1];
    const p3 = pts[i + 2] ?? p2;
    const cp1x = p1.x + (p2.x - p0.x) / 6;
    const cp1y = p1.y + (p2.y - p0.y) / 6;
    const cp2x = p2.x - (p3.x - p1.x) / 6;
    const cp2y = p2.y - (p3.y - p1.y) / 6;
    d += ` C ${f(cp1x)},${f(cp1y)} ${f(cp2x)},${f(cp2y)} ${f(p2.x)},${f(p2.y)}`;
  }
  return d;
}
