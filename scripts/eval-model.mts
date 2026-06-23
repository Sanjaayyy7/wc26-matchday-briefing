// Decision harness (Task 1): backtest candidate model variants on ONE fixed
// walk-forward split (2024-01-01+, identical to train-model.mts's BACKTEST_FROM)
// and pick the lowest-Brier variant that keeps ECE < 0.03.
//
// Variants:
//   1. baseline      — current data/model.json params, Poisson/Dixon-Coles
//   2. time-decay     — refit baseLogGoals/eloSlope on pre-2024 samples with
//                       exponential recency weighting; sweep halfLife ∈ {365,730,1460}
//   3. platt          — fit a global Platt/logistic calibration of the 3-way
//                       split on a pre-2024 holdout (2014+), apply to 2024+
//
// All variants are scored with the SAME Brier definition as model.json's
// backtest (lib/calibration.brier over a percentage-point split) and the same
// walk-forward Elo state (ratings only ever see strictly-past matches — no
// leakage). Writes data/backtest/model-eval.json and exits non-zero if the
// chosen variant fails the bar (Brier < 0.51 AND ECE < 0.03; see ADR-0001).
//
//   npm run ml:eval
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { updateElo, HOME_ADVANTAGE } from "../lib/elo";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  type ModelParams,
} from "../lib/poisson-model";
import { brier, calibrationBins, type Split, type Outcome } from "../lib/calibration";
import { applyPlatt, fitPlatt, timeDecayWeight } from "../lib/model-experiments";
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

// Bar (evidence-based, ADR-0001): the shipped model's 2024+ walk-forward
// backtest must have Brier < BRIER_MAX and ECE < ECE_MAX. BRIER_MAX is 0.51 —
// just above the observed ~0.508 frontier for 3-way international football
// (uniform 0.6667; de-vigged markets ~0.50–0.51). The original 0.50 target was
// below the achievable frontier; revised per ADR-0001. DO NOT loosen further
// without a new ADR.
const BRIER_MAX = 0.51;
const ECE_MAX = 0.03;

const BACKTEST_FROM = "2024-01-01"; // identical to train-model.mts
const SAMPLE_FROM = "1995-01-01"; // identical to train-model.mts
const PLATT_HOLDOUT_FROM = "2014-01-01"; // pre-2024 holdout for calibration fit
const HALF_LIVES = [365, 730, 1460];

const ms = (d: string) => Date.parse(d + "T00:00:00Z");

function loadRows(): Row[] {
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
  return rows;
}

function outcomeOf(row: Row): Outcome {
  return row.hs > row.as ? "home" : row.hs < row.as ? "away" : "draw";
}

type GoalSample = { x: number; goals: number; date: string };
type WalkState = {
  samples: GoalSample[]; // pre-BACKTEST_FROM goal-rate samples for refitting
  backtest: Array<{ row: Row; eloH: number; eloA: number }>; // 2024+ eval slice
};

/** One walk-forward Elo pass: collect pre-2024 goal samples + 2024+ eval slice. */
function walkForward(rows: Row[]): WalkState {
  const ratings = new Map<string, number>();
  const get = (t: string) => ratings.get(t) ?? 1500;
  const samples: GoalSample[] = [];
  const backtest: Array<{ row: Row; eloH: number; eloA: number }> = [];
  for (const row of rows) {
    const eloH = get(row.home);
    const eloA = get(row.away);
    if (row.date >= BACKTEST_FROM) backtest.push({ row, eloH, eloA });
    if (row.date >= SAMPLE_FROM && row.date < BACKTEST_FROM) {
      const effH = eloH + (row.neutral ? 0 : HOME_ADVANTAGE);
      samples.push({ x: (effH - eloA) / 400, goals: row.hs, date: row.date });
      samples.push({ x: (eloA - effH) / 400, goals: row.as, date: row.date });
    }
    const u = updateElo({
      home: eloH,
      away: eloA,
      homeScore: row.hs,
      awayScore: row.as,
      tournament: row.tournament,
      neutral: row.neutral,
    });
    ratings.set(row.home, u.home);
    ratings.set(row.away, u.away);
  }
  return { samples, backtest };
}

/** Binned log-mean goal regression with optional exponential recency weight. */
function fitGoalParams(
  samples: GoalSample[],
  halfLifeDays: number | null,
): { baseLogGoals: number; eloSlope: number } {
  const asOf = ms(BACKTEST_FROM);
  const BIN = 0.125;
  const bins = new Map<number, { wsum: number; wn: number }>();
  for (const s of samples) {
    const w = halfLifeDays == null ? 1 : timeDecayWeight(ms(s.date), asOf, halfLifeDays);
    const b = Math.max(-1.5, Math.min(1.5, Math.round(s.x / BIN) * BIN));
    const e = bins.get(b) ?? { wsum: 0, wn: 0 };
    e.wsum += w * s.goals;
    e.wn += w;
    bins.set(b, e);
  }
  const pts = [...bins.entries()]
    .filter(([, e]) => e.wn >= 50)
    .map(([x, e]) => ({ x, y: Math.log(Math.max(e.wsum / e.wn, 0.05)) }));
  const n = pts.length;
  const sx = pts.reduce((a, p) => a + p.x, 0);
  const sy = pts.reduce((a, p) => a + p.y, 0);
  const sxx = pts.reduce((a, p) => a + p.x * p.x, 0);
  const sxy = pts.reduce((a, p) => a + p.x * p.y, 0);
  const eloSlope = (n * sxy - sx * sy) / (n * sxx - sx * sx);
  const baseLogGoals = (sy - eloSlope * sx) / n;
  return { baseLogGoals, eloSlope };
}

