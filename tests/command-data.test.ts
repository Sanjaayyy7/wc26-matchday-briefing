// tests/command-data.test.ts
import { describe, it, expect } from "vitest";
import { forecastGrade, compressGrid, buildChampionshipProjections, parseSettledScoreline, buildReliabilityTicks } from "../lib/command-data";

describe("parseSettledScoreline", () => {
  it("parses a normal scoreline to row/col", () => {
    expect(parseSettledScoreline("4-1")).toEqual({ home: 4, away: 1 });
  });
  it("clamps home goals >= 6 into the 5+ bucket", () => {
    expect(parseSettledScoreline("6-2")).toEqual({ home: 5, away: 2 });
  });
  it("clamps away goals >= 6 into the 5+ bucket", () => {
    expect(parseSettledScoreline("2-7")).toEqual({ home: 2, away: 5 });
  });
  it("returns undefined for missing input", () => {
    expect(parseSettledScoreline(undefined)).toBeUndefined();
  });
  it("returns undefined for malformed input", () => {
    expect(parseSettledScoreline("abc")).toBeUndefined();
  });
});

describe("buildReliabilityTicks", () => {
  const base = (over: Record<string, unknown>) => ({
    slug: "a-vs-b", lockedAt: "2026-06-10T00:00:00Z", split: { home: 40, draw: 30, away: 30 },
    ...over,
  });

  it("includes only settled entries, sorted by lockedAt ascending", () => {
    const ticks = buildReliabilityTicks([
      base({ lockedAt: "2026-06-12T00:00:00Z", result: "1-0", correctPick: true, modelBrier: 0.2, scorelineHit: true }),
      base({ lockedAt: "2026-06-10T00:00:00Z", result: "2-1", correctPick: false, modelBrier: 0.8, scorelineHit: false }),
      base({ result: undefined }),
    ] as never);
    expect(ticks.map((t) => t.lockedAt)).toEqual(["2026-06-10T00:00:00Z", "2026-06-12T00:00:00Z"]);
  });

  it("maps outcome categories", () => {
    const ticks = buildReliabilityTicks([
      base({ result: "1-0", correctPick: true, modelBrier: 0.2, scorelineHit: true }),
      base({ result: "1-0", correctPick: true, modelBrier: 0.4, scorelineHit: false }),
      base({ result: "0-2", correctPick: false, modelBrier: 0.9, scorelineHit: false }),
    ] as never);
    expect(ticks.map((t) => t.outcome)).toEqual(["hit", "correct", "miss"]);
  });

  it("limits to the last N", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      base({ lockedAt: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, result: "1-0", correctPick: true, modelBrier: 0.3 }));
    expect(buildReliabilityTicks(many as never, 50)).toHaveLength(50);
  });
});

describe("forecastGrade", () => {
  it("returns 'sharp' for Brier < 0.35", () => {
    expect(forecastGrade(0.34)).toBe("sharp");
    expect(forecastGrade(0)).toBe("sharp");
  });
  it("returns 'solid' for 0.35 ≤ Brier < 0.55", () => {
    expect(forecastGrade(0.35)).toBe("solid");
    expect(forecastGrade(0.54)).toBe("solid");
  });
  it("returns 'close' for 0.55 ≤ Brier < 0.75", () => {
    expect(forecastGrade(0.55)).toBe("close");
    expect(forecastGrade(0.74)).toBe("close");
  });
  it("returns 'miss' for 0.75 ≤ Brier < 0.90", () => {
    expect(forecastGrade(0.75)).toBe("miss");
    expect(forecastGrade(0.89)).toBe("miss");
  });
  it("returns 'surprise' for Brier ≥ 0.90", () => {
    expect(forecastGrade(0.90)).toBe("surprise");
    expect(forecastGrade(0.941)).toBe("surprise");
    expect(forecastGrade(1)).toBe("surprise");
  });
});

describe("compressGrid", () => {
  it("compresses 9×9 grid to 6×6 by collapsing rows/cols 5+ together", () => {
    const grid9: number[][] = Array.from({ length: 9 }, (_, i) =>
      Array.from({ length: 9 }, (_, j) => (i + 1) * (j + 1) / 100)
    );
    const grid6 = compressGrid(grid9);
    expect(grid6).toHaveLength(6);
    expect(grid6[0]).toHaveLength(6);
    expect(grid6[0][0]).toBeCloseTo(grid9[0][0]);
    let expected = 0;
    for (let r = 5; r < 9; r++) for (let c = 5; c < 9; c++) expected += grid9[r][c];
    expect(grid6[5][5]).toBeCloseTo(expected);
  });
});

describe("buildChampionshipProjections", () => {
  it("returns top 8 teams sorted by champion probability descending", () => {
    const teams = {
      Brazil: { champion: 0.18, reachFinal: 0.38 },
      France: { champion: 0.14, reachFinal: 0.30 },
      England: { champion: 0.12, reachFinal: 0.25 },
      Germany: { champion: 0.09, reachFinal: 0.20 },
      Argentina: { champion: 0.11, reachFinal: 0.22 },
      Spain: { champion: 0.08, reachFinal: 0.18 },
      Portugal: { champion: 0.07, reachFinal: 0.15 },
      Mexico: { champion: 0.05, reachFinal: 0.10 },
      Australia: { champion: 0.02, reachFinal: 0.04 },
    } as Record<string, { champion: number; reachFinal: number }>;
    const result = buildChampionshipProjections(teams, 8);
    expect(result).toHaveLength(8);
    expect(result[0].team).toBe("Brazil");
    expect(result[0].probability).toBeCloseTo(0.18);
    expect(result[7].team).toBe("Mexico");
  });

  it("attaches delta when previous projection provided", () => {
    const current = { Brazil: { champion: 0.182, reachFinal: 0.38 } } as Record<string, { champion: number; reachFinal: number }>;
    const previous = { Brazil: { champion: 0.168, reachFinal: 0.36 } } as Record<string, { champion: number; reachFinal: number }>;
    const result = buildChampionshipProjections(current, 1, previous);
    expect(result[0].delta).toBeCloseTo(0.014, 2);
  });
});
