import { describe, it, expect } from "vitest";
import { selectParams } from "../lib/predict";

const globalParams = { baseLogGoals: 0.15, eloSlope: 0.85, rho: -0.05 };
const tourney = { baseLogGoals: 0.05, eloSlope: 0.7, rho: -0.12 };

describe("selectParams", () => {
  it("uses regime params when promotion is shipped and regime params exist", () => {
    const m = { params: globalParams, regimeParams: { tournament: tourney }, promotion: { shipped: true } };
    expect(selectParams(m)).toEqual(tourney);
  });

  it("falls back to global params when promotion is not shipped", () => {
    const m = { params: globalParams, regimeParams: { tournament: tourney }, promotion: { shipped: false } };
    expect(selectParams(m)).toEqual(globalParams);
  });

  it("falls back to global params when promotion or regimeParams are absent", () => {
    expect(selectParams({ params: globalParams })).toEqual(globalParams);
    expect(selectParams({ params: globalParams, promotion: { shipped: true } })).toEqual(globalParams);
  });
});