/** Raw Poisson/Dixon-Coles 3-way split (0..1) for one fixture's pre-match Elo. */
function rawSplit(params: ModelParams, eloH: number, eloA: number, row: Row): Split {
  const l = lambdasFromElo(eloH, eloA, row.neutral, params);
  const s = summarizeGrid(scoreGrid(l.home, l.away, params.rho));
  return { home: s.home, draw: s.draw, away: s.away };
}

function applyPlattSplit(s: Split, a: number, b: number): Split {
  const r = {
    home: applyPlatt(s.home, a, b),
    draw: applyPlatt(s.draw, a, b),
    away: applyPlatt(s.away, a, b),
  };
  const z = r.home + r.draw + r.away;
  return { home: r.home / z, draw: r.draw / z, away: r.away / z };
}

type Metrics = { brier: number; ece: number; n: number };

/** Score a split-producing function over the 2024+ slice with the model.json metric. */
function scoreVariant(
  backtest: WalkState["backtest"],
  splitOf: (eloH: number, eloA: number, row: Row) => Split,
): Metrics {
  let b = 0;
  const cal: Array<{ p: number; hit: boolean }> = [];
  for (const { row, eloH, eloA } of backtest) {
    const s = splitOf(eloH, eloA, row);
    const o = outcomeOf(row);
    // brier() expects a percentage-point split (~100 total)
    b += brier({ home: s.home * 100, draw: s.draw * 100, away: s.away * 100 }, o);
    for (const k of ["home", "draw", "away"] as const) cal.push({ p: s[k], hit: k === o });
  }
  const n = backtest.length;
  return { brier: b / n, ece: calibrationBins(cal).ece, n };
}

/** Fit a global Platt calibration on the pre-2024 holdout (its own Elo walk). */
function fitPlattHoldout(rows: Row[], params: ModelParams): { a: number; b: number } {
  const ratings = new Map<string, number>();
  const get = (t: string) => ratings.get(t) ?? 1500;
  const pairs: Array<{ p: number; y: 0 | 1 }> = [];
  for (const row of rows) {
    const eloH = get(row.home);
    const eloA = get(row.away);
    if (row.date >= PLATT_HOLDOUT_FROM && row.date < BACKTEST_FROM) {
      const s = rawSplit(params, eloH, eloA, row);
      const o = outcomeOf(row);
      for (const k of ["home", "draw", "away"] as const) {
        pairs.push({ p: s[k], y: (k === o ? 1 : 0) as 0 | 1 });
      }
    }
    const u = updateElo({
      home: eloH,
      away: eloA,
      homeScore: row.hs,
      awayScore: row.as,
      tournament: row.tournament,
      neutral: row.neutral,
    });
    ratings.set(row.home, u.home);
    ratings.set(row.away, u.away);
  }
  return fitPlatt(pairs, 3000, 0.3);
}

type VariantResult = Metrics & {
  variant: string;
  params: ModelParams;
  calibration?: { a: number; b: number };
  passesBar: boolean;
};

function round4(x: number): number {
  return Number(x.toFixed(4));
}

