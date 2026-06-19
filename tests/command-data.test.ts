// tests/command-data.test.ts
import { describe, it, expect } from "vitest";
import { forecastGrade, compressGrid, buildChampionshipProjections } from "../lib/command-data";

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
