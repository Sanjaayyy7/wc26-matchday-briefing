/** Inline Brier reading-aid geometry (design-transformation spec §5.1). */
export function brierBar(brier: number): { widthPct: number; colorVar: string } {
  const widthPct = Math.min(brier * 100, 100);
  const colorVar =
    brier < 0.5 ? "var(--up)" : brier <= 0.75 ? "var(--warn)" : "var(--down)";
  return { widthPct, colorVar };
}

/** Position of the uniform 1/3-1/3-1/3 baseline (Brier 0.667) on the bar.
 *  Left of this tick beats chance; right of it is worse than guessing. */
export const BRIER_BASELINE_PCT = 66.7;
