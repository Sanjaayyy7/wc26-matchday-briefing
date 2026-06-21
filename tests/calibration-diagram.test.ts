// tests/calibration-diagram.test.ts
import { describe, it, expect } from "vitest";
import { calibrationPoint } from "../lib/calibration-diagram";

const opts = { size: 100, pad: 10 };

describe("calibrationPoint", () => {
  it("maps (predicted 0, observed 0) to bottom-left of the plot area", () => {
    const p = calibrationPoint({ predicted: 0, observed: 0, n: 1 }, opts);
    expect(p.cx).toBe(10);
    expect(p.cy).toBe(90);
  });

  it("maps (predicted 1, observed 1) to top-right (y inverted)", () => {
    const p = calibrationPoint({ predicted: 1, observed: 1, n: 1 }, opts);
    expect(p.cx).toBe(90);
    expect(p.cy).toBe(10);
  });

  it("maps (0.5, 0.5) to the centre", () => {
    const p = calibrationPoint({ predicted: 0.5, observed: 0.5, n: 1 }, opts);
    expect(p.cx).toBe(50);
    expect(p.cy).toBe(50);
  });

  it("scales radius with sqrt(n) and clamps to rMax", () => {
    const small = calibrationPoint({ predicted: 0.5, observed: 0.5, n: 1 }, { ...opts, rMin: 1.5, rMax: 5, k: 0.6 });
    const big = calibrationPoint({ predicted: 0.5, observed: 0.5, n: 400 }, { ...opts, rMin: 1.5, rMax: 5, k: 0.6 });
    expect(small.r).toBeCloseTo(2.1, 5); // 1.5 + sqrt(1)*0.6
    expect(big.r).toBe(5); // 1.5 + sqrt(400)*0.6 = 13.5 -> clamped
  });

  it("clamps out-of-range predicted/observed to the plot edges", () => {
    const p = calibrationPoint({ predicted: 1.4, observed: -0.2, n: 1 }, opts);
    expect(p.cx).toBe(90); // clamped to 1 -> right edge
    expect(p.cy).toBe(90); // clamped to 0 -> bottom
  });
});
