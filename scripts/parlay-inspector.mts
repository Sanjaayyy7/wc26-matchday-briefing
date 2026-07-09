// Parlay inspector: recomputes every locked slip from its stored inputs and
// gates the ledger. Any drift — snapshot membership, parseability, probabilities,
// floors, reasoning bytes, immutability, no-slip records — fails the run.
//
//   npm run parlay:inspect
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { appDir, fixtures } from "./shared.mts";
import { scoreGrid } from "../lib/poisson-model";
import {
  JOINT_FLOOR,
  LEG_FLOOR,
  MAX_LEGS,
  REASONING_GRAMMAR,
  REDUNDANCY_CAP,
  jointProb,
  legProb,
  legReasoning,
  parseMarket,
  type CandidateLeg,
  type KalshiMarket,
} from "../lib/parlay";
import {
  COMBO_SERIES, ENGINE_VERSION_V2, ENGINE_VERSION_V2_1, YES_ONLY_SERIES, halfLattice, jointProbV2,
  legProbV2, legReasoningV2, parseMarketV2, seriesOf, comboImpliedProb as comboImplied, type CandidateLegV2,
} from "../lib/parlay-v2";

const TOL = 1e-9;

type LegRecord = {
  ticker: string;
  side: "yes" | "no";
  title: string;
  modelProb: number;
  kalshiMid: number | null;
  reasoning: string;
};

export type SlipRecord = {
  slug: string;
  lockedAt: string;
  verdict?: "no-slip";
  reason?: string;
  modelDataThrough?: string;
  eloDiff?: number;
  lambdas?: { home: number; away: number };
  rho?: number;
  etWinProbHome?: number;
  legs?: LegRecord[];
  jointProb?: number;
  result?: { legs: Array<{ ticker: string; hit: boolean }>; slipHit: boolean; gradedAt: string };
};

const SLIP_KEYS = new Set([
  "slug", "lockedAt", "modelDataThrough", "eloDiff", "lambdas", "rho",
  "etWinProbHome", "legs", "jointProb", "result",
]);
const RESULT_KEYS = new Set(["legs", "slipHit", "gradedAt"]);

export type SlipRecordV2 = SlipRecord & {
  engineVersion?: string;
  qFirstHalf?: number;
  floors?: { leg: number; joint: number; maxLegs: number };
  comboImpliedProb?: number | null;
  maxLegsPerSeries?: number;
};

const SLIP_KEYS_V2 = new Set([...SLIP_KEYS, "engineVersion", "qFirstHalf", "floors", "comboImpliedProb", "maxLegsPerSeries"]);
const COMBO_SET = new Set<string>(COMBO_SERIES);

