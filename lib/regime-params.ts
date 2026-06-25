//
// Pure parameter-fitting primitives shared by the trainer (scripts/train-model.mts)
// and the tournament-holdout harness (scripts/validate-model.mts). Extracting the
// Elo→goals regression and the Dixon-Coles rho grid search here lets both fit a
// regime-specific parameter set without duplicating the math. No I/O.
import { scoreGrid, type ModelParams } from "./poisson-model";

export type GoalSample = { x: number; goals: number };
export type LikRow = { diff: number; hs: number; as: number };

const BIN = 0.125;

/** Binned log-mean (x, y=log mean goals) points, dropping bins below minBinCount. */
function binnedLogMeans(samples: GoalSample[], minBinCount: number): Array<{ x: number; y: number }> {
  const bins = new Map<number, { sum: number; n: number }>();
  for (const s of samples) {
    const b = Math.max(-1.5, Math.min(1.5, Math.round(s.x / BIN) * BIN));
    const e = bins.get(b) ?? { sum: 0, n: 0 };
    e.sum += s.goals;
    e.n += 1;
    bins.set(b, e);
  }
  return [...bins.entries()]
    .filter(([, e]) => e.n >= minBinCount)
    .map(([x, e]) => ({ x, y: Math.log(Math.max(e.sum / e.n, 0.05)) }));
}

/** Binned log-mean regression of goals on (own−opp Elo)/400. `minBinCount`
 *  drops sparse bins; the global trainer uses 200, regime fits use a lower value
 *  because the tournament-only sample is smaller. */
export function fitBaseAndSlope(
  samples: GoalSample[],
  minBinCount = 200,
): { baseLogGoals: number; eloSlope: number } {
  const pts = binnedLogMeans(samples, minBinCount);
  const n = pts.length;
  if (n < 2) throw new Error(`fitBaseAndSlope: too few populated bins (${n}); lower minBinCount or supply more samples`);
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const eloSlope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const baseLogGoals = (sy - eloSlope * sx) / n;
  return { baseLogGoals, eloSlope };
}

/** Grid-search rho ∈ [-0.2, 0.06] maximizing exact-score log-likelihood under
 *  the Dixon-Coles correction. Lambdas are reconstructed from base/slope/diff. */
export function fitRho(likRows: LikRow[], baseLogGoals: number, eloSlope: number): number {
  let best = { rho: 0, ll: -Infinity };
  for (let rho = -0.2; rho <= 0.06 + 1e-9; rho += 0.01) {
    let ll = 0;
    for (const m of likRows) {
      if (m.hs >= 9 || m.as >= 9) continue;
      const lh = Math.exp(baseLogGoals + eloSlope * m.diff);
      const la = Math.exp(baseLogGoals - eloSlope * m.diff);
      const grid = scoreGrid(lh, la, rho);
      ll += Math.log(Math.max(grid[m.hs][m.as], 1e-12));
    }
    if (ll >= best.ll) best = { rho, ll };
  }
  return Number(best.rho.toFixed(3));
}

export function fitRegimeParams(
  samples: GoalSample[],
  likRows: LikRow[],
  minBinCount = 200,
): ModelParams {
  const { baseLogGoals, eloSlope } = fitBaseAndSlope(samples, minBinCount);
  const rho = fitRho(likRows, baseLogGoals, eloSlope);
  return { baseLogGoals, eloSlope, rho };
}

/** Fit a stage-specific {baseLogGoals, rho} holding eloSlope fixed at `sharedSlope`.
 *  With the slope pinned, the least-squares intercept is mean(y − slope·x) over the
 *  populated bins; rho is the usual 1-D grid search under that base/slope. */
export function fitStageParams(
  samples: GoalSample[],
  likRows: LikRow[],
  sharedSlope: number,
  minBinCount = 200,
): ModelParams {
  const pts = binnedLogMeans(samples, minBinCount);
  if (pts.length < 1) throw new Error(`fitStageParams: no populated bins; lower minBinCount or supply more samples`);
  const baseLogGoals = pts.reduce((a, p) => a + (p.y - sharedSlope * p.x), 0) / pts.length;
  const rho = fitRho(likRows, baseLogGoals, sharedSlope);
  return { baseLogGoals, eloSlope: sharedSlope, rho };
}

/** |mean predicted P(draw) − observed draw frequency| over a set of scored matches. */
export function drawRateGap(rows: Array<{ pDraw: number; isDraw: boolean }>): number {
  if (rows.length === 0) return 0;
  const meanPred = rows.reduce((a, r) => a + r.pDraw, 0) / rows.length;
  const obs = rows.filter((r) => r.isDraw).length / rows.length;
  return Math.abs(meanPred - obs);
}
