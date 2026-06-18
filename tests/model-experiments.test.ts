import { describe, it, expect } from "vitest";
import { applyPlatt, fitPlatt, timeDecayWeight } from "@/lib/model-experiments";
describe("model-experiments", () => {
  it("applyPlatt monotonic in p", () => {
    expect(applyPlatt(0.6, 1.4, -0.2)).toBeGreaterThan(applyPlatt(0.4, 1.4, -0.2));
  });
  it("timeDecayWeight halves at one half-life", () => {
    const now = Date.UTC(2026, 0, 1), old = now - 365 * 86_400_000;
    expect(timeDecayWeight(old, now, 365)).toBeCloseTo(0.5, 5);
  });
  it("fitPlatt lowers calibration error on overconfident data", () => {
    const pairs = Array.from({ length: 400 }, (_, i) => ({ p: 0.9, y: (i % 10 < 7 ? 1 : 0) as 0 | 1 }));
    const { a, b } = fitPlatt(pairs);
    const mse = (f: (p: number) => number) => pairs.reduce((s, q) => s + (f(q.p) - q.y) ** 2, 0) / pairs.length;
    expect(mse((p) => applyPlatt(p, a, b))).toBeLessThan(mse((p) => p));
  });
});
