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
import { updateElo, HOME_ADVANTAGE } from "../lib/elo";
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
  calibrationWinVerdict,
  ECE_MAX,
} from "../lib/validation";
import { fitRegimeParams, drawRateGap, type GoalSample, type LikRow } from "../lib/regime-params";
import {
  fitStageParamsByStage,
  selectStageParams,
  type StageSample,
  type StageLik,
  type StageFits,
  type FallbackTier,
} from "../lib/stage-regime";
import { indexStageLabels, stageKey, type StageLabelRow } from "../lib/stage-derivation";
import {
  applyFeatureAdjust,
  fitFeatureBetas,
  matchFeatures,
  newFeatureState,
  pushMatch,
  type FeatureBetas,
  type FeatureLikRow,
} from "../lib/feature-signals";
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

  const regimeSamplesAll: Array<{ s: GoalSample; date: string }> = [];
  const regimeLikAll: Array<{ l: LikRow; date: string }> = [];
  const regimeParamCache = new Map<string, ModelParams | null>();
  const regime = newCollector();
  const baseDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
  const regimeDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
  const MIN_REGIME_SAMPLES = 400;
  const MIN_STAGE_SAMPLES = 150;
  const MIN_FEATURE_SAMPLES = 400;

  const featState = newFeatureState();
  const featLikAll: Array<{ l: FeatureLikRow; date: string }> = [];
  const featBetaCache = new Map<string, FeatureBetas | null>();
  const features = newCollector();
  const featuresDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
  const featTierCounts = { features: 0, baseline: 0 };

  const stageLabels = JSON.parse(
    readFileSync(path.join(appDir, "data", "stage-labels.json"), "utf8"),
  ) as { labels: StageLabelRow[] };
  const stageIndex = indexStageLabels(stageLabels.labels);
  const stageOf = (row: Row) => stageIndex.get(stageKey(row.date, row.home, row.away, row.tournament));
  const stageSamplesAll: StageSample[] = [];
  const stageLikAll: StageLik[] = [];
  const stageFitCache = new Map<string, StageFits>();
  const stageAware = newCollector();
  const stageAwareDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
  const tierCounts: Record<FallbackTier, number> = { stage: 0, pooled: 0, baseline: 0 };
  const stageDraw = {
    group: { baseline: [] as Array<{ pDraw: number; isDraw: boolean }>, stageAware: [] as Array<{ pDraw: number; isDraw: boolean }> },
    knockout: { baseline: [] as Array<{ pDraw: number; isDraw: boolean }>, stageAware: [] as Array<{ pDraw: number; isDraw: boolean }> },
  };

  for (const row of rows) {
    const eloH = get(row.home);
    const eloA = get(row.away);
    const rs = rawSplit(params, eloH, eloA, row);
    const o = outcomeOf(row);
    // Read features BEFORE this row is pushed into the tracker (walk-forward).
    const feats = matchFeatures(featState, row);

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

      // Walk-forward regime params: fit on finals-tournament matches strictly
      // before this instance's first match (expanding window), cached per instance.
      let regimeParams = regimeParamCache.get(key);
      if (regimeParams === undefined) {
        const firstDate = row.date;
        const priorS = regimeSamplesAll.filter((q) => q.date < firstDate).map((q) => q.s);
        const priorL = regimeLikAll.filter((q) => q.date < firstDate).map((q) => q.l);
        regimeParams =
          priorL.length >= MIN_REGIME_SAMPLES ? fitRegimeParams(priorS, priorL, 30) : null;
        regimeParamCache.set(key, regimeParams);
      }
      const rgSplit = regimeParams ? rawSplit(regimeParams, eloH, eloA, row) : rs;
      record(regime, rgSplit, o);
      baseDraw.push({ pDraw: rs.draw, isDraw: o === "draw" });
      regimeDraw.push({ pDraw: rgSplit.draw, isDraw: o === "draw" });

      // Stage-aware: per-instance cached stage fits sharing the pooled regime slope.
      let stageFits = stageFitCache.get(key);
      if (stageFits === undefined) {
        const sharedSlope = regimeParams ? regimeParams.eloSlope : null;
        stageFits = fitStageParamsByStage(stageSamplesAll, stageLikAll, row.date, sharedSlope, MIN_STAGE_SAMPLES);
        stageFitCache.set(key, stageFits);
      }
      const stage = stageOf(row);
      const sel = selectStageParams(stage, stageFits, regimeParams, params);
      tierCounts[sel.tier] += 1;
      const saSplit = rawSplit(sel.params, eloH, eloA, row);
      record(stageAware, saSplit, o);
      stageAwareDraw.push({ pDraw: saSplit.draw, isDraw: o === "draw" });

      // Features variant: pooled params, lambdas shifted by rest/form betas
      // fit walk-forward on strictly-prior finals matches (per-instance cache).
      let featBetas = featBetaCache.get(key);
      if (featBetas === undefined) {
        const priorF = featLikAll.filter((q) => q.date < row.date).map((q) => q.l);
        featBetas = priorF.length >= MIN_FEATURE_SAMPLES ? fitFeatureBetas(priorF, params) : null;
        featBetaCache.set(key, featBetas);
      }
      let ftSplit = rs;
      if (featBetas) {
        const l = lambdasFromElo(eloH, eloA, row.neutral, params);
        const adj = applyFeatureAdjust(l, feats, featBetas);
        const s = summarizeGrid(scoreGrid(adj.home, adj.away, params.rho));
        ftSplit = { home: s.home, draw: s.draw, away: s.away };
      }
      featTierCounts[featBetas ? "features" : "baseline"] += 1;
      record(features, ftSplit, o);
      featuresDraw.push({ pDraw: ftSplit.draw, isDraw: o === "draw" });
      if (stage === "group" || stage === "knockout") {
        stageDraw[stage].baseline.push({ pDraw: rs.draw, isDraw: o === "draw" });
        stageDraw[stage].stageAware.push({ pDraw: saSplit.draw, isDraw: o === "draw" });
      }
    }

    // Accumulate this match's pairs AFTER scoring it (never calibrates itself).
    for (const k of ["home", "draw", "away"] as const) {
      calibPairs.push({ p: rs[k], y: (k === o ? 1 : 0) as 0 | 1, date: row.date });
    }

    if (isFinalsTournament(row.tournament) && row.date >= EVAL_FROM) {
      const effH = eloH + (row.neutral ? 0 : HOME_ADVANTAGE);
      const diff = (effH - eloA) / 400;
      regimeSamplesAll.push({ s: { x: diff, goals: row.hs }, date: row.date });
      regimeSamplesAll.push({ s: { x: -diff, goals: row.as }, date: row.date });
      if (row.hs < 9 && row.as < 9) {
        regimeLikAll.push({ l: { diff, hs: row.hs, as: row.as }, date: row.date });
        featLikAll.push({
          l: { diff, hs: row.hs, as: row.as, restF: feats.restF, formF: feats.formF },
          date: row.date,
        });
      }

      const stg = stageOf(row);
      if (stg === "group" || stg === "knockout") {
        stageSamplesAll.push({ x: diff, goals: row.hs, date: row.date, stage: stg });
        stageSamplesAll.push({ x: -diff, goals: row.as, date: row.date, stage: stg });
        if (row.hs < 9 && row.as < 9) stageLikAll.push({ diff, hs: row.hs, as: row.as, date: row.date, stage: stg });
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

    // Feature state accrues over ALL matches (friendlies included) — rest and
    // form are real regardless of competition. Pushed last, after scoring.
    pushMatch(featState, row);
  }

  const baseM = metricsOf(base);
  const plattM = metricsOf(platt);
  const regimeM = metricsOf(regime);
  const baselineDrawGap = drawRateGap(baseDraw);
  const regimeDrawGap = drawRateGap(regimeDraw);

  const stageAwareM = metricsOf(stageAware);
  const stageAwareDrawGap = drawRateGap(stageAwareDraw);
  const stageDrawGaps = {
    group: { baseline: r4(drawRateGap(stageDraw.group.baseline)), stageAware: r4(drawRateGap(stageDraw.group.stageAware)) },
    knockout: { baseline: r4(drawRateGap(stageDraw.knockout.baseline)), stageAware: r4(drawRateGap(stageDraw.knockout.stageAware)) },
  };

  const featuresM = metricsOf(features);
  const featuresDrawGap = drawRateGap(featuresDraw);
  const featPrimary = promotionVerdict(base.brierByMatch, features.brierByMatch, featuresM.ece, {
    n: BOOTSTRAP_N,
    seed: SEED,
  });
  const featSecondary = calibrationWinVerdict(base.brierByMatch, features.brierByMatch, {
    baselineDrawGap,
    challengerDrawGap: featuresDrawGap,
    challengerEce: featuresM.ece,
    n: BOOTSTRAP_N,
    seed: SEED,
  });

  const stagePrimary = promotionVerdict(base.brierByMatch, stageAware.brierByMatch, stageAwareM.ece, {
    n: BOOTSTRAP_N,
    seed: SEED,
  });
  const stageSecondary = calibrationWinVerdict(base.brierByMatch, stageAware.brierByMatch, {
    baselineDrawGap,
    challengerDrawGap: stageAwareDrawGap,
    challengerEce: stageAwareM.ece,
    n: BOOTSTRAP_N,
    seed: SEED,
  });

  // Incumbent = raw model; challenger = Platt-calibrated. ΔBrier>0 ⇒ Platt better.
  const verdict = promotionVerdict(base.brierByMatch, platt.brierByMatch, plattM.ece, {
    n: BOOTSTRAP_N,
    seed: SEED,
  });

  // Primary rule: incumbent = baseline (raw), challenger = regime.
  const primaryRegime = promotionVerdict(base.brierByMatch, regime.brierByMatch, regimeM.ece, {
    n: BOOTSTRAP_N,
    seed: SEED,
  });
  // Secondary rule: calibration win.
  const secondaryRegime = calibrationWinVerdict(base.brierByMatch, regime.brierByMatch, {
    baselineDrawGap,
    challengerDrawGap: regimeDrawGap,
    challengerEce: regimeM.ece,
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
      regime: serializeVariant(regimeM),
      "stage-aware": serializeVariant(stageAwareM),
      features: serializeVariant(featuresM),
    },
    drawGap: { baseline: r4(baselineDrawGap), regime: r4(regimeDrawGap) },
    promotion: {
      incumbent: "baseline",
      challenger: "platt-calibrated",
      ship: verdict.ship,
      deltaBrierCI: { mean: r4(verdict.deltaBrierCI.mean), lo: r4(verdict.deltaBrierCI.lo), hi: r4(verdict.deltaBrierCI.hi) },
      eceOk: verdict.eceOk,
      reason: verdict.reason,
    },
    regimePromotion: {
      incumbent: "baseline",
      challenger: "regime",
      primary: {
        ship: primaryRegime.ship,
        deltaBrierCI: { mean: r4(primaryRegime.deltaBrierCI.mean), lo: r4(primaryRegime.deltaBrierCI.lo), hi: r4(primaryRegime.deltaBrierCI.hi) },
        eceOk: primaryRegime.eceOk,
        reason: primaryRegime.reason,
      },
      secondary: {
        ship: secondaryRegime.ship,
        nonInferior: secondaryRegime.nonInferior,
        drawGapReduced: secondaryRegime.drawGapReduced,
        eceOk: secondaryRegime.eceOk,
        reason: secondaryRegime.reason,
      },
    },
    stageDrawGap: stageDrawGaps,
    fallbackCounts: tierCounts,
    featurePromotion: {
      incumbent: "baseline",
      challenger: "features",
      note: "report-only; rest-days + goal-form lambda multipliers (Phase 3)",
      betasLastInstance: [...featBetaCache.values()].filter(Boolean).at(-1) ?? null,
      fallbackCounts: featTierCounts,
      drawGap: r4(featuresDrawGap),
      primary: {
        ship: featPrimary.ship,
        deltaBrierCI: { mean: r4(featPrimary.deltaBrierCI.mean), lo: r4(featPrimary.deltaBrierCI.lo), hi: r4(featPrimary.deltaBrierCI.hi) },
        eceOk: featPrimary.eceOk,
        reason: featPrimary.reason,
      },
      secondary: {
        ship: featSecondary.ship,
        nonInferior: featSecondary.nonInferior,
        drawGapReduced: featSecondary.drawGapReduced,
        eceOk: featSecondary.eceOk,
        reason: featSecondary.reason,
      },
    },
    stageAwarePromotion: {
      incumbent: "baseline",
      challenger: "stage-aware",
      note: "report-only; not wired to --promote (predict.ts uses single params)",
      primary: {
        ship: stagePrimary.ship,
        deltaBrierCI: { mean: r4(stagePrimary.deltaBrierCI.mean), lo: r4(stagePrimary.deltaBrierCI.lo), hi: r4(stagePrimary.deltaBrierCI.hi) },
        eceOk: stagePrimary.eceOk,
        reason: stagePrimary.reason,
      },
      secondary: {
        ship: stageSecondary.ship,
        nonInferior: stageSecondary.nonInferior,
        drawGapReduced: stageSecondary.drawGapReduced,
        eceOk: stageSecondary.eceOk,
        reason: stageSecondary.reason,
      },
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
  for (const [name, m] of [["baseline", baseM], ["platt-calibrated", plattM], ["regime", regimeM], ["features", featuresM]] as const) {
    console.log(
      `  ${name.padEnd(18)} ${r4(m.brier).toFixed(4)}  [${r4(m.brierCI.lo).toFixed(4)}, ${r4(m.brierCI.hi).toFixed(4)}]  ${r4(m.ece).toFixed(4)}`,
    );
  }
  console.log("");
  console.log(`[validate] ${verdict.reason}`);
  console.log(`[validate] draw-gap  baseline=${r4(baselineDrawGap).toFixed(4)}  regime=${r4(regimeDrawGap).toFixed(4)}`);
  const ruleFired = primaryRegime.ship ? "primary" : secondaryRegime.ship ? "secondary" : null;
  console.log(`[validate] regime rule: ${ruleFired ?? "none fired (HOLD)"}. Re-run with --promote to ship.`);
  const featRule = featPrimary.ship ? "primary" : featSecondary.ship ? "secondary" : null;
  console.log(
    `[validate] features rule: ${featRule ?? "none fired (HOLD)"} ` +
      `(betas latest ${JSON.stringify([...featBetaCache.values()].filter(Boolean).at(-1) ?? null)}, ` +
      `adjusted ${featTierCounts.features}/${featTierCounts.features + featTierCounts.baseline})`,
  );
  console.log(
    `[validate] stage-aware Brier=${r4(stageAwareM.brier).toFixed(4)}  ` +
      `draw-gap group ${stageDrawGaps.group.baseline}->${stageDrawGaps.group.stageAware}  ` +
      `knockout ${stageDrawGaps.knockout.baseline}->${stageDrawGaps.knockout.stageAware}`,
  );
  const stageRule = stagePrimary.ship ? "primary" : stageSecondary.ship ? "secondary" : null;
  console.log(
    `[validate] stage-aware rule: ${stageRule ?? "none fired (HOLD)"} ` +
      `| fallback stage=${tierCounts.stage} pooled=${tierCounts.pooled} baseline=${tierCounts.baseline} (report-only)`,
  );
  console.log(`[validate] wrote ${path.join(dir, "tournament-validation.json")} + validation-report.md`);

  if (process.argv.includes("--promote")) {
    if (!ruleFired) {
      console.error("[validate] --promote refused: neither pre-registered rule fired (HOLD). model.json unchanged.");
      process.exitCode = 3;
    } else {
      const modelPath = path.join(appDir, "data", "model.json");
      const m = JSON.parse(readFileSync(modelPath, "utf8"));
      m.promotion = {
        shipped: true,
        status: "shipped",
        rule: ruleFired,
        deltaBrierCI: { mean: r4(primaryRegime.deltaBrierCI.mean), lo: r4(primaryRegime.deltaBrierCI.lo), hi: r4(primaryRegime.deltaBrierCI.hi) },
        ece: r4(regimeM.ece),
        drawGap: r4(regimeDrawGap),
        harnessGeneratedAt: out.config.generatedAt,
        seed: SEED,
      };
      writeFileSync(modelPath, JSON.stringify(m, null, 1));
      console.log(`[validate] PROMOTED regime params (${ruleFired} rule). model.json.promotion.shipped = true.`);
    }
  }
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
  variants: { baseline: SerializedVariant; "platt-calibrated": SerializedVariant; regime: SerializedVariant; "stage-aware": SerializedVariant; features: SerializedVariant };
  drawGap: { baseline: number; regime: number };
  promotion: {
    incumbent: string;
    challenger: string;
    ship: boolean;
    deltaBrierCI: { mean: number; lo: number; hi: number };
    eceOk: boolean;
    reason: string;
  };
  regimePromotion: {
    incumbent: string;
    challenger: string;
    primary: { ship: boolean; deltaBrierCI: { mean: number; lo: number; hi: number }; eceOk: boolean; reason: string };
    secondary: { ship: boolean; nonInferior: boolean; drawGapReduced: boolean; eceOk: boolean; reason: string };
  };
  stageDrawGap: {
    group: { baseline: number; stageAware: number };
    knockout: { baseline: number; stageAware: number };
  };
  fallbackCounts: Record<FallbackTier, number>;
  featurePromotion: {
    incumbent: string;
    challenger: string;
    note: string;
    betasLastInstance: { betaRest: number; betaForm: number } | null;
    fallbackCounts: { features: number; baseline: number };
    drawGap: number;
    primary: { ship: boolean; deltaBrierCI: { mean: number; lo: number; hi: number }; eceOk: boolean; reason: string };
    secondary: { ship: boolean; nonInferior: boolean; drawGapReduced: boolean; eceOk: boolean; reason: string };
  };
  stageAwarePromotion: {
    incumbent: string;
    challenger: string;
    note: string;
    primary: { ship: boolean; deltaBrierCI: { mean: number; lo: number; hi: number }; eceOk: boolean; reason: string };
    secondary: { ship: boolean; nonInferior: boolean; drawGapReduced: boolean; eceOk: boolean; reason: string };
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
| regime | ${v.regime.brier} | [${v.regime.brierCI.lo}, ${v.regime.brierCI.hi}] | ${v.regime.ece} |
| stage-aware | ${v["stage-aware"].brier} | [${v["stage-aware"].brierCI.lo}, ${v["stage-aware"].brierCI.hi}] | ${v["stage-aware"].ece} |
| features | ${v.features.brier} | [${v.features.brierCI.lo}, ${v.features.brierCI.hi}] | ${v.features.ece} |

**ΔBrier (baseline − platt-calibrated):** mean ${out.promotion.deltaBrierCI.mean},
95% CI [${out.promotion.deltaBrierCI.lo}, ${out.promotion.deltaBrierCI.hi}].

**Verdict:** ${out.promotion.reason}

## Draw-rate calibration

| variant | draw-gap |
| --- | --- |
| baseline | ${out.drawGap.baseline} |
| regime | ${out.drawGap.regime} |

## Regime promotion

- **primary:** ${out.regimePromotion.primary.reason}
- **secondary:** ${out.regimePromotion.secondary.reason}

## Feature-signals promotion (rest-days + goal-form)

- **primary:** ${out.featurePromotion.primary.reason}
- **secondary:** ${out.featurePromotion.secondary.reason}
- fitted betas (latest instance): ${JSON.stringify(out.featurePromotion.betasLastInstance)}
- activation: ${out.featurePromotion.fallbackCounts.features} feature-adjusted / ${out.featurePromotion.fallbackCounts.baseline} baseline fallback
- draw-gap: ${out.featurePromotion.drawGap}

## Stage-aware draw-rate calibration

| stage | baseline draw-gap | stage-aware draw-gap |
| --- | --- | --- |
| group | ${out.stageDrawGap.group.baseline} | ${out.stageDrawGap.group.stageAware} |
| knockout | ${out.stageDrawGap.knockout.baseline} | ${out.stageDrawGap.knockout.stageAware} |

Fallback tiers: stage ${out.fallbackCounts.stage}, pooled ${out.fallbackCounts.pooled}, baseline ${out.fallbackCounts.baseline}.

- **stage-aware primary:** ${out.stageAwarePromotion.primary.reason}
- **stage-aware secondary:** ${out.stageAwarePromotion.secondary.reason}

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
