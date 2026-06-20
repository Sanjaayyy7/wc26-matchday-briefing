/** Inline Brier reading-aid geometry (design-transformation spec §5.1). */
export function brierBar(brier: number): { widthPct: number; colorVar: string } {
  const widthPct = Math.min(brier * 100, 100);
  const colorVar =
    brier < 0.5 ? "var(--up)" : brier <= 0.75 ? "var(--warn)" : "var(--down)";
  return { widthPct, colorVar };
}
