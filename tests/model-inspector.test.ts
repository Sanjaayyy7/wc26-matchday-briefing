// tests/model-inspector.test.ts
import { describe, it, expect } from "vitest";
import { inspectModel } from "../scripts/model-inspector.mts";

const okModel = {
  params: { baseLogGoals: 0.15, eloSlope: 0.85, rho: -0.05 },
  regimeParams: { tournament: { baseLogGoals: 0.05, eloSlope: 0.7, rho: -0.12 } },
  promotion: {
    shipped: true,
    rule: "secondary",
    drawGap: 0.03,
    seed: 42,
    harnessGeneratedAt: "2026-06-24T00:00:00.000Z",
  },
  backtest: { brier: 0.5085, uniformBrier: 0.6667, ece: 0.0089 },
};
const okVerdict = {
  config: { generatedAt: "2026-06-24T00:00:00.000Z", seed: 42, bootstrapSamples: 5000 },
  drawGap: { baseline: 0.15, regime: 0.03 },
  regimePromotion: { secondary: { ship: true }, primary: { ship: false } },
};

describe("inspectModel", () => {
  it("passes on a consistent shipped model + verdict", () => {
    expect(inspectModel({ model: okModel, verdict: okVerdict })).toEqual([]);
  });

  it("passes a candidate (not shipped) model without a verdict", () => {
    const m = { ...okModel, promotion: { shipped: false, status: "candidate" } };
    expect(inspectModel({ model: m, verdict: null })).toEqual([]);
  });

  it("fails when shipped but no verdict artifact exists", () => {
    expect(inspectModel({ model: okModel, verdict: null }).join(" ")).toMatch(/verdict/i);
  });

  it("fails when shipped but neither rule shipped in the artifact", () => {
    const v = { ...okVerdict, regimePromotion: { secondary: { ship: false }, primary: { ship: false } } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/rule/i);
  });

  it("fails when the regime draw-gap is worse than baseline", () => {
    const v = { ...okVerdict, drawGap: { baseline: 0.05, regime: 0.12 } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/draw/i);
  });

  it("fails on a leakage-constant mismatch (seed)", () => {
    const v = { ...okVerdict, config: { ...okVerdict.config, seed: 7 } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/seed/i);
  });

  it("fails when backtest no longer beats uniform", () => {
    const m = { ...okModel, backtest: { brier: 0.7, uniformBrier: 0.6667, ece: 0.0089 } };
    expect(inspectModel({ model: m, verdict: okVerdict }).join(" ")).toMatch(/uniform|brier/i);
  });

  it("fails when a shipped model and verdict both omit the harness timestamp", () => {
    const m = { ...okModel, promotion: { ...okModel.promotion, harnessGeneratedAt: undefined } };
    const v = { ...okVerdict, config: { ...okVerdict.config, generatedAt: undefined } };
    expect(inspectModel({ model: m, verdict: v }).join(" ")).toMatch(/harnessGeneratedAt|timestamp|verdict/i);
  });
});
