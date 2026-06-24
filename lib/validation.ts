// Tournament-holdout validation primitives.
//
// Pure functions used by scripts/validate-model.mts to score model variants on
// finals-tournament matches with statistically honest, CI-gated promotion.
// Reuses the seeded bootstrap from backtest-metrics and the reliability/ECE
// definitions from calibration so all numbers stay consistent across harnesses.

import { bootstrapCI, type BootstrapCI } from "./backtest-metrics";

/**
 * The finals tournaments that form the held-out evaluation regime: neutral-ish,
 * high-stakes, knockout football resembling the World Cup. Exact labels — the
 * "… qualification" variants and lesser competitions (Confederations Cup,
 * Nations League) are deliberately excluded.
 */
export const FINALS_TOURNAMENTS: ReadonlySet<string> = new Set([
  "FIFA World Cup",
  "UEFA Euro",
  "Copa América",
  "African Cup of Nations",
  "AFC Asian Cup",
]);

/** Exact-set membership — no substring matching, so "… qualification" never leaks in. */
export function isFinalsTournament(label: string): boolean {
  return FINALS_TOURNAMENTS.has(label);
}

/**
 * Paired bootstrap CI of the per-match Brier difference (incumbent − challenger).
 * A positive interval means the challenger has the lower (better) Brier. Pairing
 * controls for match difficulty: the same match is scored by both models.
 */
export function pairedDeltaBrierCI(
  incumbentBrier: number[],
  challengerBrier: number[],
  n = 2000,
  seed = 42,
): BootstrapCI {
  if (incumbentBrier.length !== challengerBrier.length) {
    throw new Error(
      `pairedDeltaBrierCI: length mismatch (${incumbentBrier.length} vs ${challengerBrier.length}); paired per-match data required`,
    );
  }
  const diffs = incumbentBrier.map((b, i) => b - challengerBrier[i]);
  return bootstrapCI(diffs, n, seed);
}

export type PromotionVerdict = {
  ship: boolean;
  deltaBrierCI: BootstrapCI;
  eceOk: boolean;
  reason: string;
};

/** Default calibration ceiling — matches the ADR-0001 bar used across harnesses. */
export const ECE_MAX = 0.03;

/**
 * Pre-registered promotion rule: ship a challenger iff its Brier improvement over
 * the incumbent is statistically real (95% bootstrap CI of ΔBrier fully > 0) AND
 * it stays calibrated (ECE < ceiling). This is the rule that correctly KILLS
 * small-sample "wins" that are within variance.
 */
export function promotionVerdict(
  incumbentBrier: number[],
  challengerBrier: number[],
  challengerEce: number,
  opts: { n?: number; seed?: number; eceMax?: number } = {},
): PromotionVerdict {
  const { n = 2000, seed = 42, eceMax = ECE_MAX } = opts;
  const deltaBrierCI = pairedDeltaBrierCI(incumbentBrier, challengerBrier, n, seed);
  const significant = deltaBrierCI.lo > 0;
  const eceOk = challengerEce < eceMax;
  const ship = significant && eceOk;
  const reason = ship
    ? `SHIP — ΔBrier 95% CI [${deltaBrierCI.lo.toFixed(4)}, ${deltaBrierCI.hi.toFixed(4)}] > 0 and ECE ${challengerEce.toFixed(4)} < ${eceMax}`
    : !significant
      ? `HOLD — ΔBrier 95% CI [${deltaBrierCI.lo.toFixed(4)}, ${deltaBrierCI.hi.toFixed(4)}] straddles 0 (not significant)`
      : `HOLD — ECE ${challengerEce.toFixed(4)} ≥ ${eceMax} (calibration breach)`;
  return { ship, deltaBrierCI, eceOk, reason };
}
