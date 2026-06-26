import { describe, it, expect } from "vitest";
import { analyzeReliability } from "@/lib/reliability-audit";
import type { CalibrationBin } from "@/lib/accountability";

const bin = (predicted: number, observed: number, n: number): CalibrationBin => ({
  midpoint: predicted,
  predicted,
  observed,
  n,
});

describe("analyzeReliability", () => {
  it("returns no-data for fewer than 2 usable bins", () => {
    expect(analyzeReliability([]).hasData).toBe(false);
    expect(analyzeReliability([bin(0.5, 0.5, 3)]).hasData).toBe(false);
    expect(analyzeReliability([]).ece).toBeNull();
    expect(analyzeReliability([]).callouts).toEqual([]);
  });

  it("ignores empty bins when counting usable bins", () => {
    expect(analyzeReliability([bin(0.2, 0.2, 0), bin(0.8, 0.5, 5)]).hasData).toBe(false);
  });

  it("classifies overconfident bins (observed below predicted)", () => {
    const a = analyzeReliability([bin(0.2, 0.25, 10), bin(0.8, 0.55, 10)]);
    expect(a.hasData).toBe(true);
    const hi = a.bins.find((b) => b.predicted === 0.8)!;
    expect(hi.direction).toBe("over");
    expect(hi.gap).toBeCloseTo(-0.25, 5);
  });

  it("classifies underconfident and on-diagonal bins", () => {
    const a = analyzeReliability([bin(0.3, 0.45, 10), bin(0.6, 0.61, 10)]);
    expect(a.bins.find((b) => b.predicted === 0.3)!.direction).toBe("under");
    expect(a.bins.find((b) => b.predicted === 0.6)!.direction).toBe("on");
  });

  it("computes sample-weighted ECE", () => {
    // gaps |.05|,|.25| with n 30,10 → (30*.05 + 10*.25)/40 = .1
    const a = analyzeReliability([bin(0.2, 0.25, 30), bin(0.8, 0.55, 10)]);
    expect(a.ece).toBeCloseTo(0.1, 5);
  });

  it("emits data-derived callouts (ECE + best-calibrated + overconfidence)", () => {
    const a = analyzeReliability([bin(0.2, 0.22, 20), bin(0.8, 0.55, 20)]);
    expect(a.callouts.some((c) => /ECE .* vs 3\.0% target/.test(c))).toBe(true);
    expect(a.callouts.some((c) => /Best calibrated/.test(c))).toBe(true);
    expect(a.callouts.some((c) => /overconfident/i.test(c))).toBe(true);
  });

  it("sorts bins ascending by predicted probability", () => {
    const a = analyzeReliability([bin(0.8, 0.7, 5), bin(0.2, 0.2, 5), bin(0.5, 0.5, 5)]);
    expect(a.bins.map((b) => b.predicted)).toEqual([0.2, 0.5, 0.8]);
  });
});
