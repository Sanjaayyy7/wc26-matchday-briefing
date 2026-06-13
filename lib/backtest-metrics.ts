// Pure metric helpers for the WC26 full-scale backtest (Task C1).
//
// This module does no I/O — it takes arrays of `BacktestPred` records
// (produced by scripts/run-backtest.mts's walk-forward pass) and returns
// metric summaries. Reuses lib/calibration.ts's brier/rps/calibrationBins
// rather than re-deriving them.

import { brier, calibrationBins, type Outcome, type Split, type CalibrationBin } from "./calibration";
import { mulberry32 } from "./rng";

/**
 * One walk-forward prediction record. Probabilities are 0..1 (NOT
 * percentage points — convert with *100 before calling brier/rps).
 */
export type BacktestPred = {
  date: string;
  tournament: string;
  probs: { home: number; draw: number; away: number };
  outcome: Outcome;
  /** Full 9x9 score-probability grid (scoreGrid output), if available. */
  grid?: number[][];
  /** Most likely scoreline per summarizeGrid, if available. */
  mostLikely?: { home: number; away: number };
  /** Actual final score, if available. */
  actualScore?: { h: number; a: number };
  /** P(both teams score), 0..1, if available. */
  btts?: number;
  /** P(total goals > 2.5), 0..1, if available. */
  over25?: number;
  /** Total goals actually scored, if available. */
  totalGoals?: number;
};

function toSplit(probs: BacktestPred["probs"]): Split {
  return { home: probs.home * 100, draw: probs.draw * 100, away: probs.away * 100 };
}

// ---------------------------------------------------------------------------
// brierByConfidenceDecile
// ---------------------------------------------------------------------------

export type ConfidenceDecile = {
  /** 0..9, where decile d covers max-probability range [d/10, (d+1)/10) (9 includes 1.0). */
  decile: number;
  count: number;
  /** Mean Brier score for predictions in this decile. */
  brier: number;
  /** Fraction of predictions in this decile whose top pick was correct. */
  accuracy: number;
};

/**
 * Buckets predictions by the model's confidence in its top pick
 * (max of home/draw/away probability) and reports per-decile Brier + accuracy.
 */
export function brierByConfidenceDecile(preds: BacktestPred[]): ConfidenceDecile[] {
  const buckets: Array<{ sumBrier: number; sumAcc: number; count: number }> = Array.from(
    { length: 10 },
    () => ({ sumBrier: 0, sumAcc: 0, count: 0 }),
  );
  for (const p of preds) {
    const outcomes: Outcome[] = ["home", "draw", "away"];
    let top: Outcome = "home";
    for (const o of outcomes) {
      if (p.probs[o] > p.probs[top]) top = o;
    }
    const confidence = p.probs[top];
    const decile = Math.min(9, Math.floor(confidence * 10));
    const b = buckets[decile];
    b.sumBrier += brier(toSplit(p.probs), p.outcome);
    b.sumAcc += top === p.outcome ? 1 : 0;
    b.count += 1;
  }
  return buckets.map((b, decile) => ({
    decile,
    count: b.count,
    brier: b.count > 0 ? b.sumBrier / b.count : 0,
    accuracy: b.count > 0 ? b.sumAcc / b.count : 0,
  }));
}

// ---------------------------------------------------------------------------
// calibrationCurve
// ---------------------------------------------------------------------------

/**
 * Flattens each prediction into 3 (predicted-probability, hit) pairs — one
 * per outcome, exactly as train-model.mts's backtest loop does — and runs
 * them through lib/calibration.ts's calibrationBins.
 */
export function calibrationCurve(preds: BacktestPred[]): { bins: CalibrationBin[]; ece: number } {
  const pairs: Array<{ p: number; hit: boolean }> = [];
  for (const p of preds) {
    for (const k of ["home", "draw", "away"] as const) {
      pairs.push({ p: p.probs[k], hit: k === p.outcome });
    }
  }
  return calibrationBins(pairs);
}

