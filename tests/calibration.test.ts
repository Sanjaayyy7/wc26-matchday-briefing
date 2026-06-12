import { describe, it, expect } from "vitest";
import { deVig, splitDeviation, brier } from "@/lib/calibration";

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