export function inspectSlip(
  slip: SlipRecord,
  snapshot: { markets: KalshiMarket[] },
  ctx: { homeAbbr: string; awayAbbr: string },
): string[] {
  const fails: string[] = [];

  // gate 6 (shared): lockedAt sane, record shape immutable-plus-grading only
  if (!slip.lockedAt || new Date(slip.lockedAt).getTime() > Date.now()) {
    fails.push(`gate6: lockedAt missing or in the future (${slip.lockedAt})`);
  }

  if (slip.verdict === "no-slip") {
    // gate 7: no-slip records carry a reason
    if (typeof slip.reason !== "string" || slip.reason.length === 0) {
      fails.push("gate7: no-slip record missing reason string");
    }
    return fails;
  }

  for (const k of Object.keys(slip)) {
    if (!SLIP_KEYS.has(k)) fails.push(`gate6: unexpected slip key "${k}"`);
  }
  if (slip.result) {
    for (const k of Object.keys(slip.result)) {
      if (!RESULT_KEYS.has(k)) fails.push(`gate6: unexpected result key "${k}"`);
    }
  }

  const legs = slip.legs ?? [];
  const bySnapTicker = new Map(snapshot.markets.map((m) => [m.ticker, m]));

  // gate 1: every leg ticker present in the snapshot
  for (const leg of legs) {
    if (!bySnapTicker.has(leg.ticker)) fails.push(`gate1: leg ticker not in snapshot (${leg.ticker})`);
  }

  // gate 2: every leg parseable into a grid predicate
  const candidates: Array<CandidateLeg | null> = legs.map((leg) => {
    const snap = bySnapTicker.get(leg.ticker);
    const parsed = parseMarket(
      snap ?? { ticker: leg.ticker, title: leg.title, yesMid: leg.kalshiMid },
      ctx.homeAbbr,
      ctx.awayAbbr,
    );
    if (!parsed) {
      fails.push(`gate2: leg not parseable (${leg.ticker})`);
      return null;
    }
    return { market: parsed, side: leg.side };
  });
  if (candidates.some((c) => c === null)) return fails;
  const legCandidates = candidates as CandidateLeg[];

  if (
    slip.lambdas === undefined || slip.rho === undefined ||
    slip.etWinProbHome === undefined || slip.jointProb === undefined ||
    slip.eloDiff === undefined
  ) {
    fails.push("gate3: slip missing stored model inputs (lambdas/rho/etWinProbHome/eloDiff/jointProb)");
    return fails;
  }
  const grid = scoreGrid(slip.lambdas.home, slip.lambdas.away, slip.rho);
  const et = slip.etWinProbHome;

  // gate 3: recomputed per-leg and joint probabilities match stored ±1e-9
  legs.forEach((leg, i) => {
    const p = legProb(legCandidates[i], grid, et);
    if (Math.abs(p - leg.modelProb) > TOL) {
      fails.push(`gate3: leg modelProb drift (${leg.ticker}: stored ${leg.modelProb}, recomputed ${p})`);
    }
  });
  const joint = jointProb(legCandidates, grid, et);
  if (Math.abs(joint - slip.jointProb) > TOL) {
    fails.push(`gate3: jointProb drift (stored ${slip.jointProb}, recomputed ${joint})`);
  }

  // gate 4: pre-registered floors and caps, conditionals recomputed in stored order
  if (legs.length < 2 || legs.length > MAX_LEGS) {
    fails.push(`gate4: leg count ${legs.length} outside [2, ${MAX_LEGS}]`);
  }
  legs.forEach((leg, i) => {
    if (legProb(legCandidates[i], grid, et) < LEG_FLOOR - TOL) {
      fails.push(`gate4: leg below LEG_FLOOR (${leg.ticker})`);
    }
  });
  if (joint < JOINT_FLOOR - TOL) fails.push(`gate4: joint ${joint} below JOINT_FLOOR`);
  let running = legCandidates.length > 0 ? legProb(legCandidates[0], grid, et) : 0;
  for (let i = 1; i < legCandidates.length; i++) {
    const j = jointProb(legCandidates.slice(0, i + 1), grid, et);
    const conditional = j / running;
    if (conditional > REDUNDANCY_CAP + TOL) {
      fails.push(`gate4: conditional ${conditional.toFixed(6)} above REDUNDANCY_CAP (${legs[i].ticker})`);
    }
    running = j;
  }

  // gate 5: reasoning matches the grammar and regenerates byte-for-byte
  legs.forEach((leg, i) => {
    if (!REASONING_GRAMMAR.test(leg.reasoning)) {
      fails.push(`gate5: reasoning fails grammar (${leg.ticker})`);
      return;
    }
    const regenerated = legReasoning(legCandidates[i], grid, et, {
      eloDiff: slip.eloDiff as number,
      homeAbbr: ctx.homeAbbr,
      awayAbbr: ctx.awayAbbr,
    });
    if (regenerated !== leg.reasoning) {
      fails.push(`gate5: reasoning not reproducible (${leg.ticker})`);
    }
  });

  return fails;
}

