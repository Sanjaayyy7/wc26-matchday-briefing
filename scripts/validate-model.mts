// Tournament-holdout validation harness (ml:validate).
//
// Scores model variants on FINALS-TOURNAMENT matches (World Cup / Euro / Copa /
// AFCON / Asian Cup) — the regime that actually resembles WC2026 — walk-forward
// (ratings + calibration only ever see strictly-past matches, no leakage) and
// emits bootstrap CIs, a reliability diagram, and a CI-gated promotion verdict.
//
// Unlike ml:eval (a 2024+ time split dominated by friendlies), this measures the
// model on the high-stakes, draw-heavy, neutral-venue regime, with statistically
// honest confidence intervals that stop small-sample false positives.
//
//   npm run ml:validate
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { updateElo } from "../lib/elo";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  type ModelParams,
} from "../lib/poisson-model";
import {
  brier,
  calibrationBins,
  type Split,
  type Outcome,
  type CalibrationBin,
} from "../lib/calibration";
import { applyPlatt, fitPlatt } from "../lib/model-experiments";
import { bootstrapCI } from "../lib/backtest-metrics";
import {
  isFinalsTournament,
  FINALS_TOURNAMENTS,
  promotionVerdict,
  ECE_MAX,
} from "../lib/validation";
import { appDir } from "./shared.mts";

const EVAL_FROM = "1990-01-01"; // modern era: mature Elo, plentiful prior calibration data
const PLATT_WINDOW_YEARS = 8; // trailing window for per-instance Platt fit
const BOOTSTRAP_N = 5000;
const SEED = 42;

type Row = {
  date: string;
  home: string;
  away: string;
  hs: number;
  as: number;
  tournament: string;
  neutral: boolean;
};

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

const outcomeOf = (row: Row): Outcome =>
  row.hs > row.as ? "home" : row.hs < row.as ? "away" : "draw";

function rawSplit(params: ModelParams, eloH: number, eloA: number, row: Row): Split {
  const l = lambdasFromElo(eloH, eloA, row.neutral, params);
  const s = summarizeGrid(scoreGrid(l.home, l.away, params.rho));
  return { home: s.home, draw: s.draw, away: s.away };
}

function applyPlattSplit(s: Split, a: number, b: number): Split {
  const r = { home: applyPlatt(s.home, a, b), draw: applyPlatt(s.draw, a, b), away: applyPlatt(s.away, a, b) };
  const z = r.home + r.draw + r.away;
  return { home: r.home / z, draw: r.draw / z, away: r.away / z };
}

const brierPP = (s: Split, o: Outcome) =>
  brier({ home: s.home * 100, draw: s.draw * 100, away: s.away * 100 }, o);

type Collector = { brierByMatch: number[]; cal: Array<{ p: number; hit: boolean }> };
const newCollector = (): Collector => ({ brierByMatch: [], cal: [] });

function record(c: Collector, s: Split, o: Outcome): void {
  c.brierByMatch.push(brierPP(s, o));
  for (const k of ["home", "draw", "away"] as const) c.cal.push({ p: s[k], hit: k === o });
}

type VariantMetrics = {
  brier: number;
  brierCI: { lo: number; hi: number };
  ece: number;
  n: number;
  reliability: CalibrationBin[];
};

function metricsOf(c: Collector): VariantMetrics {
  const mean = c.brierByMatch.reduce((a, b) => a + b, 0) / c.brierByMatch.length;
  const ci = bootstrapCI(c.brierByMatch, BOOTSTRAP_N, SEED);
  const { bins, ece } = calibrationBins(c.cal);
  return { brier: mean, brierCI: { lo: ci.lo, hi: ci.hi }, ece, n: c.brierByMatch.length, reliability: bins };
}

const r4 = (x: number) => Number(x.toFixed(4));
const yearOf = (date: string) => date.slice(0, 4);

