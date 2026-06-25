import { describe, it, expect } from "vitest";
import { blendSplit, shadowVerdict } from "../lib/market-blend";

const model = { home: 0.5, draw: 0.3, away: 0.2 };
const market = { home: 0.7, draw: 0.2, away: 0.1 };

describe("blendSplit", () => {
  it("returns the model at lambda=0 and the market at lambda=1", () => {
    expect(blendSplit(model, market, 0)).toEqual(model);
    expect(blendSplit(model, market, 1)).toEqual(market);
  });

  it("is the renormalized convex midpoint at lambda=0.5", () => {
    const b = blendSplit(model, market, 0.5);
    expect(b.home).toBeCloseTo(0.6, 6);
    expect(b.draw).toBeCloseTo(0.25, 6);
    expect(b.away).toBeCloseTo(0.15, 6);
    expect(b.home + b.draw + b.away).toBeCloseTo(1, 6);
  });

  it("always sums to 1 even if inputs are unnormalized", () => {
    const b = blendSplit({ home: 1, draw: 1, away: 2 }, { home: 2, draw: 1, away: 1 }, 0.5);
    expect(b.home + b.draw + b.away).toBeCloseTo(1, 6);
  });

  it("throws when lambda is out of [0,1]", () => {
    expect(() => blendSplit(model, market, -0.1)).toThrow();
    expect(() => blendSplit(model, market, 1.1)).toThrow();
  });
});

describe("shadowVerdict", () => {
  it("ADOPT-SHADOW when blend beats both endpoints and n >= 30", () => {
    expect(shadowVerdict(30, 0.50, 0.48, 0.45)).toBe("ADOPT-SHADOW");
  });
  it("PROVISIONAL when blend beats both but n < 30", () => {
    expect(shadowVerdict(20, 0.50, 0.48, 0.45)).toBe("PROVISIONAL");
  });
  it("HOLD when blend does not beat both endpoints", () => {
    expect(shadowVerdict(50, 0.50, 0.40, 0.45)).toBe("HOLD"); // market better than blend
    expect(shadowVerdict(50, 0.44, 0.48, 0.45)).toBe("HOLD"); // model better than blend
  });
});