export function inspectSlipV2(
  slip: SlipRecordV2,
  snapshot: { markets: KalshiMarket[] },
  ctx: { homeAbbr: string; awayAbbr: string },
): string[] {
  const fails: string[] = [];

  if (slip.engineVersion !== ENGINE_VERSION_V2 && slip.engineVersion !== ENGINE_VERSION_V2_1) {
    fails.push(`gate8: engineVersion "${slip.engineVersion}" is not "${ENGINE_VERSION_V2}" or "${ENGINE_VERSION_V2_1}"`);
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
    if (!SLIP_KEYS_V2.has(k)) fails.push(`gate6: unexpected slip key "${k}"`);
  }
  if (slip.result) {
    for (const k of Object.keys(slip.result)) {
      if (!RESULT_KEYS.has(k)) fails.push(`gate6: unexpected result key "${k}"`);
    }
  }

  const legs = slip.legs ?? [];
  const bySnapTicker = new Map(snapshot.markets.map((m) => [m.ticker, m]));

  // gate 1 (snapshot membership) + gate 8 (combo eligibility, YES-only MLs)
  for (const leg of legs) {
    if (!bySnapTicker.has(leg.ticker)) fails.push(`gate1: leg ticker not in snapshot (${leg.ticker})`);
    const series = seriesOf(leg.ticker);
    if (!COMBO_SET.has(series)) fails.push(`gate8: series not combo-eligible (${leg.ticker})`);
    if (YES_ONLY_SERIES.has(series) && leg.side !== "yes") fails.push(`gate8: NO side on YES-only series (${leg.ticker})`);
  }

  // gate 2: parseable under the v2 registry
  const candidates: Array<CandidateLegV2 | null> = legs.map((leg) => {
    const snap = bySnapTicker.get(leg.ticker);
    const parsed = parseMarketV2(
      snap ?? { ticker: leg.ticker, title: leg.title, yesMid: leg.kalshiMid },
      ctx.homeAbbr,
      ctx.awayAbbr,
    );
    if (!parsed) {
      fails.push(`gate2: leg not parseable (${leg.ticker})`);
      return null;
    }
    return { market: parsed, side: leg.side };
  });
  if (candidates.some((c) => c === null)) return fails;
  const legCandidates = candidates as CandidateLegV2[];

  if (
    slip.lambdas === undefined || slip.rho === undefined || slip.etWinProbHome === undefined ||
    slip.jointProb === undefined || slip.eloDiff === undefined ||
    slip.qFirstHalf === undefined || slip.floors === undefined
  ) {
    fails.push("gate9: slip missing stored model inputs (lambdas/rho/etWinProbHome/eloDiff/jointProb/qFirstHalf/floors)");
    return fails;
  }
  // v2.1 records must carry their own combo-rule constant (validated by gate 11);
  // legacy v2-combo records predate the rule and are validated without it.
  if (slip.engineVersion === ENGINE_VERSION_V2_1 && slip.maxLegsPerSeries === undefined) {
    fails.push("gate9: v2.1 slip missing stored maxLegsPerSeries");
    return fails;
  }
  const lattice = halfLattice(scoreGrid(slip.lambdas.home, slip.lambdas.away, slip.rho), slip.qFirstHalf);
  const et = slip.etWinProbHome;
  const floors = slip.floors;

  // gate 9 (v2 form of gate 3): lattice reproduction ±1e-9
  legs.forEach((leg, i) => {
    const p = legProbV2(legCandidates[i], lattice, et);
    if (Math.abs(p - leg.modelProb) > TOL) {
      fails.push(`gate9: leg modelProb drift (${leg.ticker}: stored ${leg.modelProb}, recomputed ${p})`);
    }
  });
  const joint = jointProbV2(legCandidates, lattice, et);
  if (Math.abs(joint - slip.jointProb) > TOL) {
    fails.push(`gate9: jointProb drift (stored ${slip.jointProb}, recomputed ${joint})`);
  }

  // gate 4: the slip's OWN stored floors
  if (legs.length < 2 || legs.length > floors.maxLegs) {
    fails.push(`gate4: leg count ${legs.length} outside [2, ${floors.maxLegs}]`);
  }
  legs.forEach((leg, i) => {
    if (legProbV2(legCandidates[i], lattice, et) < floors.leg - TOL) {
      fails.push(`gate4: leg below stored floor (${leg.ticker})`);
    }
  });
  if (joint < floors.joint - TOL) fails.push(`gate4: joint ${joint} below stored floor ${floors.joint}`);
  let running = legCandidates.length > 0 ? legProbV2(legCandidates[0], lattice, et) : 0;
  for (let i = 1; i < legCandidates.length; i++) {
    const j = jointProbV2(legCandidates.slice(0, i + 1), lattice, et);
    const conditional = j / running;
    if (conditional > REDUNDANCY_CAP + TOL) {
      fails.push(`gate4: conditional ${conditional.toFixed(6)} above REDUNDANCY_CAP (${legs[i].ticker})`);
    }
    running = j;
  }

  // gate 11: series uniqueness against the slip's OWN stored rule
  // (Kalshi combo rule: per-event size_max=1; stored as maxLegsPerSeries)
  if (slip.maxLegsPerSeries !== undefined) {
    const perSeries = new Map<string, number>();
    for (const leg of legs) {
      const series = seriesOf(leg.ticker);
      perSeries.set(series, (perSeries.get(series) ?? 0) + 1);
    }
    for (const [series, n] of perSeries) {
      if (n > slip.maxLegsPerSeries) {
        fails.push(`gate11: series "${series}" has ${n} legs (max ${slip.maxLegsPerSeries})`);
      }
    }
  }

  // gate 5: grammar + byte reproduction (v2 generator)
  legs.forEach((leg, i) => {
    if (!REASONING_GRAMMAR.test(leg.reasoning)) {
      fails.push(`gate5: reasoning fails grammar (${leg.ticker})`);
      return;
    }
    const regenerated = legReasoningV2(legCandidates[i], lattice, et, {
      eloDiff: slip.eloDiff as number,
      homeAbbr: ctx.homeAbbr,
      awayAbbr: ctx.awayAbbr,
    });
    if (regenerated !== leg.reasoning) fails.push(`gate5: reasoning not reproducible (${leg.ticker})`);
  });

  // gate 10: combo-implied product re-derives from stored mids
  const expected = comboImplied(legs.map((l) => l.kalshiMid));
  const stored = slip.comboImpliedProb ?? null;
  const match = expected === null ? stored === null : stored !== null && Math.abs(stored - expected) <= TOL;
  if (!match) fails.push(`gate10: comboImpliedProb drift (stored ${stored}, recomputed ${expected})`);

  return fails;
}

