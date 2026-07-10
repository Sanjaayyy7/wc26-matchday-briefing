// v3 inspector gates — every locked v3-value slip revalidates from its OWN
// stored inputs (spec 2026-07-09): model reproduction, registered constraint
// compliance (bands, per-series, GAME⊥ADVANCE, pairwise redundancy, minEdge),
// scorer shares, reasoning bytes, key whitelist. No network access.
import { REDUNDANCY_CAP, REASONING_GRAMMAR } from "../lib/parlay";
import type { KalshiMarket } from "../lib/parlay";
import { halfLattice, seriesOf } from "../lib/parlay-v2";
import {
  COMBO_SERIES_V3, ENGINE_VERSION_V3, YES_ONLY_SERIES_V3,
  jointProbV3, legProbV3, legReasoningV3, parseMarketV3,
  type CandidateLegV3, type PlayerModel, type V3Constraints,
} from "../lib/parlay-v3";
import { scoreGrid } from "../lib/poisson-model";
import type { SlipRecordV2 } from "./parlay-inspector.mts";

const TOL = 1e-9;
const COMBO_SET_V3 = new Set<string>(COMBO_SERIES_V3);

export type SlipRecordV3 = SlipRecordV2 & {
  constraints?: V3Constraints;
  playerModel?: PlayerModel;
  edge?: number;
};

const SLIP_KEYS_V3 = new Set([
  "slug", "engineVersion", "lockedAt", "modelDataThrough", "eloDiff", "lambdas", "rho",
  "etWinProbHome", "qFirstHalf", "constraints", "playerModel", "legs", "jointProb",
  "comboImpliedProb", "edge", "result",
]);
const RESULT_KEYS = new Set(["legs", "slipHit", "gradedAt"]);
// v3 scorer reasoning grammar (reg/advance legs keep the v1 grammar).
const SCORER_GRAMMAR = /^model \d{1,2}\.\d% — .+ carries \d{1,2}\.\d% of [A-Z]{3} goals \(WC26 goals \+ xG share\); \d\+ via Binomial thinning of the [A-Z]{3} goal count\.$/;

