import { describe, it, expect } from "vitest";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  advancementProb,
  DEFAULT_PARAMS,
} from "@/lib/poisson-model";

describe("lambdasFromElo", () => {
  it("equal ratings on neutral ground give equal lambdas near the base rate", () => {
    const { home, away } = lambdasFromElo(1800, 1800, true, DEFAULT_PARAMS);
    expect(home).toBeCloseTo(away, 10);
    expect(home + away).toBeGreaterThan(2);
    expect(home + away).toBeLessThan(3.4);
  });
  it("stronger side gets the larger lambda", () => {
    const { home, away } = lambdasFromElo(2000, 1700, true, DEFAULT_PARAMS);
    expect(home).toBeGreaterThan(away);
  });
  it("home advantage shifts lambdas when not neutral", () => {
    const neutral = lambdasFromElo(1800, 1800, true, DEFAULT_PARAMS);
    const hosted = lambdasFromElo(1800, 1800, false, DEFAULT_PARAMS);
    expect(hosted.home).toBeGreaterThan(neutral.home);
    expect(hosted.away).toBeLessThan(neutral.away);
  });
});

describe("scoreGrid (Dixon-Coles)", () => {
  it("probabilities sum to 1", () => {
    const grid = scoreGrid(1.6, 1.1, DEFAULT_PARAMS.rho);
    const sum = grid.flat().reduce((a, b) => a + b, 0);
    expect(sum).toBeCloseTo(1, 6);
  });
  it("negative rho (the empirical DC fit) inflates the draw share vs independent Poisson", () => {
    const dc = summarizeGrid(scoreGrid(1.3, 1.3, -0.1));
    const indep = summarizeGrid(scoreGrid(1.3, 1.3, 0));
    expect(dc.draw).toBeGreaterThan(indep.draw);
  });
});

describe("summarizeGrid", () => {
  const grid = scoreGrid(1.8, 0.9, DEFAULT_PARAMS.rho);
  const s = summarizeGrid(grid);

  it("H/D/A sums to ~1", () => {
    expect(s.home + s.draw + s.away).toBeCloseTo(1, 6);
  });
  it("favors the higher-lambda side", () => {
    expect(s.home).toBeGreaterThan(s.away);
  });
  it("BTTS consistent with marginals: 1 - P(h=0) - P(a=0) + P(0,0)", () => {
    const pH0 = grid[0].reduce((a, b) => a + b, 0);
    const pA0 = grid.reduce((acc, row) => acc + row[0], 0);
    expect(s.btts).toBeCloseTo(1 - pH0 - pA0 + grid[0][0], 6);
  });
  it("most likely score is the grid argmax", () => {
    let best = { h: 0, a: 0, p: -1 };
    grid.forEach((row, h) =>
      row.forEach((p, a) => {
        if (p > best.p) best = { h, a, p };
      }),
    );
    expect(s.mostLikely).toEqual({ home: best.h, away: best.a });
  });
});

describe("advancementProb", () => {
  it("is bounded by P(win) and P(win)+P(draw)", () => {
    const p = advancementProb(0.5, 0.3, 100);
    expect(p).toBeGreaterThan(0.5);
    expect(p).toBeLessThan(0.8);
  });
  it("equal sides advance ~P(win) + half the draw prob", () => {
    expect(advancementProb(0.35, 0.3, 0)).toBeCloseTo(0.5, 6);
  });
});