const PARLAYS_PATH = path.join(appDir, "data", "parlays.json");
const SNAP_DIR = path.join(appDir, "data", "markets", "parlay-snapshots");

function main(): void {
  if (!existsSync(PARLAYS_PATH)) {
    console.log("no parlays.json yet — nothing to inspect");
    return;
  }
  const slips = JSON.parse(readFileSync(PARLAYS_PATH, "utf8")) as SlipRecordV2[];
  const fx = new Map(fixtures().map((f) => [f.slug, f]));
  let failed = 0;
  for (const slip of slips) {
    const f = fx.get(slip.slug);
    if (!f) {
      console.error(`FAIL ${slip.slug}: unknown fixture slug`);
      failed += 1;
      continue;
    }
    const isV2 = slip.engineVersion === ENGINE_VERSION_V2 || slip.engineVersion === ENGINE_VERSION_V2_1;
    let snapshot: { markets: KalshiMarket[] } = { markets: [] };
    if (slip.verdict !== "no-slip") {
      const suffix = slip.engineVersion === ENGINE_VERSION_V2_1 ? "-v2.1" : isV2 ? "-v2" : "";
      const snapPath = path.join(SNAP_DIR, `${slip.slug}${suffix}.json`);
      if (!existsSync(snapPath)) {
        console.error(`FAIL ${slip.slug}: gate1: snapshot file missing`);
        failed += 1;
        continue;
      }
      snapshot = JSON.parse(readFileSync(snapPath, "utf8"));
    }
    const ctxAbbrs = {
      homeAbbr: f.homeId.toUpperCase(),
      awayAbbr: f.awayId.toUpperCase(),
    };
    const fails = isV2 ? inspectSlipV2(slip, snapshot, ctxAbbrs) : inspectSlip(slip, snapshot, ctxAbbrs);
    if (fails.length === 0) {
      const label = slip.engineVersion === ENGINE_VERSION_V2_1 ? " (v2.1)" : isV2 ? " (v2)" : "";
      console.log(`ok   ${slip.slug}${label}${slip.verdict === "no-slip" ? " (no-slip)" : ""}`);
    } else {
      failed += 1;
      for (const msg of fails) console.error(`FAIL ${slip.slug}: ${msg}`);
    }
  }
  if (failed > 0) {
    console.error(`Parlay inspector: ${failed} of ${slips.length} records failed.`);
    process.exit(1);
  }
  console.log("Parlay inspector passed.");
}

if (process.argv[1] && process.argv[1].endsWith("parlay-inspector.mts")) main();