export function inspectSlipV3(
  slip: SlipRecordV3,
  snapshot: { markets: KalshiMarket[] },
  ctx: { homeAbbr: string; awayAbbr: string },
): string[] {
  const fails: string[] = [];

  if (slip.engineVersion !== ENGINE_VERSION_V3) {
    fails.push(`gate8: engineVersion "${slip.engineVersion}" is not "${ENGINE_VERSION_V3}"`);
  }
  if (!slip.lockedAt || new Date(slip.lockedAt).getTime() > Date.now()) {
    fails.push(`gate6: lockedAt missing or in the future (${slip.lockedAt})`);
  }
  if (slip.verdict === "no-slip") {
    if (typeof slip.reason !== "string" || slip.reason.length === 0) {
      fails.push("gate7: no-slip record missing reason string");
    }
    return fails;
  }

  for (const k of Object.keys(slip)) {
    if (!SLIP_KEYS_V3.has(k)) fails.push(`gate6: unexpected slip key "${k}"`);
  }
  if (slip.result) {
    for (const k of Object.keys(slip.result)) {
      if (!RESULT_KEYS.has(k)) fails.push(`gate6: unexpected result key "${k}"`);
    }
  }

  const legs = slip.legs ?? [];
  const bySnapTicker = new Map(snapshot.markets.map((m) => [m.ticker, m]));

  // gate 1 (snapshot membership) + gate 8 (combo eligibility, YES-only)
  for (const leg of legs) {
    if (!bySnapTicker.has(leg.ticker)) fails.push(`gate1: leg ticker not in snapshot (${leg.ticker})`);
    const series = seriesOf(leg.ticker);
    if (!COMBO_SET_V3.has(series)) fails.push(`gate8: series not combo-eligible (${leg.ticker})`);
    if (YES_ONLY_SERIES_V3.has(series) && leg.side !== "yes") fails.push(`gate8: NO side on YES-only series (${leg.ticker})`);
  }

  if (
    slip.lambdas === undefined || slip.rho === undefined || slip.etWinProbHome === undefined ||
    slip.jointProb === undefined || slip.eloDiff === undefined || slip.qFirstHalf === undefined ||
    slip.constraints === undefined || slip.edge === undefined ||
    slip.comboImpliedProb === undefined
  ) {
    fails.push("gate9: slip missing stored inputs (lambdas/rho/etWinProbHome/eloDiff/jointProb/qFirstHalf/constraints/edge/comboImpliedProb)");
    return fails;
  }
  const cons = slip.constraints;
  const players = slip.playerModel?.players ?? [];

  // gate 2: parseable under the v3 registry; scorer legs need a stored share
  const candidates: Array<CandidateLegV3 | null> = legs.map((leg) => {
    const snap = bySnapTicker.get(leg.ticker);
    const parsed = parseMarketV3(
      snap ?? { ticker: leg.ticker, title: leg.title, yesMid: leg.kalshiMid },
      ctx.homeAbbr, ctx.awayAbbr,
    );
    if (!parsed) {
      fails.push(`gate2: leg not parseable (${leg.ticker})`);
      return null;
    }
    if (parsed.kind === "scorer" && !players.some((p) => p.code === parsed.playerCode)) {
      fails.push(`gate2: scorer leg without stored share (${leg.ticker})`);
      return null;
    }
    return { market: parsed, side: leg.side };
  });
  if (candidates.some((c) => c === null)) return fails;
  const legCandidates = candidates as CandidateLegV3[];

  const lattice = halfLattice(scoreGrid(slip.lambdas.home, slip.lambdas.away, slip.rho), slip.qFirstHalf);
  const et = slip.etWinProbHome;

  // gate 9: model reproduction ±1e-9 (legs, joint, combo-implied, edge)
  const legPs = legCandidates.map((c) => legProbV3(c, lattice, et, players));
  legs.forEach((leg, i) => {
    if (Math.abs(legPs[i] - leg.modelProb) > TOL) {
      fails.push(`gate9: leg modelProb drift (${leg.ticker}: stored ${leg.modelProb}, recomputed ${legPs[i]})`);
    }
  });
  const joint = jointProbV3(legCandidates, lattice, et, players);
  if (Math.abs(joint - slip.jointProb) > TOL) {
    fails.push(`gate9: jointProb drift (stored ${slip.jointProb}, recomputed ${joint})`);
  }
  let implied = 1;
  let impliedNull = false;
  for (const leg of legs) {
    if (leg.kalshiMid === null) { impliedNull = true; break; }
    implied *= leg.kalshiMid;
  }
  if (impliedNull || slip.comboImpliedProb === null) {
    fails.push("gate9: v3 slips require stored mids on every leg");
  } else if (Math.abs(implied - slip.comboImpliedProb) > TOL) {
    fails.push(`gate9: comboImpliedProb drift (stored ${slip.comboImpliedProb}, recomputed ${implied})`);
  } else if (Math.abs(slip.jointProb - slip.comboImpliedProb - (slip.edge ?? 0)) > TOL) {
    fails.push(`gate9: edge drift (stored ${slip.edge}, recomputed ${slip.jointProb - slip.comboImpliedProb})`);
  }

  // gate 4: the slip's OWN registered constraints
  if (legs.length < 2 || legs.length > cons.maxLegs) {
    fails.push(`gate4: leg count ${legs.length} outside [2, ${cons.maxLegs}]`);
  }
  legs.forEach((leg, i) => {
    if (legPs[i] < cons.legMin - TOL || legPs[i] > cons.legMax + TOL) {
      fails.push(`gate4: leg outside stored band [${cons.legMin}, ${cons.legMax}] (${leg.ticker})`);
    }
  });
  if (joint < cons.jointMin - TOL || joint > cons.jointMax + TOL) {
    fails.push(`gate4: joint ${joint} outside stored band [${cons.jointMin}, ${cons.jointMax}]`);
  }
  if ((slip.edge ?? 0) < cons.minEdge - TOL) {
    fails.push(`gate4: edge ${slip.edge} below stored minEdge ${cons.minEdge}`);
  }
  const perSeries = new Map<string, number>();
  for (const leg of legs) {
    const s = seriesOf(leg.ticker);
    perSeries.set(s, (perSeries.get(s) ?? 0) + 1);
  }
  for (const [series, n] of perSeries) {
    if (n > cons.maxLegsPerSeries) fails.push(`gate11: series "${series}" has ${n} legs (max ${cons.maxLegsPerSeries})`);
  }
  for (const group of cons.exclusiveSeries) {
    const present = group.filter((s) => perSeries.has(s));
    if (present.length > 1) fails.push(`gate11: exclusive series together (${present.join(" + ")})`);
  }
  for (let i = 0; i < legCandidates.length; i++) {
    for (let j = i + 1; j < legCandidates.length; j++) {
      const pij = jointProbV3([legCandidates[i], legCandidates[j]], lattice, et, players);
      const cond = pij / Math.min(legPs[i], legPs[j]);
      if (cond > REDUNDANCY_CAP + TOL) {
        fails.push(`gate4: pairwise conditional ${cond.toFixed(6)} above REDUNDANCY_CAP (${legs[i].ticker} × ${legs[j].ticker})`);
      }
    }
  }

  // gate 5: reasoning grammar + byte reproduction
  legs.forEach((leg, i) => {
    const isScorer = legCandidates[i].market.kind === "scorer";
    if (!(isScorer ? SCORER_GRAMMAR : REASONING_GRAMMAR).test(leg.reasoning)) {
      fails.push(`gate5: reasoning fails grammar (${leg.ticker})`);
      return;
    }
    const regenerated = legReasoningV3(legCandidates[i], lattice, et, players, {
      eloDiff: slip.eloDiff as number, homeAbbr: ctx.homeAbbr, awayAbbr: ctx.awayAbbr,
    });
    if (regenerated !== leg.reasoning) fails.push(`gate5: reasoning not reproducible (${leg.ticker})`);
  });

  // gate 10: stored playerModel shares are sane (per team ≤ 1 + tolerance)
  if (players.length > 0) {
    for (const p of players) {
      if (!(p.share > 0) || p.share > 1) fails.push(`gate10: share out of range for ${p.code}`);
    }
  } else if (legCandidates.some((c) => c.market.kind === "scorer")) {
    fails.push("gate10: scorer legs without stored playerModel");
  }

  return fails;
}
