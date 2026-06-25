import { describe, it, expect } from "vitest";
import {
  fitStageParamsByStage,
  selectStageParams,
  type StageSample,
  type StageLik,
} from "../lib/stage-regime";
import type { ModelParams } from "../lib/poisson-model";

const P = (base: number): ModelParams => ({ baseLogGoals: base, eloSlope: 0.8, rho: -0.05 });

describe("selectStageParams (nested fallback)", () => {
  const baseline = P(0);
  const pooled = P(0.1);
  const fits = { knockout: P(0.2) };

  it("uses the stage fit when present", () => {
    const r = selectStageParams("knockout", fits, pooled, baseline);
    expect(r.tier).toBe("stage");
    expect(r.params.baseLogGoals).toBe(0.2);
  });

  it("falls back to pooled when the stage has no fit", () => {
    const r = selectStageParams("group", fits, pooled, baseline);
    expect(r.tier).toBe("pooled");
    expect(r.params.baseLogGoals).toBe(0.1);
  });

  it("falls back to pooled for an unlabeled (undefined) stage", () => {
    expect(selectStageParams(undefined, fits, pooled, baseline).tier).toBe("pooled");
  });

  it("falls back to baseline when pooled is null", () => {
    const r = selectStageParams("group", fits, null, baseline);
    expect(r.tier).toBe("baseline");
    expect(r.params.baseLogGoals).toBe(0);
  });
});

describe("fitStageParamsByStage (walk-forward leakage)", () => {
  const sharedSlope = 0.7;
  function mk(n: number, date: string, stage: "group" | "knockout", goals: number) {
    const s: StageSample[] = [];
    const l: StageLik[] = [];
    for (let i = 0; i < n; i++) {
      for (const x of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) s.push({ x, goals, date, stage });
      l.push({ diff: 0, hs: 1, as: 1, date, stage });
    }
    return { s, l };
  }

  it("fits only stages meeting the minimum and ignores entries dated on/after beforeDate", () => {
    const prior = mk(200, "2009-01-01", "group", 1.2);
    const future = mk(500, "2011-01-01", "group", 5.0);   // must be ignored (leakage guard)
    const koPrior = mk(50, "2009-01-01", "knockout", 1.0); // below the minimum
    const samples = [...prior.s, ...future.s, ...koPrior.s];
    const liks = [...prior.l, ...future.l, ...koPrior.l];
    const fits = fitStageParamsByStage(samples, liks, "2010-01-01", sharedSlope, 150, 20);
    expect(fits.group).toBeDefined();        // 200 >= 150
    expect(fits.knockout).toBeUndefined();   // 50 < 150
    // base reflects the prior goals ≈1.2 (log ≈0.18), NOT the future 5.0 → proves no leakage
    expect(fits.group!.baseLogGoals).toBeCloseTo(Math.log(1.2), 1);
  });

  it("returns no fits when the shared slope is unavailable", () => {
    const prior = mk(200, "2009-01-01", "group", 1.2);
    expect(fitStageParamsByStage(prior.s, prior.l, "2010-01-01", null, 150, 20).group).toBeUndefined();
  });
});
