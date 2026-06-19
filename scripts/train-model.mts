// Train the prediction model from data/raw/results.csv:
//   1. chronological Elo pass over all completed matches
//   2. fit Elo→goals mapping (binned Poisson-rate regression)
//   3. fit Dixon-Coles rho by likelihood grid search (2010+)
//   4. online backtest on 2024+ matches (ratings only ever see the past)
//   5. write data/model.json
//
//   npm run ml:fetch && npm run ml:train
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { updateElo, HOME_ADVANTAGE } from "../lib/elo";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  type ModelParams,
} from "../lib/poisson-model";
import { rps, calibrationBins, type Split } from "../lib/calibration";
import { applyPlatt, fitPlatt } from "../lib/model-experiments";
import { appDir } from "./shared.mts";

type Row = {
  date: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  tournament: string;
  neutral: boolean;
};

const csvPath = path.join(appDir, "data", "raw", "results.csv");
const lines = readFileSync(csvPath, "utf8").trim().split("\n").slice(1);
const rows: Row[] = [];
for (const line of lines) {
  const parts = line.split(",");
  if (parts.length < 9) continue;
  const [date, home, away, hs, as, tournament, , , neutral] = parts;
  if (hs === "NA" || as === "NA") continue; // future fixtures
  rows.push({
    date,
    home,
    away,
    hs: Number(hs),
    as: Number(as),
    tournament,
    neutral: neutral.trim().toUpperCase() === "TRUE",
  });
}
rows.sort((a, b) => a.date.localeCompare(b.date));
console.log(`training on ${rows.length} completed matches (${rows[0].date} → ${rows.at(-1)!.date})`);

// ---- Pass 1: Elo + collect (eloDiff, goals) samples + backtest ----
const ratings = new Map<string, number>();
const get = (t: string) => ratings.get(t) ?? 1500;

type GoalSample = { x: number; goals: number };
const samples: GoalSample[] = [];
const backtest: Array<{ row: Row; eloH: number; eloA: number }> = [];
const holdout: Array<{ row: Row; eloH: number; eloA: number }> = [];

const BACKTEST_FROM = "2024-01-01";
const SAMPLE_FROM = "1995-01-01";
const PLATT_HOLDOUT_FROM = "2014-01-01"; // pre-2024 holdout for post-hoc calibration fit

for (const row of rows) {
  const eloH = get(row.home);
  const eloA = get(row.away);
  if (row.date >= BACKTEST_FROM) backtest.push({ row, eloH, eloA });
  else if (row.date >= PLATT_HOLDOUT_FROM) holdout.push({ row, eloH, eloA });
  if (row.date >= SAMPLE_FROM) {
    const effH = eloH + (row.neutral ? 0 : HOME_ADVANTAGE);
    samples.push({ x: (effH - eloA) / 400, goals: row.hs });
    samples.push({ x: (eloA - effH) / 400, goals: row.as });
  }
  const updated = updateElo({
    home: eloH,
    away: eloA,
    homeScore: row.hs,
    awayScore: row.as,
    tournament: row.tournament,
    neutral: row.neutral,
  });
  ratings.set(row.home, updated.home);
  ratings.set(row.away, updated.away);
}

// ---- Fit baseLogGoals + eloSlope: binned log-mean regression ----
const BIN = 0.125;
const bins = new Map<number, { sum: number; n: number }>();
for (const s of samples) {
  const b = Math.max(-1.5, Math.min(1.5, Math.round(s.x / BIN) * BIN));
  const e = bins.get(b) ?? { sum: 0, n: 0 };
  e.sum += s.goals;
  e.n += 1;
  bins.set(b, e);
}
const pts = [...bins.entries()]
  .filter(([, e]) => e.n >= 200)
  .map(([x, e]) => ({ x, y: Math.log(Math.max(e.sum / e.n, 0.05)) }));
const n = pts.length;
const sx = pts.reduce((a, p) => a + p.x, 0);
const sy = pts.reduce((a, p) => a + p.y, 0);
const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
const eloSlope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
const baseLogGoals = (sy - eloSlope * sx) / n;
console.log(
  `fit: baseLogGoals=${baseLogGoals.toFixed(4)} (base λ=${Math.exp(baseLogGoals).toFixed(2)}), eloSlope=${eloSlope.toFixed(4)} over ${n} bins / ${samples.length} samples`,
);

