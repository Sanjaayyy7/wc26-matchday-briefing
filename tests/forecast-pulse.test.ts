import { describe, it, expect } from "vitest";
import {
  buildPulsePoints,
  pulseY,
  pulsePath,
  PULSE_BASELINE,
  PULSE_BRIER_MAX,
} from "@/lib/forecast-pulse";

describe("pulseY", () => {
  it("maps a perfect Brier (0) to the top of the plot", () => {
    expect(pulseY(0, 360, 20)).toBeCloseTo(20, 5);
  });

  it("maps the worst Brier to the bottom of the plot", () => {
    expect(pulseY(PULSE_BRIER_MAX, 360, 20)).toBeCloseTo(340, 5);
  });

  it("is monotonic: worse Brier sinks lower", () => {
    expect(pulseY(0.2, 360, 20)).toBeLessThan(pulseY(1.2, 360, 20));
  });

  it("places the chance baseline above the worst-case floor", () => {
    expect(pulseY(PULSE_BASELINE, 360, 20)).toBeLessThan(pulseY(PULSE_BRIER_MAX, 360, 20));
  });

  it("clamps Briers beyond the max", () => {
    expect(pulseY(5, 360, 20)).toBeCloseTo(pulseY(PULSE_BRIER_MAX, 360, 20), 5);
  });
});

describe("buildPulsePoints", () => {
  const points = buildPulsePoints();

  it("returns every settled call", () => {
    expect(points.length).toBe(75);
  });

  it("uses only known verdicts and finite Briers", () => {
    const allowed = new Set(["nailed", "hit", "close", "miss"]);
    for (const p of points) {
      expect(allowed.has(p.verdict)).toBe(true);
      expect(Number.isFinite(p.brier)).toBe(true);
    }
  });

  it("is ordered chronologically by index", () => {
    points.forEach((p, i) => expect(p.i).toBe(i));
  });

  it("labels each call with a short matchup", () => {
    for (const p of points) expect(p.label).toMatch(/.+–.+/);
  });
});

describe("pulsePath", () => {
  it("starts with a move command and draws a smooth curve", () => {
    const path = pulsePath(buildPulsePoints(), 680, 360, 24);
    expect(path.startsWith("M ")).toBe(true);
    expect(path).toContain("C ");
  });

  it("returns empty for no points", () => {
    expect(pulsePath([], 680, 360, 24)).toBe("");
  });
});
