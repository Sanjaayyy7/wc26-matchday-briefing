import { describe, it, expect } from "vitest";
import { deriveHeatmap } from "@/lib/derive-heatmap";

describe("deriveHeatmap", () => {
  const result = deriveHeatmap({
    scoreline: { home: 2, away: 0 },
    probabilities: { home: 72, draw: 18, away: 10 },
  });

  it("returns a 6x6 grid", () => {
    expect(result.grid).toHaveLength(6);
    result.grid.forEach((row) => expect(row).toHaveLength(6));
  });

  it("grid sums to ~1.0", () => {
    const sum = result.grid.flat().reduce((a, b) => a + b, 0);
    expect(sum).toBeGreaterThan(0.99);
    expect(sum).toBeLessThan(1.01);
  });

  it("mode is the stated scoreline 2-0", () => {
    expect(result.mode).toEqual({ home: 2, away: 0 });
  });

  it("marginal P(home>away) is within 12 points of stated 72%", () => {
    let hWin = 0;
    for (let h = 0; h < 6; h++)
      for (let a = 0; a < 6; a++)
        if (h > a) hWin += result.grid[h][a];
    expect(hWin * 100).toBeGreaterThan(60);
    expect(hWin * 100).toBeLessThan(84);
  });

  it("lambda values are positive and within sensible range", () => {
    expect(result.lambdaHome).toBeGreaterThan(0);
    expect(result.lambdaHome).toBeLessThan(4.5);
    expect(result.lambdaAway).toBeGreaterThan(0);
    expect(result.lambdaAway).toBeLessThan(4.5);
  });
});
