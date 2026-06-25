import { describe, it, expect } from "vitest";
import {
  fitBaseAndSlope,
  fitRho,
  fitRegimeParams,
  fitStageParams,
  drawRateGap,
  type GoalSample,
  type LikRow,
} from "../lib/regime-params";

// Build goal samples whose per-bin mean follows goals = exp(base + slope*x).
function syntheticSamples(base: number, slope: number, perBin = 400): GoalSample[] {
  const out: GoalSample[] = [];
  for (let x = -1.5; x <= 1.5 + 1e-9; x += 0.125) {
    const mean = Math.exp(base + slope * x);
    for (let i = 0; i < perBin; i++) out.push({ x, goals: mean });
  }
  return out;
}

describe("fitBaseAndSlope", () => {
  it("recovers known base and slope from synthetic samples", () => {
    const { baseLogGoals, eloSlope } = fitBaseAndSlope(syntheticSamples(0.2, 0.8));
    expect(baseLogGoals).toBeCloseTo(0.2, 1);
    expect(eloSlope).toBeCloseTo(0.8, 1);
  });

  it("throws when too few bins are populated", () => {
    expect(() => fitBaseAndSlope([{ x: 0, goals: 1 }], 200)).toThrow();
  });
});

describe("fitRho", () => {
  it("returns a more-negative rho on a draw-heavy sample than a goal-heavy one", () => {
    const drawHeavy: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 1, as: 1 })));
    const goalHeavy: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 2, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 2 })));
    const rhoDraw = fitRho(drawHeavy, Math.log(1.2), 0.8);
    const rhoGoal = fitRho(goalHeavy, Math.log(1.2), 0.8);
    expect(rhoDraw).toBeLessThan(rhoGoal);
  });

  it("stays inside the search grid", () => {
    const rho = fitRho([{ diff: 0, hs: 1, as: 1 }], Math.log(1.3), 0.85);
    expect(rho).toBeGreaterThanOrEqual(-0.2);
    expect(rho).toBeLessThanOrEqual(0.06);
  });
});

describe("fitRegimeParams", () => {
  it("returns all three params with a lower minBinCount for small regimes", () => {
    const p = fitRegimeParams(syntheticSamples(0.1, 0.7, 60), [{ diff: 0, hs: 1, as: 1 }], 50);
    expect(p.baseLogGoals).toBeCloseTo(0.1, 1);
    expect(p.eloSlope).toBeCloseTo(0.7, 1);
    expect(typeof p.rho).toBe("number");
  });
});

describe("fitStageParams", () => {
  it("recovers the intercept while holding the slope fixed", () => {
    const p = fitStageParams(syntheticSamples(0.3, 0.6, 60), [{ diff: 0, hs: 1, as: 1 }], 0.6, 50);
    expect(p.baseLogGoals).toBeCloseTo(0.3, 1);
    expect(p.eloSlope).toBe(0.6);
    expect(typeof p.rho).toBe("number");
  });

  it("returns a lower base and a more-negative rho on a cagey draw-heavy stage than an open one", () => {
    const cageySamples = syntheticSamples(Math.log(0.9), 0.6, 60); // low-scoring
    const openSamples = syntheticSamples(Math.log(1.6), 0.6, 60);  // high-scoring
    const cageyLik: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 1, as: 1 }))); // draws
    const openLik: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 2, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 2 })));  // decisive
    const cagey = fitStageParams(cageySamples, cageyLik, 0.6, 50);
    const open = fitStageParams(openSamples, openLik, 0.6, 50);
    expect(cagey.baseLogGoals).toBeLessThan(open.baseLogGoals);
    expect(cagey.rho).toBeLessThan(open.rho);
  });
});

describe("drawRateGap", () => {
  it("is the absolute gap between mean predicted draw prob and observed draw rate", () => {
    const rows = [
      { pDraw: 0.2, isDraw: true },
      { pDraw: 0.2, isDraw: false },
      { pDraw: 0.2, isDraw: false },
      { pDraw: 0.2, isDraw: false },
    ];
    // mean pred 0.2, observed 0.25 → gap 0.05
    expect(drawRateGap(rows)).toBeCloseTo(0.05, 6);
  });

  it("returns 0 for an empty input", () => {
    expect(drawRateGap([])).toBe(0);
  });
});