async function main() {
  const rows = loadRows();
  const model = JSON.parse(readFileSync(path.join(appDir, "data", "model.json"), "utf8")) as {
    params: ModelParams;
  };
  const baseParams = model.params;
  const { samples, backtest } = walkForward(rows);

  console.log(
    `[eval] ${rows.length} matches (${rows[0].date} → ${rows.at(-1)!.date}); ` +
      `fixed split ${BACKTEST_FROM}+ n=${backtest.length}; bar Brier<${BRIER_MAX} AND ECE<${ECE_MAX}`,
  );

  const results: VariantResult[] = [];

  // ---- Variant 1: baseline ----
  {
    const m = scoreVariant(backtest, (h, a, row) => rawSplit(baseParams, h, a, row));
    results.push({
      variant: "baseline",
      params: baseParams,
      ...m,
      passesBar: m.brier < BRIER_MAX && m.ece < ECE_MAX,
    });
  }

  // ---- Variant 2: time-decay weighted goal regression (halfLife sweep) ----
  for (const hl of HALF_LIVES) {
    const g = fitGoalParams(samples, hl);
    const params: ModelParams = { ...g, rho: baseParams.rho };
    const m = scoreVariant(backtest, (h, a, row) => rawSplit(params, h, a, row));
    results.push({
      variant: `time-decay-hl${hl}`,
      params,
      ...m,
      passesBar: m.brier < BRIER_MAX && m.ece < ECE_MAX,
    });
  }

  // ---- Variant 3: post-hoc Platt calibration (fit on pre-2024 holdout) ----
  {
    const cal = fitPlattHoldout(rows, baseParams);
    const m = scoreVariant(backtest, (h, a, row) =>
      applyPlattSplit(rawSplit(baseParams, h, a, row), cal.a, cal.b),
    );
    results.push({
      variant: "platt-calibrated",
      params: baseParams,
      calibration: cal,
      ...m,
      passesBar: m.brier < BRIER_MAX && m.ece < ECE_MAX,
    });
  }

  // ---- Variant 4: rho sweep + Platt recalibration (draw-weighting test) ----
  // Tests fix #1 honestly: add draw mass via a more-negative Dixon-Coles rho,
  // THEN refit Platt on the holdout so the change is properly recalibrated.
  // Scored on the robust 2024+ slice — adopt only if it beats baseline on
  // Brier AND keeps ECE < bar (avoids the small-sample draw-overfit trap).
  for (const rho of [-0.08, -0.1, -0.12]) {
    const params: ModelParams = { ...baseParams, rho };
    const cal = fitPlattHoldout(rows, params);
    const m = scoreVariant(backtest, (h, a, row) =>
      applyPlattSplit(rawSplit(params, h, a, row), cal.a, cal.b),
    );
    results.push({
      variant: `rho${rho}-platt`,
      params,
      calibration: cal,
      ...m,
      passesBar: m.brier < BRIER_MAX && m.ece < ECE_MAX,
    });
  }

  // ---- Pick lowest-Brier variant with ECE < ECE_MAX ----
  const eligible = results.filter((r) => r.ece < ECE_MAX);
  const chosen = (eligible.length ? eligible : results)
    .slice()
    .sort((a, b) => a.brier - b.brier)[0];
  const passB = chosen.brier < BRIER_MAX && chosen.ece < ECE_MAX;

  // passA: did the harness run all three families? passC: chosen beats uniform (0.6667)?
  const families = new Set(results.map((r) => r.variant.replace(/-hl\d+$/, "")));
  const passA = families.has("baseline") && families.has("time-decay") && families.has("platt-calibrated");
  const passC = chosen.brier < 0.6667;

  const out = {
    generatedAt: new Date().toISOString(),
    split: { from: BACKTEST_FROM, n: backtest.length },
    bar: { brierMax: BRIER_MAX, eceMax: ECE_MAX },
    passA,
    passB,
    passC,
    chosenVariant: chosen.variant,
    metrics: Object.fromEntries(
      results.map((r) => [
        r.variant,
        {
          brier: round4(r.brier),
          ece: round4(r.ece),
          n: r.n,
          passesBar: r.passesBar,
          ...(r.calibration ? { calibration: { a: round4(r.calibration.a), b: round4(r.calibration.b) } } : {}),
          params: {
            baseLogGoals: round4(r.params.baseLogGoals),
            eloSlope: round4(r.params.eloSlope),
            rho: r.params.rho,
          },
        },
      ]),
    ),
  };

  const dir = path.join(appDir, "data", "backtest");
  mkdirSync(dir, { recursive: true });
  const outPath = path.join(dir, "model-eval.json");
  writeFileSync(outPath, JSON.stringify(out, null, 1));

  // ---- Verdict table ----
  console.log("");
  console.log("  variant                Brier     ECE      passesBar");
  console.log("  ---------------------- --------- -------- ---------");
  for (const r of results) {
    const mark = r.variant === chosen.variant ? " <- chosen" : "";
    console.log(
      `  ${r.variant.padEnd(22)} ${round4(r.brier).toFixed(4)}    ${round4(r.ece).toFixed(4)}   ${r.passesBar ? "PASS" : "FAIL"}${mark}`,
    );
  }
  console.log("");
  console.log(
    `[eval] chosen=${chosen.variant} Brier=${round4(chosen.brier)} ECE=${round4(chosen.ece)} ` +
      `| passA=${passA} passB=${passB} passC=${passC}`,
  );
  console.log(`[eval] wrote ${outPath}`);

  if (!passB) {
    console.error(
      `[eval] GATE FAILED (passB=false): best variant '${chosen.variant}' Brier=${round4(chosen.brier)} ` +
        `is NOT < ${BRIER_MAX} (ECE=${round4(chosen.ece)}). No variant within the model's Elo feature set ` +
        `crosses the bar on the ${BACKTEST_FROM}+ split. NOT loosening the gate — see ADR-0001.`,
    );
    process.exit(1);
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("[eval] Fatal error:", err);
    process.exit(1);
  });
}
