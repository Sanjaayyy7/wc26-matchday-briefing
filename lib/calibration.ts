export type Outcome = "home" | "draw" | "away";
export type Split = Record<Outcome, number>;

/** Normalize raw 3-way market prices (mid, 0..1 each) into a 100% book. */
export function deVig(raw: Split): Split {
  const total = raw.home + raw.draw + raw.away;
  if (total <= 0) throw new Error("degenerate book: prices sum to zero");
  return { home: raw.home / total, draw: raw.draw / total, away: raw.away / total };
}

/**
 * Compare a model split (percentage points, ~100 total) against de-vigged
 * market probabilities (0..1). Returns deviations in percentage points.
 */
export function splitDeviation(
  model: Split,
  market: Split,
): Split & { max: number } {
  const home = Math.abs(model.home - market.home * 100);
  const draw = Math.abs(model.draw - market.draw * 100);
  const away = Math.abs(model.away - market.away * 100);
  return { home, draw, away, max: Math.max(home, draw, away) };
}

/** Multiclass Brier score for a percentage-point split vs the realized outcome. */
export function brier(model: Split, realized: Outcome): number {
  const outcomes: Outcome[] = ["home", "draw", "away"];
  return outcomes.reduce((acc, o) => {
    const p = model[o] / 100;
    const y = o === realized ? 1 : 0;
    return acc + (p - y) ** 2;
  }, 0);
}
