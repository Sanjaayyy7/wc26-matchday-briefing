import { describe, it, expect } from "vitest";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  topKScorelines,
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

describe("topKScorelines", () => {
  // Tiny hand-computable 3×3 grid (rows=home goals, cols=away goals).
  // Values deliberately non-uniform so topK order is unambiguous.
  // Grid: home=0,away=0 → 0.4; home=1,away=0 → 0.3; home=2,away=1 → 0.2; home=0,away=1 → 0.1
  // All others 0.  Total = 1.0 (normalized).
  const testGrid: number[][] = [
    [0.4, 0.1, 0],
    [0.3, 0, 0],
    [0, 0.2, 0],
  ];

  it("returns the k most probable cells in descending order", () => {
    const top3 = topKScorelines(testGrid, 3);
    expect(top3).toHaveLength(3);
    expect(top3[0]).toEqual({ home: 0, away: 0, p: 0.4 });
    expect(top3[1]).toEqual({ home: 1, away: 0, p: 0.3 });
    expect(top3[2]).toEqual({ home: 2, away: 1, p: 0.2 });
  });

  it("k=1 returns only the single argmax", () => {
    const top1 = topKScorelines(testGrid, 1);
    expect(top1).toHaveLength(1);
    expect(top1[0]).toEqual({ home: 0, away: 0, p: 0.4 });
  });

  it("k larger than non-zero cells caps at number of non-zero cells", () => {
    const topAll = topKScorelines(testGrid, 20);
    // 4 non-zero cells in testGrid
    expect(topAll.length).toBe(4);
    // All in descending order
    for (let i = 1; i < topAll.length; i++) {
      expect(topAll[i - 1].p).toBeGreaterThanOrEqual(topAll[i].p);
    }
  });

  it("works correctly on a real scoreGrid", () => {
    const realGrid = scoreGrid(1.8, 0.9, DEFAULT_PARAMS.rho);
    const top3 = topKScorelines(realGrid, 3);
    expect(top3).toHaveLength(3);
    expect(top3[0].p).toBeGreaterThanOrEqual(top3[1].p);
    expect(top3[1].p).toBeGreaterThanOrEqual(top3[2].p);
    // The argmax of summarizeGrid should be the #1 scoreline
    const s = summarizeGrid(realGrid);
    expect(top3[0].home).toBe(s.mostLikely.home);
    expect(top3[0].away).toBe(s.mostLikely.away);
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
