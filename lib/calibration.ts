export type Outcome = "home" | "draw" | "away";
export type Split = Record<Outcome, number>;
/** Probabilities in the range 0..1 (not percentage points). */
export type Prob = Record<Outcome, number>;

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

/**
 * Ranked probability score for the ordered outcome (home > draw > away):
 * mean squared difference of cumulative forecast vs cumulative observation.
 * Lower is better; uniform forecast ≈ 0.278 — the coin-flip reference.
 */
export function rps(model: Split, realized: Outcome): number {
  const forecast = [model.home / 100, model.draw / 100, model.away / 100];
  const observed = [
    realized === "home" ? 1 : 0,
    realized === "draw" ? 1 : 0,
    realized === "away" ? 1 : 0,
  ];
  let cumF = 0;
  let cumO = 0;
  let score = 0;
  for (let i = 0; i < 2; i++) {
    cumF += forecast[i];
    cumO += observed[i];
    score += (cumF - cumO) ** 2;
  }
  return score / 2;
}

export type CalibrationBin = {
  lo: number;
  hi: number;
  count: number;
  meanPredicted: number;
  realized: number;
};

/**
 * 10-bin reliability table + expected calibration error for binary
 * (probability, hit) prediction pairs.
 */
export function calibrationBins(
  preds: Array<{ p: number; hit: boolean }>,
): { bins: CalibrationBin[]; ece: number } {
  const bins: CalibrationBin[] = Array.from({ length: 10 }, (_, i) => ({
    lo: i / 10,
    hi: (i + 1) / 10,
    count: 0,
    meanPredicted: 0,
    realized: 0,
  }));
  for (const { p, hit } of preds) {
    const b = bins[Math.min(9, Math.floor(p * 10))];
    b.count += 1;
    b.meanPredicted += p;
    b.realized += hit ? 1 : 0;
  }
  let ece = 0;
  for (const b of bins) {
    if (b.count === 0) continue;
    b.meanPredicted /= b.count;
    b.realized /= b.count;
    ece += (b.count / preds.length) * Math.abs(b.meanPredicted - b.realized);
  }
  return { bins, ece };
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
