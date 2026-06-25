// lib/stage-regime.ts
//
// Pure walk-forward helpers for the stage-aware regime variant of ml:validate.
// fitStageParamsByStage fits per-stage {base,rho} on STRICTLY-PRIOR same-stage matches
// (the date filter is the leakage guard) holding the pooled slope fixed; selectStageParams
// resolves the nested stage -> pooled -> baseline fallback at scoring time. No I/O.
import { fitStageParams, type GoalSample, type LikRow } from "./regime-params";
import type { ModelParams } from "./poisson-model";
import type { StageLabel } from "./stage-derivation";

export type StageSample = GoalSample & { date: string; stage: StageLabel };
export type StageLik = LikRow & { date: string; stage: StageLabel };
export type StageFits = Partial<Record<StageLabel, ModelParams>>;
export type FallbackTier = "stage" | "pooled" | "baseline";

const STAGES: StageLabel[] = ["group", "knockout"];

/** Fit each stage that has >= minStageSamples matches dated strictly before `beforeDate`,
 *  holding eloSlope = sharedSlope. Returns {} if sharedSlope is null (no pooled fit yet),
 *  so a stage fit can never activate before the pooled regime does. */
export function fitStageParamsByStage(
  samples: StageSample[],
  liks: StageLik[],
  beforeDate: string,
  sharedSlope: number | null,
  minStageSamples: number,
  minBinCount = 30,
): StageFits {
  const fits: StageFits = {};
  if (sharedSlope === null) return fits;
  for (const stage of STAGES) {
    const priorLik = liks.filter((l) => l.date < beforeDate && l.stage === stage);
    if (priorLik.length < minStageSamples) continue;
    const priorSamp = samples.filter((s) => s.date < beforeDate && s.stage === stage);
    fits[stage] = fitStageParams(priorSamp, priorLik, sharedSlope, minBinCount);
  }
  return fits;
}

/** Nested fallback: stage params if fitted, else pooled regime params, else global baseline. */
export function selectStageParams(
  stage: StageLabel | undefined,
  fits: StageFits,
  pooled: ModelParams | null,
  baseline: ModelParams,
): { params: ModelParams; tier: FallbackTier } {
  if (stage && fits[stage]) return { params: fits[stage]!, tier: "stage" };
  if (pooled) return { params: pooled, tier: "pooled" };
  return { params: baseline, tier: "baseline" };
}
