import { describe, it, expect } from "vitest";
import {
  brierByConfidenceDecile,
  calibrationCurve,
  bttsCalibration,
  scorelineHitRates,
  bootstrapCI,
  type BacktestPred,
} from "@/lib/backtest-metrics";
import { calibrationBins, brier } from "@/lib/calibration";

// ---------------------------------------------------------------------------
// Fixture helpers
// ---------------------------------------------------------------------------

function pred(overrides: Partial<BacktestPred> & Pick<BacktestPred, "probs" | "outcome">): BacktestPred {
  return {
    date: "2024-01-01",
    tournament: "Friendly",
    ...overrides,
  };
}

describe("brierByConfidenceDecile", () => {
  it("buckets predictions by the model's confidence in the top outcome and reports per-decile Brier", () => {
    // Two predictions: one very confident & correct, one low-confidence & wrong.
    const confident: BacktestPred = pred({
      probs: { home: 0.9, draw: 0.06, away: 0.04 },
      outcome: "home",
    });
    const lowConf: BacktestPred = pred({
      probs: { home: 0.34, draw: 0.33, away: 0.33 },
      outcome: "away",
    });
    const result = brierByConfidenceDecile([confident, lowConf]);

    // confident max-prob = 0.9 -> decile 9 (90-100%)
    const hot = result.find((d) => d.count === 1 && d.decile === 9)!;
    expect(hot).toBeDefined();
    const expectedConfidentBrier = brier({ home: 90, draw: 6, away: 4 }, "home");
    expect(hot.brier).toBeCloseTo(expectedConfidentBrier, 10);

    // low-confidence max-prob = 0.34 -> decile 3 (30-40%)
    const cold = result.find((d) => d.count === 1 && d.decile === 3)!;
    expect(cold).toBeDefined();
    const expectedLowConfBrier = brier({ home: 34, draw: 33, away: 33 }, "away");
    expect(cold.brier).toBeCloseTo(expectedLowConfBrier, 10);

    // Deciles are 0..9 and only non-empty ones need count > 0; total count == n
    const totalCount = result.reduce((acc, d) => acc + d.count, 0);
    expect(totalCount).toBe(2);
  });
});

describe("calibrationCurve", () => {
  it("matches calibrationBins for the equivalent flattened (p, hit) pairs", () => {
    // Build 2 predictions; flatten into 6 (p, hit) pairs (one per outcome per pred)
    // exactly as train-model.mts's backtest loop does.
    const preds: BacktestPred[] = [
      pred({ probs: { home: 0.8, draw: 0.15, away: 0.05 }, outcome: "home" }),
      pred({ probs: { home: 0.2, draw: 0.3, away: 0.5 }, outcome: "away" }),
    ];

    const flattened: Array<{ p: number; hit: boolean }> = [];
    for (const p of preds) {
      for (const k of ["home", "draw", "away"] as const) {
        flattened.push({ p: p.probs[k], hit: k === p.outcome });
      }
    }
    const expected = calibrationBins(flattened);
    const actual = calibrationCurve(preds);

    expect(actual.ece).toBeCloseTo(expected.ece, 10);
    expect(actual.bins.length).toBe(expected.bins.length);
    for (let i = 0; i < expected.bins.length; i++) {
      expect(actual.bins[i].count).toBe(expected.bins[i].count);
      expect(actual.bins[i].meanPredicted).toBeCloseTo(expected.bins[i].meanPredicted, 10);
      expect(actual.bins[i].realized).toBeCloseTo(expected.bins[i].realized, 10);
    }
  });
});

describe("bttsCalibration", () => {
  it("reports BTTS predicted-probability calibration and overall accuracy", () => {
    // 4 predictions: 2 with high BTTS prob that hit, 1 with high BTTS prob that misses,
    // 1 with low BTTS prob that correctly doesn't hit.
    const preds: BacktestPred[] = [
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", btts: 0.7, actualScore: { h: 2, a: 1 } }), // btts true
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", btts: 0.7, actualScore: { h: 2, a: 1 } }), // btts true
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", btts: 0.7, actualScore: { h: 2, a: 0 } }), // btts false (miss)
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", btts: 0.2, actualScore: { h: 1, a: 0 } }), // btts false, correct
    ];

    const result = bttsCalibration(preds);

    // accuracy: btts>=0.5 predicts "yes". 3 preds predict yes (p=0.7), 1 predicts no (p=0.2).
    // Of the 3 "yes" predictions, 2 actually had BTTS, 1 didn't -> correct=2.
    // Of the 1 "no" prediction, actual btts=false -> correct=1.
    // Overall accuracy = 3/4 = 0.75
    expect(result.accuracy).toBeCloseTo(0.75, 10);

    // calibration: bin for p=0.7 has count=3, realized = 2/3
    const hotBin = result.calibration.bins.find((b) => b.count === 3)!;
    expect(hotBin).toBeDefined();
    expect(hotBin.realized).toBeCloseTo(2 / 3, 10);
    expect(hotBin.meanPredicted).toBeCloseTo(0.7, 10);

    // bin for p=0.2 has count=1, realized = 0
    const coldBin = result.calibration.bins.find((b) => b.count === 1)!;
    expect(coldBin).toBeDefined();
    expect(coldBin.realized).toBeCloseTo(0, 10);
  });
});

