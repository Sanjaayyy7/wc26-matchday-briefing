// lib/market-blend.ts
//
// Linear-pool blend of the model and market forecasts + the pre-registered
// shadow-adoption rule. Pure; no I/O. Used by scripts/market-shadow.mts to
// evaluate the blend on the settled market-covered sample without touching live
// predictions.
import type { ProbSplit } from "./polymarket";

/** normalize(λ·market + (1−λ)·model). λ ∈ [0,1]; throws otherwise. */
export function blendSplit(model: ProbSplit, market: ProbSplit, lambda: number): ProbSplit {
  if (lambda < 0 || lambda > 1) throw new Error(`blendSplit: lambda ${lambda} out of [0,1]`);
  // Edge cases: return exact input to avoid floating-point noise
  if (lambda === 0) return model;
  if (lambda === 1) return market;
  const mix = (m: number, k: number) => (1 - lambda) * m + lambda * k;
  const home = mix(model.home, market.home);
  const draw = mix(model.draw, market.draw);
  const away = mix(model.away, market.away);
  const z = home + draw + away;
  return { home: home / z, draw: draw / z, away: away / z };
}

export type ShadowVerdict = "ADOPT-SHADOW" | "PROVISIONAL" | "HOLD";

/**
 * Pre-registered rule: the λ=0.5 blend is ADOPT-SHADOW iff it strictly beats both
 * the model-only and market-only Brier AND the sample is large enough (n ≥ minN);
 * PROVISIONAL if it beats both but the sample is too small; HOLD otherwise.
 */
export function shadowVerdict(
  n: number,
  brierModel: number,
  brierMarket: number,
  brierBlend05: number,
  opts: { minN?: number } = {},
): ShadowVerdict {
  const { minN = 30 } = opts;
  const beatsBoth = brierBlend05 < brierModel && brierBlend05 < brierMarket;
  if (!beatsBoth) return "HOLD";
  return n >= minN ? "ADOPT-SHADOW" : "PROVISIONAL";
}