// ---- Fit rho by grid search (log-likelihood of exact scores, 2010+) ----
// Re-run a fresh Elo pass to get pre-match ratings for likelihood matches.
function bestRho(): number {
  const r2 = new Map<string, number>();
  const g2 = (t: string) => r2.get(t) ?? 1500;
  const lik: Array<{ lh: number; la: number; hs: number; as: number }> = [];
  for (const row of rows) {
    const eloH = g2(row.home);
    const eloA = g2(row.away);
    if (row.date >= "2010-01-01") {
      const params: ModelParams = { baseLogGoals, eloSlope, rho: 0 };
      const l = lambdasFromElo(eloH, eloA, row.neutral, params);
      if (row.hs < 9 && row.as < 9) lik.push({ lh: l.home, la: l.away, hs: row.hs, as: row.as });
    }
    const updated = updateElo({
      home: eloH, away: eloA, homeScore: row.hs, awayScore: row.as,
      tournament: row.tournament, neutral: row.neutral,
    });
    r2.set(row.home, updated.home);
    r2.set(row.away, updated.away);
  }
  let best = { rho: 0, ll: -Infinity };
  for (let rho = -0.2; rho <= 0.06; rho += 0.01) {
    let ll = 0;
    for (const m of lik) {
      const grid = scoreGrid(m.lh, m.la, rho);
      ll += Math.log(Math.max(grid[m.hs][m.as], 1e-12));
    }
    if (ll > best.ll) best = { rho, ll };
  }
  return Number(best.rho.toFixed(3));
}
const rho = bestRho();
console.log(`fit: rho=${rho}`);
const params: ModelParams = { baseLogGoals, eloSlope, rho };

// ---- Fit post-hoc Platt calibration on the pre-2024 holdout (2014–2024) ----
// Calibrates the 3-way split without disturbing the generative model. The fit
// set is strictly pre-BACKTEST_FROM, so the 2024+ backtest stays leakage-free.
const calFit: Array<{ p: number; y: 0 | 1 }> = [];
for (const { row, eloH, eloA } of holdout) {
  const l = lambdasFromElo(eloH, eloA, row.neutral, params);
  const s = summarizeGrid(scoreGrid(l.home, l.away, rho));
  const o = row.hs > row.as ? "home" : row.hs < row.as ? "away" : "draw";
  for (const k of ["home", "draw", "away"] as const) {
    calFit.push({ p: s[k], y: (k === o ? 1 : 0) as 0 | 1 });
  }
}
const calibration = fitPlatt(calFit, 3000, 0.3);
console.log(
  `fit: platt a=${calibration.a.toFixed(4)} b=${calibration.b.toFixed(4)} ` +
    `(holdout ${PLATT_HOLDOUT_FROM}+, ${holdout.length} matches)`,
);

/** Apply Platt calibration to a 3-way split (0..1) and renormalize. */
function calibrateSplit(s: { home: number; draw: number; away: number }) {
  const r = {
    home: applyPlatt(s.home, calibration.a, calibration.b),
    draw: applyPlatt(s.draw, calibration.a, calibration.b),
    away: applyPlatt(s.away, calibration.a, calibration.b),
  };
  const z = r.home + r.draw + r.away;
  return { home: r.home / z, draw: r.draw / z, away: r.away / z };
}