async function main() {
  const rows = loadRows();
  const model = JSON.parse(readFileSync(path.join(appDir, "data", "model.json"), "utf8")) as {
    params: ModelParams;
  };
  const params = model.params;

  const ratings = new Map<string, number>();
  const get = (t: string) => ratings.get(t) ?? 1500;

  // Strictly-prior (predicted-prob, hit) pairs with dates, for per-instance Platt fits.
  const calibPairs: Array<{ p: number; y: 0 | 1; date: string }> = [];
  const plattCache = new Map<string, { a: number; b: number }>();

  const base = newCollector();
  const platt = newCollector();
  const byTournament = new Map<string, number>();

  for (const row of rows) {
    const eloH = get(row.home);
    const eloA = get(row.away);
    const rs = rawSplit(params, eloH, eloA, row);
    const o = outcomeOf(row);

    if (isFinalsTournament(row.tournament) && row.date >= EVAL_FROM) {
      const key = `${row.tournament}:${yearOf(row.date)}`;
      let cal = plattCache.get(key);
      if (!cal) {
        // Fit Platt on the trailing window strictly BEFORE this instance's first match.
        const cutoff = `${Number(yearOf(row.date)) - PLATT_WINDOW_YEARS}-01-01`;
        const window = calibPairs.filter((q) => q.date >= cutoff);
        cal = fitPlatt(window.map((q) => ({ p: q.p, y: q.y })), 3000, 0.3);
        plattCache.set(key, cal);
      }
      record(base, rs, o);
      record(platt, applyPlattSplit(rs, cal.a, cal.b), o);
      byTournament.set(row.tournament, (byTournament.get(row.tournament) ?? 0) + 1);
    }

    // Accumulate this match's pairs AFTER scoring it (never calibrates itself).
    for (const k of ["home", "draw", "away"] as const) {
      calibPairs.push({ p: rs[k], y: (k === o ? 1 : 0) as 0 | 1, date: row.date });
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

  const baseM = metricsOf(base);
  const plattM = metricsOf(platt);
  // Incumbent = raw model; challenger = Platt-calibrated. ΔBrier>0 ⇒ Platt better.
  const verdict = promotionVerdict(base.brierByMatch, platt.brierByMatch, plattM.ece, {
    n: BOOTSTRAP_N,
    seed: SEED,
  });

  const config = {
    generatedAt: new Date().toISOString(),
    evalFrom: EVAL_FROM,
    holdoutLabels: [...FINALS_TOURNAMENTS],
    plattWindowYears: PLATT_WINDOW_YEARS,
    bootstrapSamples: BOOTSTRAP_N,
    seed: SEED,
    eceMax: ECE_MAX,
    promotionRule: "ship iff ΔBrier(incumbent−challenger) 95% bootstrap CI > 0 AND challenger ECE < eceMax",
  };

  const out = {
    config,
    holdout: {
      n: base.brierByMatch.length,
      byTournament: Object.fromEntries([...byTournament].sort((a, b) => b[1] - a[1])),
    },
    variants: {
      baseline: serializeVariant(baseM),
      "platt-calibrated": serializeVariant(plattM),
    },
    promotion: {
      incumbent: "baseline",
      challenger: "platt-calibrated",
      ship: verdict.ship,
      deltaBrierCI: { mean: r4(verdict.deltaBrierCI.mean), lo: r4(verdict.deltaBrierCI.lo), hi: r4(verdict.deltaBrierCI.hi) },
      eceOk: verdict.eceOk,
      reason: verdict.reason,
    },
  };

  const dir = path.join(appDir, "docs", "validation");
  mkdirSync(dir, { recursive: true });
  writeFileSync(path.join(dir, "tournament-validation.json"), JSON.stringify(out, null, 2));
  writeFileSync(path.join(dir, "validation-report.md"), renderReport(out));

  // ---- Console summary ----
  console.log(
    `[validate] holdout n=${out.holdout.n} finals-tournament matches (${EVAL_FROM}+), ` +
      `${plattCache.size} tournament instances`,
  );
  console.log("");
  console.log("  variant            Brier    95% CI              ECE");
  console.log("  ------------------ -------- ------------------- -------");
  for (const [name, m] of [["baseline", baseM], ["platt-calibrated", plattM]] as const) {
    console.log(
      `  ${name.padEnd(18)} ${r4(m.brier).toFixed(4)}  [${r4(m.brierCI.lo).toFixed(4)}, ${r4(m.brierCI.hi).toFixed(4)}]  ${r4(m.ece).toFixed(4)}`,
    );
  }
  console.log("");
  console.log(`[validate] ${verdict.reason}`);
  console.log(`[validate] wrote ${path.join(dir, "tournament-validation.json")} + validation-report.md`);
}

function serializeVariant(m: VariantMetrics) {
  return {
    brier: r4(m.brier),
    brierCI: { lo: r4(m.brierCI.lo), hi: r4(m.brierCI.hi) },
    ece: r4(m.ece),
    n: m.n,
    reliability: m.reliability.map((b) => ({
      meanPredicted: r4(b.meanPredicted),
      realized: r4(b.realized),
      count: b.count,
    })),
  };
}

type SerializedVariant = ReturnType<typeof serializeVariant>;
type Out = {
  config: {
    generatedAt: string;
    evalFrom: string;
    holdoutLabels: string[];
    plattWindowYears: number;
    bootstrapSamples: number;
    seed: number;
    eceMax: number;
    promotionRule: string;
  };
  holdout: { n: number; byTournament: Record<string, number> };
  variants: { baseline: SerializedVariant; "platt-calibrated": SerializedVariant };
  promotion: {
    incumbent: string;
    challenger: string;
    ship: boolean;
    deltaBrierCI: { mean: number; lo: number; hi: number };
    eceOk: boolean;
    reason: string;
  };
};

function renderReport(out: Out): string {
  const v = out.variants;
  const reliabilityRows = v["platt-calibrated"].reliability
    .filter((b) => b.count > 0)
    .map(
      (b) =>
        `| ${b.meanPredicted.toFixed(3)} | ${b.realized.toFixed(3)} | ${b.count} |`,
    )
    .join("\n");
  const compRows = Object.entries(out.holdout.byTournament)
    .map(([t, n]) => `| ${t} | ${n} |`)
    .join("\n");
  return `# Tournament-Holdout Validation Report

_Generated ${out.config.generatedAt}. Do not edit by hand — produced by \`npm run ml:validate\`._

## What this measures

Model variants scored on **finals-tournament matches** (${out.config.holdoutLabels.join(", ")}),
from ${out.config.evalFrom}, **walk-forward**: Elo and Platt calibration only ever see matches
strictly before the one being scored. This is the World-Cup-like regime — neutral venues,
high stakes, more draws — not the friendly-dominated time split that \`ml:eval\` uses.

Holdout: **${out.holdout.n} matches**.

## Promotion rule (pre-registered)

> ${out.config.promotionRule} (eceMax = ${out.config.eceMax}).

A challenger ships only if its Brier improvement is **statistically real** (95% bootstrap CI of
ΔBrier excludes zero, ${out.config.bootstrapSamples} resamples, seed ${out.config.seed}) **and** it stays
calibrated. This is the rule that correctly rejects small-sample "wins" within variance.

## Results

| variant | Brier | 95% CI | ECE |
| --- | --- | --- | --- |
| baseline (raw model) | ${v.baseline.brier} | [${v.baseline.brierCI.lo}, ${v.baseline.brierCI.hi}] | ${v.baseline.ece} |
| platt-calibrated | ${v["platt-calibrated"].brier} | [${v["platt-calibrated"].brierCI.lo}, ${v["platt-calibrated"].brierCI.hi}] | ${v["platt-calibrated"].ece} |

**ΔBrier (baseline − platt-calibrated):** mean ${out.promotion.deltaBrierCI.mean},
95% CI [${out.promotion.deltaBrierCI.lo}, ${out.promotion.deltaBrierCI.hi}].

**Verdict:** ${out.promotion.reason}

## Reliability — platt-calibrated (per-outcome)

| mean predicted | realized | count |
| --- | --- | --- |
${reliabilityRows}

## Holdout composition

| tournament | matches |
| --- | --- |
${compRows}
`;
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) {
  main().catch((err) => {
    console.error("[validate] Fatal error:", err);
    process.exit(1);
  });
}