describe("scorelineHitRates", () => {
  it("computes top-1/top-3/top-5 hit rates from each prediction's grid", () => {
    // Hand-built tiny 3x3-equivalent grids (we only care about relative ranking).
    // Pred A: most likely cell is (1,0); actual score (1,0) -> top-1 hit.
    const gridA = [
      [0.10, 0.05, 0.02], // h=0
      [0.30, 0.10, 0.03], // h=1  <- (1,0) is the max = 0.30
      [0.20, 0.15, 0.05], // h=2
    ];
    // Pred B: actual score (2,1) which is the 2nd most likely cell.
    // Cells sorted desc: (2,0)=0.25, (2,1)=0.20, (0,0)=0.15, (1,0)=0.12, (1,1)=0.10, ...
    const gridB = [
      [0.15, 0.05, 0.01],
      [0.12, 0.10, 0.02],
      [0.25, 0.20, 0.00],
    ];
    // Pred C: actual score (0,2), which appears nowhere in the top 5 -> miss everywhere.
    // Top cells of gridC by probability: (0,0)=0.30,(1,0)=0.20,(2,0)=0.15,(0,1)=0.10,(1,1)=0.08,
    // total remaining mass spread thin; (0,2) has very low prob.
    const gridC = [
      [0.30, 0.10, 0.01],
      [0.20, 0.08, 0.01],
      [0.15, 0.05, 0.01],
    ];

    const preds: BacktestPred[] = [
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", grid: gridA, actualScore: { h: 1, a: 0 } }),
      pred({ probs: { home: 0.4, draw: 0.3, away: 0.3 }, outcome: "home", grid: gridB, actualScore: { h: 2, a: 1 } }),
      pred({ probs: { home: 0.5, draw: 0.3, away: 0.2 }, outcome: "home", grid: gridC, actualScore: { h: 0, a: 2 } }),
    ];

    const result = scorelineHitRates(preds);

    // top-1: only A hits (its actual score is the single most-likely cell) -> 1/3
    expect(result.top1).toBeCloseTo(1 / 3, 10);
    // top-3: A (rank1) and B (rank2, within top3) hit; C misses -> 2/3
    expect(result.top3).toBeCloseTo(2 / 3, 10);
    // top-5: A and B still hit; C's actual (0,2)=0.01 is tied for the lowest and
    // not in the top 5 highest-probability cells -> 2/3
    expect(result.top5).toBeCloseTo(2 / 3, 10);
    expect(result.n).toBe(3);
  });
});

describe("bootstrapCI", () => {
  it("is deterministic for a given seed", () => {
    const values = [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7];
    const a = bootstrapCI(values, 500, 42);
    const b = bootstrapCI(values, 500, 42);
    expect(a).toEqual(b);
  });

  it("returns lo == hi == mean for a degenerate all-equal array", () => {
    const values = [0.5, 0.5, 0.5, 0.5, 0.5];
    const { mean, lo, hi } = bootstrapCI(values, 200, 7);
    expect(mean).toBeCloseTo(0.5, 10);
    expect(lo).toBeCloseTo(0.5, 10);
    expect(hi).toBeCloseTo(0.5, 10);
  });

  it("produces a CI band that contains the sample mean for varied data", () => {
    const values = [0, 0, 0, 1, 1, 1, 0.5];
    const { mean, lo, hi } = bootstrapCI(values, 1000, 123);
    expect(mean).toBeCloseTo(values.reduce((a, b) => a + b, 0) / values.length, 10);
    expect(lo).toBeLessThanOrEqual(mean);
    expect(hi).toBeGreaterThanOrEqual(mean);
    expect(lo).toBeLessThanOrEqual(hi);
  });
});
