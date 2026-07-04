// lib/market-blend.ts
//
// Linear-pool blend of the model and market forecasts + the pre-registered
// shadow adoption rule. Pure; no I/O. Used by the market-shadow script to
// evaluate the blend on the settled market-covered sample without touching live
// predictions.
import type { ProbSplit } from "./polymarket";

/** normalize((1−λ)·model + λ·market). λ ∈ [0,1]; throws otherwise. */
export function blendSplit(model: ProbSplit, market: ProbSplit, lambda: number): ProbSplit {
  if (lambda < 0 || lambda > 1) throw new Error(`blendSplit: lambda ${lambda} out of [0,1]`);
  // Return fresh copies at boundaries to avoid floating-point precision issues in arithmetic.
  if (lambda === 0) return { home: model.home, draw: model.draw, away: model.away };
  if (lambda === 1) return { home: market.home, draw: market.draw, away: market.away };
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

/**
 * A market snapshot is a pre-kickoff observation: once the match has kicked
 * off, live/resolved prices collapse toward 0/1 and must never replace the
 * stored snapshot. Before kickoff the freshest quote wins.
 */
export function preserveSnapshotProbs<T>(
  stored: T | null | undefined,
  fresh: T | null,
  kickedOff: boolean,
): T | null {
  if (kickedOff && stored) return stored;
  return fresh ?? stored ?? null;
}
