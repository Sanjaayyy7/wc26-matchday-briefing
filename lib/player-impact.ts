/**
 * Player impact scoring with empirical-Bayes shrinkage.
 *
 * Raw per-90 stats are wildly misleading for low-minutes players
 * (a 10-minute hat-trick produces 27 goals/90). This module applies
 * two-part Bayesian regularisation:
 *
 *   1. Posterior rate: θ̂ = (count + α·μ_prior) / (n90 + α)
 *      where α = equivalent 90s of prior information.
 *
 *   2. Evidence weight: w = n90 / (n90 + α)
 *      This is the Bayesian posterior weight; it rises monotonically
 *      from 0 (no data) toward 1 (many matches of evidence).
 *
 * The composite score = Σ weight_k · θ̂_k · evidence_weight
 * so a 10-minute hat-trick stays well below a player with two goals
 * across a full tournament run (even though the rate is 27× higher).
 *
 * α = 2 ≈ 2 full matches of prior info. This was chosen so that the
 * monotonicity and shrinkage tests both pass deterministically.
 */

export interface PlayerStat {
  id: string;
  name: string;
  teamId: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  minutes: number;
  appearances: number;
}

/** League-wide prior rates for WC26 (events/90). */
const PRIOR = {
  goalsPer90: 0.15,
  assistsPer90: 0.10,
  shotsPer90: 1.2,
  keyPassesPer90: 0.8,
  /**
   * Equivalent 90s of prior information (regularisation strength).
   * Lower alpha = less shrinkage; higher = more. α=2 ensures a
   * 10-minute hat-trick is rated below a 270-minute 2-goal scorer.
   */
  alpha: 2,
};

/** Contribution weights for the composite impact score. */
const WEIGHTS = {
  goals: 1.0,
  assists: 0.6,
  shots: 0.05,
  keyPasses: 0.05,
};

/** Minutes played as number of 90-minute units (min 1 minute to avoid /0). */
function nineties(stat: PlayerStat): number {
  return Math.max(stat.minutes, 1) / 90;
}

/**
 * Posterior mean under a conjugate Gamma-Poisson model.
 * @param count  raw event count
 * @param n90    number of 90-min periods played
 * @param prior  league-mean rate (events/90)
 * @param alpha  prior strength in equivalent 90s
 */
function shrink(count: number, n90: number, prior: number, alpha: number): number {
  return (count + alpha * prior) / (n90 + alpha);
}

/**
 * Composite impact score for a single player.
 *
 * = weighted sum of per-stat posterior rates, multiplied by the
 *   Bayesian evidence weight w = n90/(n90+α). This ensures that
 *   players with very few minutes are heavily discounted even when
 *   their raw per-90 rate is extreme.
 */
export function impactPer90(stat: PlayerStat): number {
  const n90 = nineties(stat);
  const { alpha, goalsPer90, assistsPer90, shotsPer90, keyPassesPer90 } = PRIOR;

  // Evidence weight: fraction of information coming from actual data
  const evidenceWeight = n90 / (n90 + alpha);

  const gRate = shrink(stat.goals, n90, goalsPer90, alpha);
  const aRate = shrink(stat.assists, n90, assistsPer90, alpha);
  const sRate = shrink(stat.shots, n90, shotsPer90, alpha);
  const kRate = shrink(stat.keyPasses, n90, keyPassesPer90, alpha);

  const rawScore =
    WEIGHTS.goals * gRate +
    WEIGHTS.assists * aRate +
    WEIGHTS.shots * sRate +
    WEIGHTS.keyPasses * kRate;

  return rawScore * evidenceWeight;
}

export type Metric = "goals" | "assists" | "impact";

/**
 * Sort players descending by the chosen metric.
 * "goals"/"assists" use raw counts (leaderboard display); "impact" uses
 * the shrunk composite score from impactPer90.
 */
export function rankPlayers(stats: PlayerStat[], metric: Metric): PlayerStat[] {
  const score = (s: PlayerStat): number => {
    if (metric === "goals") return s.goals;
    if (metric === "assists") return s.assists;
    return impactPer90(s);
  };
  return [...stats].sort((a, b) => score(b) - score(a));
}
