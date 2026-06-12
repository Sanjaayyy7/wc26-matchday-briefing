import { describe, it, expect } from "vitest";
import {
  deVig,
  splitDeviation,
  brier,
  rps,
  calibrationBins,
} from "@/lib/calibration";

describe("deVig", () => {
  it("normalizes raw 3-way mid prices to a 100% book", () => {
    // Raw mids with overround: 0.59 + 0.25 + 0.21 = 1.05
    const probs = deVig({ home: 0.59, draw: 0.25, away: 0.21 });
    const sum = probs.home + probs.draw + probs.away;
    expect(sum).toBeCloseTo(1, 10);
    expect(probs.home).toBeCloseTo(0.59 / 1.05, 10);
  });

  it("throws on a degenerate zero book", () => {
    expect(() => deVig({ home: 0, draw: 0, away: 0 })).toThrow();
  });
});

describe("splitDeviation", () => {
  it("returns per-outcome and max absolute deviation in percentage points", () => {
    const d = splitDeviation(
      { home: 54, draw: 26, away: 20 },
      { home: 0.56, draw: 0.25, away: 0.19 },
    );
    expect(d.home).toBeCloseTo(2, 5);
    expect(d.draw).toBeCloseTo(1, 5);
    expect(d.away).toBeCloseTo(1, 5);
    expect(d.max).toBeCloseTo(2, 5);
  });
});

describe("rps (ranked probability score, ordered home>draw>away)", () => {
  it("perfect certainty on the realized outcome scores 0", () => {
    expect(rps({ home: 100, draw: 0, away: 0 }, "home")).toBeCloseTo(0, 10);
  });
  it("uniform split vs home win: hand-computed 0.5*((1/3-1)^2+(2/3-1)^2)", () => {
    const u = { home: 100 / 3, draw: 100 / 3, away: 100 / 3 };
    const expected = 0.5 * ((1 / 3 - 1) ** 2 + (2 / 3 - 1) ** 2);
    expect(rps(u, "home")).toBeCloseTo(expected, 6); // ≈ 0.2778 — the coin-flip reference
  });
  it("punishes away-confident forecast more for a home win than a draw-confident one (ordering sensitivity)", () => {
    const awayHeavy = { home: 10, draw: 20, away: 70 };
    const drawHeavy = { home: 10, draw: 70, away: 20 };
    expect(rps(awayHeavy, "home")).toBeGreaterThan(rps(drawHeavy, "home"));
  });
});

describe("calibrationBins", () => {
  it("computes per-bin predicted vs realized frequency and ECE", () => {
    // 4 predictions at 80% that hit 3/4 times, 4 at 20% that hit 1/4 times.
    const preds = [
      ...Array.from({ length: 4 }, (_, i) => ({ p: 0.8, hit: i < 3 })),
      ...Array.from({ length: 4 }, (_, i) => ({ p: 0.2, hit: i < 1 })),
    ];
    const { bins, ece } = calibrationBins(preds);
    const hot = bins.find((b) => b.count === 4 && b.meanPredicted > 0.5)!;
    expect(hot.realized).toBeCloseTo(0.75, 10);
    // ECE = weighted |pred-real| = 0.5*|0.8-0.75| + 0.5*|0.2-0.25| = 0.05
    expect(ece).toBeCloseTo(0.05, 10);
  });
});

describe("brier", () => {
  it("scores a 3-way probability split against the realized outcome", () => {
    // Perfect certainty on the realized outcome scores 0.
    expect(brier({ home: 100, draw: 0, away: 0 }, "home")).toBeCloseTo(0, 10);
    // Uniform split scores (1-1/3)^2 + 2*(1/3)^2 = 2/3.
    expect(
      brier({ home: 100 / 3, draw: 100 / 3, away: 100 / 3 }, "draw"),
    ).toBeCloseTo(2 / 3, 5);
  });
});