// ---------------------------------------------------------------------------
// bttsCalibration
// ---------------------------------------------------------------------------

export type BttsCalibration = {
  calibration: { bins: CalibrationBin[]; ece: number };
  /** Accuracy of the binary "BTTS yes if p>=0.5" call. */
  accuracy: number;
  n: number;
};

/**
 * Calibration of the model's BTTS (both teams score) probability against
 * the realized BTTS outcome, plus binary-call accuracy at the 0.5 threshold.
 */
export function bttsCalibration(preds: BacktestPred[]): BttsCalibration {
  const withBtts = preds.filter(
    (p) => p.btts !== undefined && p.actualScore !== undefined,
  );
  const pairs: Array<{ p: number; hit: boolean }> = [];
  let correct = 0;
  for (const p of withBtts) {
    const actualBtts = p.actualScore!.h > 0 && p.actualScore!.a > 0;
    pairs.push({ p: p.btts!, hit: actualBtts });
    const predictedYes = p.btts! >= 0.5;
    if (predictedYes === actualBtts) correct += 1;
  }
  const calibration = calibrationBins(pairs);
  return {
    calibration,
    accuracy: withBtts.length > 0 ? correct / withBtts.length : 0,
    n: withBtts.length,
  };
}

// ---------------------------------------------------------------------------
// scorelineHitRates
// ---------------------------------------------------------------------------

export type ScorelineHitRates = {
  n: number;
  top1: number;
  top3: number;
  top5: number;
};

/**
 * For predictions with both a score grid and an actual final score,
 * computes the fraction where the actual score falls within the model's
 * top-1 / top-3 / top-5 most-probable scorelines.
 */
export function scorelineHitRates(preds: BacktestPred[]): ScorelineHitRates {
  const withGrid = preds.filter((p) => p.grid !== undefined && p.actualScore !== undefined);
  let top1 = 0;
  let top3 = 0;
  let top5 = 0;
  for (const p of withGrid) {
    const cells: Array<{ home: number; away: number; p: number }> = [];
    p.grid!.forEach((row, h) => row.forEach((prob, a) => cells.push({ home: h, away: a, p: prob })));
    cells.sort((a, b) => b.p - a.p);
    const { h, a } = p.actualScore!;
    const rank = cells.findIndex((c) => c.home === h && c.away === a);
    if (rank === -1) continue; // actual score outside the grid (e.g. 9+ goals)
    if (rank < 1) top1 += 1;
    if (rank < 3) top3 += 1;
    if (rank < 5) top5 += 1;
  }
  const n = withGrid.length;
  return {
    n,
    top1: n > 0 ? top1 / n : 0,
    top3: n > 0 ? top3 / n : 0,
    top5: n > 0 ? top5 / n : 0,
  };
}

// ---------------------------------------------------------------------------
// bootstrapCI
// ---------------------------------------------------------------------------

export type BootstrapCI = { mean: number; lo: number; hi: number };

/**
 * 95% bootstrap confidence interval for the mean of `values`, via `n`
 * resamples-with-replacement using a seeded RNG (mulberry32) for
 * reproducibility. lo/hi are the 2.5th/97.5th percentiles of the resampled
 * means.
 */
export function bootstrapCI(values: number[], n = 2000, seed = 42): BootstrapCI {
  const len = values.length;
  const mean = len > 0 ? values.reduce((a, b) => a + b, 0) / len : 0;
  if (len === 0) return { mean: 0, lo: 0, hi: 0 };

  const rng = mulberry32(seed);
  const means: number[] = [];
  for (let i = 0; i < n; i++) {
    let sum = 0;
    for (let j = 0; j < len; j++) {
      const idx = Math.floor(rng() * len);
      sum += values[idx];
    }
    means.push(sum / len);
  }
  means.sort((a, b) => a - b);
  const loIdx = Math.max(0, Math.floor(0.025 * n));
  const hiIdx = Math.min(n - 1, Math.ceil(0.975 * n) - 1);
  return { mean, lo: means[loIdx], hi: means[hiIdx] };
}