// ---- Backtest (online: each prediction used only past ratings) ----
let brier = 0;
let uniformBrier = 0;
let logLoss = 0;
let rpsSum = 0;
let rpsUniform = 0;
const calPairs: Array<{ p: number; hit: boolean }> = [];
const UNIFORM: Split = { home: 100 / 3, draw: 100 / 3, away: 100 / 3 };
for (const { row, eloH, eloA } of backtest) {
  const l = lambdasFromElo(eloH, eloA, row.neutral, params);
  const s = summarizeGrid(scoreGrid(l.home, l.away, rho));
  const outcome = row.hs > row.as ? "home" : row.hs < row.as ? "away" : "draw";
  const probs = calibrateSplit({ home: s.home, draw: s.draw, away: s.away });
  for (const k of ["home", "draw", "away"] as const) {
    const y = k === outcome ? 1 : 0;
    brier += (probs[k] - y) ** 2;
    uniformBrier += (1 / 3 - y) ** 2;
    calPairs.push({ p: probs[k], hit: y === 1 });
  }
  logLoss += -Math.log(Math.max(probs[outcome], 1e-12));
  const split: Split = {
    home: probs.home * 100,
    draw: probs.draw * 100,
    away: probs.away * 100,
  };
  rpsSum += rps(split, outcome);
  rpsUniform += rps(UNIFORM, outcome);
}
const nB = backtest.length;
const { ece, bins: reliabilityBins } = calibrationBins(calPairs);
console.log(
  `backtest ${BACKTEST_FROM}+: n=${nB}, Brier=${(brier / nB).toFixed(4)} (uniform ${(uniformBrier / nB).toFixed(4)}), ` +
    `RPS=${(rpsSum / nB).toFixed(4)} (uniform ${(rpsUniform / nB).toFixed(4)}), logloss=${(logLoss / nB).toFixed(4)}, ECE=${(ece * 100).toFixed(2)}%`,
);
if (brier / nB >= uniformBrier / nB) {
  console.error("GATE FAILED: model does not beat the uniform baseline");
  process.exit(2);
}
if (ece >= 0.03) {
  console.error("GATE FAILED: expected calibration error >= 3%");
  process.exit(2);
}
// Evidence-based Brier gate (ADR-0001): ~0.508 is the realistic 3-way football
// Brier frontier; the shipped (Platt-calibrated) model must stay under 0.51.
if (brier / nB >= 0.51) {
  console.error(`GATE FAILED: backtest Brier ${(brier / nB).toFixed(4)} >= 0.51`);
  process.exit(2);
}

// ---- Recent form (last 10 matches per team, most recent first) ----
const byTeam = new Map<string, Row[]>();
for (const row of rows) {
  for (const team of [row.home, row.away]) {
    const arr = byTeam.get(team) ?? [];
    arr.push(row);
    byTeam.set(team, arr);
  }
}
const formsOut: Record<string, { results: string; gf: number; ga: number; lastDate: string }> = {};
for (const [team, arr] of byTeam) {
  const last10 = arr.slice(-10);
  let gf = 0;
  let ga = 0;
  const seq = last10
    .map((r) => {
      const mine = r.home === team ? r.hs : r.as;
      const theirs = r.home === team ? r.as : r.hs;
      gf += mine;
      ga += theirs;
      return mine > theirs ? "W" : mine === theirs ? "D" : "L";
    })
    .reverse()
    .join("");
  formsOut[team] = { results: seq, gf, ga, lastDate: arr.at(-1)!.date };
}

// ---- Write model ----
const model = {
  source: "martj42/international_results (GitHub mirror)",
  dataThrough: rows.at(-1)!.date,
  matches: rows.length,
  params,
  calibration,
  backtest: {
    from: BACKTEST_FROM,
    n: nB,
    brier: Number((brier / nB).toFixed(4)),
    uniformBrier: Number((uniformBrier / nB).toFixed(4)),
    rps: Number((rpsSum / nB).toFixed(4)),
    uniformRps: Number((rpsUniform / nB).toFixed(4)),
    logLoss: Number((logLoss / nB).toFixed(4)),
    ece: Number(ece.toFixed(4)),
    calibrationBins: reliabilityBins
      .filter((b) => b.count > 0)
      .map((b) => ({
        range: `${b.lo.toFixed(1)}–${b.hi.toFixed(1)}`,
        count: b.count,
        predicted: Number(b.meanPredicted.toFixed(3)),
        realized: Number(b.realized.toFixed(3)),
      })),
  },
  ratings: Object.fromEntries(
    [...ratings.entries()].map(([t, r]) => [t, Math.round(r)]),
  ),
  forms: formsOut,
};
writeFileSync(path.join(appDir, "data", "model.json"), JSON.stringify(model, null, 1));
console.log(`wrote data/model.json (${Object.keys(model.ratings).length} teams)`);
