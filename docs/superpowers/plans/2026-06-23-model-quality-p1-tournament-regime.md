# Model Quality Phase 1 — Tournament-Regime Model + `model:inspect` Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fit a tournament-regime parameter set that fixes the model's draw-blindness, validate it walk-forward through the merged harness under pre-registered rules, promote it into live inference only on a real verdict, and add a `model:inspect` build gate.

**Architecture:** A new pure module (`lib/regime-params.ts`) extracts the existing Elo→goals + rho fit so both the trainer and the harness can fit a tournament-only parameter set. `train-model.mts` writes that set + a `promotion` provenance block into `model.json`. `validate-model.mts` adds a walk-forward `regime` variant (per-tournament-instance fit, leakage-safe) and evaluates both pre-registered promotion rules. `predict.ts` selects regime params only when `promotion.shipped`. `model-inspector.mts` (pure `inspectModel` + CLI guard, mirroring `design-inspector.mts`) gates the build.

**Tech Stack:** TypeScript (strict), Node `tsx` for `.mts` scripts, Vitest, ESLint flat config. Pure functions in `lib/`, executable harnesses in `scripts/`.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-23-model-quality-phase1-tournament-regime-design.md`.
- Promotion rules (verbatim): **primary** — ship iff ΔBrier(incumbent−regime) 95% bootstrap CI > 0 (B=5000, seed=42) AND regime ECE < 0.03; **secondary** — ship iff ΔBrier 95% CI lower bound ≥ −δ (δ = 0.005) AND draw-gap reduced ≥ 5pp AND ECE < 0.03.
- Reuse, do not reinvent: `bootstrapCI` (`lib/backtest-metrics`), `fitPlatt`/`applyPlatt` (`lib/model-experiments`), `brier`/`calibrationBins` (`lib/calibration`), `lambdasFromElo`/`scoreGrid`/`summarizeGrid` (`lib/poisson-model`), `isFinalsTournament`/`FINALS_TOURNAMENTS`/`promotionVerdict`/`pairedDeltaBrierCI`/`ECE_MAX` (`lib/validation`), `HOME_ADVANTAGE`/`updateElo` (`lib/elo`).
- Data safety: NEVER `npm run ml:fetch` / `matchday` (wipes seeded `data/raw/results.csv`). `ml:train` and `ml:validate` read `results.csv` read-only — both safe.
- `model.json` must equal `ml:train` output for the current `results.csv` (reproducibility). NOTE (decision 2026-06-24): `results.csv` legitimately advanced to Jun-22 seeded WC26 finals after the committed model was trained (Jun-12), so `ml:train` refreshes the global model on current data — this **refresh is accepted**. The global fit *code* is unchanged (drift is 4th-decimal; rho unchanged); `regimeParams` + `promotion` are added on top. Locked `predictions.json` immutability and the `/record` accountability are unaffected.
- `predict.ts` must fall back to global `params` when `regimeParams`/`promotion` are absent or `promotion.shipped !== true`.
- Locked `data/predictions.json` entries are immutable; their immutability stays enforced by `inspect:execution` + the existing byte-identical test, NOT by `model:inspect`.
- Gates before commit: `npm test` · `npm run lint` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`. `ml:validate` is run manually (offline, not a commit gate).
- Never `git add -A`; add by explicit path. One logical commit per task. No `Co-Authored-By` trailer.

---

### Task 1: `lib/regime-params.ts` — pure parameter fit + draw-gap diagnostic

**Files:**
- Create: `lib/regime-params.ts`
- Test: `tests/regime-params.test.ts`

**Interfaces:**
- Consumes: `scoreGrid`, `type ModelParams` from `lib/poisson-model`.
- Produces:
  - `type GoalSample = { x: number; goals: number }`
  - `type LikRow = { diff: number; hs: number; as: number }`
  - `fitBaseAndSlope(samples: GoalSample[], minBinCount?: number): { baseLogGoals: number; eloSlope: number }`
  - `fitRho(likRows: LikRow[], baseLogGoals: number, eloSlope: number): number`
  - `fitRegimeParams(samples: GoalSample[], likRows: LikRow[], minBinCount?: number): ModelParams`
  - `drawRateGap(rows: Array<{ pDraw: number; isDraw: boolean }>): number`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/regime-params.test.ts
import { describe, it, expect } from "vitest";
import {
  fitBaseAndSlope,
  fitRho,
  fitRegimeParams,
  drawRateGap,
  type GoalSample,
  type LikRow,
} from "../lib/regime-params";

// Build goal samples whose per-bin mean follows goals = exp(base + slope*x).
function syntheticSamples(base: number, slope: number, perBin = 400): GoalSample[] {
  const out: GoalSample[] = [];
  for (let x = -1.5; x <= 1.5 + 1e-9; x += 0.125) {
    const mean = Math.exp(base + slope * x);
    for (let i = 0; i < perBin; i++) out.push({ x, goals: mean });
  }
  return out;
}

describe("fitBaseAndSlope", () => {
  it("recovers known base and slope from synthetic samples", () => {
    const { baseLogGoals, eloSlope } = fitBaseAndSlope(syntheticSamples(0.2, 0.8));
    expect(baseLogGoals).toBeCloseTo(0.2, 1);
    expect(eloSlope).toBeCloseTo(0.8, 1);
  });

  it("throws when too few bins are populated", () => {
    expect(() => fitBaseAndSlope([{ x: 0, goals: 1 }], 200)).toThrow();
  });
});

describe("fitRho", () => {
  it("returns a more-negative rho on a draw-heavy sample than a goal-heavy one", () => {
    const drawHeavy: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 1, as: 1 })));
    const goalHeavy: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 2, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 2 })));
    const rhoDraw = fitRho(drawHeavy, Math.log(1.2), 0.8);
    const rhoGoal = fitRho(goalHeavy, Math.log(1.2), 0.8);
    expect(rhoDraw).toBeLessThan(rhoGoal);
  });

  it("stays inside the search grid", () => {
    const rho = fitRho([{ diff: 0, hs: 1, as: 1 }], Math.log(1.3), 0.85);
    expect(rho).toBeGreaterThanOrEqual(-0.2);
    expect(rho).toBeLessThanOrEqual(0.06);
  });
});

describe("fitRegimeParams", () => {
  it("returns all three params with a lower minBinCount for small regimes", () => {
    const p = fitRegimeParams(syntheticSamples(0.1, 0.7, 60), [{ diff: 0, hs: 1, as: 1 }], 50);
    expect(p.baseLogGoals).toBeCloseTo(0.1, 1);
    expect(p.eloSlope).toBeCloseTo(0.7, 1);
    expect(typeof p.rho).toBe("number");
  });
});

describe("drawRateGap", () => {
  it("is the absolute gap between mean predicted draw prob and observed draw rate", () => {
    const rows = [
      { pDraw: 0.2, isDraw: true },
      { pDraw: 0.2, isDraw: false },
      { pDraw: 0.2, isDraw: false },
      { pDraw: 0.2, isDraw: false },
    ];
    // mean pred 0.2, observed 0.25 → gap 0.05
    expect(drawRateGap(rows)).toBeCloseTo(0.05, 6);
  });

  it("returns 0 for an empty input", () => {
    expect(drawRateGap([])).toBe(0);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/regime-params.test.ts`
Expected: FAIL — `Cannot find module '../lib/regime-params'`.

- [ ] **Step 3: Implement `lib/regime-params.ts`**

```typescript
// lib/regime-params.ts
//
// Pure parameter-fitting primitives shared by the trainer (scripts/train-model.mts)
// and the tournament-holdout harness (scripts/validate-model.mts). Extracting the
// Elo→goals regression and the Dixon-Coles rho grid search here lets both fit a
// regime-specific parameter set without duplicating the math. No I/O.
import { scoreGrid, type ModelParams } from "./poisson-model";

export type GoalSample = { x: number; goals: number };
export type LikRow = { diff: number; hs: number; as: number };

const BIN = 0.125;

/** Binned log-mean regression of goals on (own−opp Elo)/400. `minBinCount`
 *  drops sparse bins; the global trainer uses 200, regime fits use a lower value
 *  because the tournament-only sample is smaller. */
export function fitBaseAndSlope(
  samples: GoalSample[],
  minBinCount = 200,
): { baseLogGoals: number; eloSlope: number } {
  const bins = new Map<number, { sum: number; n: number }>();
  for (const s of samples) {
    const b = Math.max(-1.5, Math.min(1.5, Math.round(s.x / BIN) * BIN));
    const e = bins.get(b) ?? { sum: 0, n: 0 };
    e.sum += s.goals;
    e.n += 1;
    bins.set(b, e);
  }
  const pts = [...bins.entries()]
    .filter(([, e]) => e.n >= minBinCount)
    .map(([x, e]) => ({ x, y: Math.log(Math.max(e.sum / e.n, 0.05)) }));
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
    if (ll > best.ll) best = { rho, ll };
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

/** |mean predicted P(draw) − observed draw frequency| over a set of scored matches. */
export function drawRateGap(rows: Array<{ pDraw: number; isDraw: boolean }>): number {
  if (rows.length === 0) return 0;
  const meanPred = rows.reduce((a, r) => a + r.pDraw, 0) / rows.length;
  const obs = rows.filter((r) => r.isDraw).length / rows.length;
  return Math.abs(meanPred - obs);
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/regime-params.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/regime-params.ts tests/regime-params.test.ts
git commit -m "feat(model): pure tournament-regime parameter fit + draw-gap diagnostic"
```

---

### Task 2: `lib/validation.ts` — secondary calibration-win rule

**Files:**
- Modify: `lib/validation.ts`
- Test: `tests/validation.test.ts` (extend)

**Interfaces:**
- Consumes: existing `pairedDeltaBrierCI`, `ECE_MAX` from `lib/validation`.
- Produces:
  - `type CalibrationWinVerdict = { ship: boolean; nonInferior: boolean; drawGapReduced: boolean; eceOk: boolean; reason: string }`
  - `NONINFERIORITY_MARGIN = 0.005`
  - `MIN_DRAW_GAP_REDUCTION = 0.05`
  - `calibrationWinVerdict(incumbentBrier: number[], challengerBrier: number[], opts: { baselineDrawGap: number; challengerDrawGap: number; challengerEce: number; n?: number; seed?: number; eceMax?: number; margin?: number; minDrawGapReduction?: number }): CalibrationWinVerdict`

- [ ] **Step 1: Write the failing tests (append to `tests/validation.test.ts`)**

```typescript
// append to tests/validation.test.ts
import { calibrationWinVerdict } from "../lib/validation";

describe("calibrationWinVerdict", () => {
  // Brier-neutral arrays: identical per-match Brier → ΔBrier CI centered on 0.
  const neutral = Array.from({ length: 200 }, (_, i) => 0.4 + (i % 5) * 0.02);

  it("ships when Brier is non-inferior, draw-gap drops ≥5pp, and ECE is in bound", () => {
    const v = calibrationWinVerdict(neutral, neutral, {
      baselineDrawGap: 0.15,
      challengerDrawGap: 0.04, // 11pp reduction
      challengerEce: 0.01,
    });
    expect(v.ship).toBe(true);
    expect(v.nonInferior).toBe(true);
    expect(v.drawGapReduced).toBe(true);
    expect(v.eceOk).toBe(true);
  });

  it("holds when the draw-gap reduction is under the threshold", () => {
    const v = calibrationWinVerdict(neutral, neutral, {
      baselineDrawGap: 0.15,
      challengerDrawGap: 0.13, // only 2pp
      challengerEce: 0.01,
    });
    expect(v.ship).toBe(false);
    expect(v.drawGapReduced).toBe(false);
  });

  it("holds when ECE breaches the ceiling", () => {
    const v = calibrationWinVerdict(neutral, neutral, {
      baselineDrawGap: 0.15,
      challengerDrawGap: 0.02,
      challengerEce: 0.05,
    });
    expect(v.ship).toBe(false);
    expect(v.eceOk).toBe(false);
  });

  it("holds when the challenger is materially worse on Brier (below the margin)", () => {
    // challenger worse by ~0.05 per match → ΔBrier strongly negative, below −δ
    const worse = neutral.map((b) => b - 0.05);
    const v = calibrationWinVerdict(neutral, worse, {
      baselineDrawGap: 0.15,
      challengerDrawGap: 0.02,
      challengerEce: 0.01,
    });
    expect(v.ship).toBe(false);
    expect(v.nonInferior).toBe(false);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/validation.test.ts`
Expected: FAIL — `calibrationWinVerdict is not a function` / import error.

- [ ] **Step 3: Implement in `lib/validation.ts` (append after `promotionVerdict`)**

```typescript
// append to lib/validation.ts

/** Pre-registered non-inferiority margin (Brier points) for the calibration-win rule. */
export const NONINFERIORITY_MARGIN = 0.005;
/** Pre-registered minimum draw-rate-gap reduction (fraction) for the calibration-win rule. */
export const MIN_DRAW_GAP_REDUCTION = 0.05;

export type CalibrationWinVerdict = {
  ship: boolean;
  nonInferior: boolean;
  drawGapReduced: boolean;
  eceOk: boolean;
  reason: string;
};

/**
 * Secondary, pre-registered promotion rule. Ships a challenger that does not win
 * on Brier outright but (a) is non-inferior on Brier within margin δ, (b) cuts the
 * draw-rate calibration gap by at least the minimum, and (c) stays calibrated.
 * Lets a Brier-neutral draw-fix ship for a real calibration gain without moving
 * the goalposts after the fact.
 */
export function calibrationWinVerdict(
  incumbentBrier: number[],
  challengerBrier: number[],
  opts: {
    baselineDrawGap: number;
    challengerDrawGap: number;
    challengerEce: number;
    n?: number;
    seed?: number;
    eceMax?: number;
    margin?: number;
    minDrawGapReduction?: number;
  },
): CalibrationWinVerdict {
  const {
    baselineDrawGap,
    challengerDrawGap,
    challengerEce,
    n = 2000,
    seed = 42,
    eceMax = ECE_MAX,
    margin = NONINFERIORITY_MARGIN,
    minDrawGapReduction = MIN_DRAW_GAP_REDUCTION,
  } = opts;
  const ci = pairedDeltaBrierCI(incumbentBrier, challengerBrier, n, seed);
  const nonInferior = ci.lo >= -margin;
  const reduction = baselineDrawGap - challengerDrawGap;
  const drawGapReduced = reduction >= minDrawGapReduction;
  const eceOk = challengerEce < eceMax;
  const ship = nonInferior && drawGapReduced && eceOk;
  const reason = ship
    ? `SHIP (calibration win) — ΔBrier CI.lo ${ci.lo.toFixed(4)} ≥ −${margin}, draw-gap −${(reduction * 100).toFixed(1)}pp, ECE ${challengerEce.toFixed(4)} < ${eceMax}`
    : !nonInferior
      ? `HOLD — Brier inferior: ΔBrier CI.lo ${ci.lo.toFixed(4)} < −${margin}`
      : !drawGapReduced
        ? `HOLD — draw-gap reduction ${(reduction * 100).toFixed(1)}pp < ${minDrawGapReduction * 100}pp`
        : `HOLD — ECE ${challengerEce.toFixed(4)} ≥ ${eceMax}`;
  return { ship, nonInferior, drawGapReduced, eceOk, reason };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/validation.test.ts`
Expected: PASS (existing 12 + 4 new).

- [ ] **Step 5: Commit**

```bash
git add lib/validation.ts tests/validation.test.ts
git commit -m "feat(model): pre-registered secondary calibration-win promotion rule"
```

---

### Task 3: `scripts/train-model.mts` — fit + write regime params + promotion candidate block

**Files:**
- Modify: `scripts/train-model.mts`

**Interfaces:**
- Consumes: `fitRegimeParams`, `type GoalSample`, `type LikRow` from `lib/regime-params`; `isFinalsTournament` from `lib/validation`.
- Produces (in `data/model.json`): `regimeParams: { tournament: ModelParams }`, `promotion: { shipped: false, status: "candidate" }`.

- [ ] **Step 1: Add regime-sample collection in the Elo pass**

In the `for (const row of rows)` loop that fills `samples` (around `train-model.mts:66-86`), also accumulate tournament-only samples and likelihood rows. Add these declarations next to `samples`/`backtest` (near line 57-60):

```typescript
import { fitRegimeParams, type GoalSample, type LikRow } from "../lib/regime-params";
import { isFinalsTournament } from "../lib/validation";

const regimeSamples: GoalSample[] = [];
const regimeLik: LikRow[] = [];
```

Inside the loop, right after the existing `samples.push(...)` block (after line 75), add:

```typescript
    if (isFinalsTournament(row.tournament) && row.date >= SAMPLE_FROM) {
      const effH = eloH + (row.neutral ? 0 : HOME_ADVANTAGE);
      const diff = (effH - eloA) / 400;
      regimeSamples.push({ x: diff, goals: row.hs });
      regimeSamples.push({ x: -diff, goals: row.as });
      if (row.hs < 9 && row.as < 9) regimeLik.push({ diff, hs: row.hs, as: row.as });
    }
```

- [ ] **Step 2: Fit regime params after the global fit**

After the global `params` is assembled (`train-model.mts:146`), add (regime fit uses a lower per-bin floor because the tournament sample is smaller):

```typescript
const regimeTournament = fitRegimeParams(regimeSamples, regimeLik, 50);
console.log(
  `fit (regime/tournament): baseLogGoals=${regimeTournament.baseLogGoals.toFixed(4)} ` +
    `(base λ=${Math.exp(regimeTournament.baseLogGoals).toFixed(2)}), ` +
    `eloSlope=${regimeTournament.eloSlope.toFixed(4)}, rho=${regimeTournament.rho} ` +
    `over ${regimeSamples.length} regime samples`,
);
```

- [ ] **Step 3: Write the new fields into the model object**

In the `const model = { ... }` literal (`train-model.mts:254-282`), add two fields after `params`:

```typescript
  params,
  regimeParams: { tournament: regimeTournament },
  promotion: { shipped: false, status: "candidate" } as {
    shipped: boolean;
    status: string;
    rule?: string;
    deltaBrierCI?: { lo: number; hi: number; mean: number };
    ece?: number;
    drawGap?: number;
    harnessGeneratedAt?: string;
    seed?: number;
  },
```

- [ ] **Step 4: Run the trainer and verify the model shape (safe: reads results.csv, rewrites model.json)**

Run: `npm run ml:train`
Expected console: existing global fit lines AND a new `fit (regime/tournament): ...` line; backtest gates still pass (Brier < 0.51, ECE < 3%, beats uniform).

Then verify the additive shape and that global params are unchanged:

Run: `node -e "const m=require('./data/model.json'); console.log('global', m.params); console.log('regime', m.regimeParams.tournament); console.log('promotion', m.promotion)"`
Expected: `m.params` equals the pre-change values (`baseLogGoals≈0.1556`, `eloSlope≈0.8493`, `rho=-0.05`); `m.regimeParams.tournament` has three numbers; `m.promotion.shipped === false`.

Run: `git diff --stat data/model.json`
Expected: only additions (no change to existing `params`/`ratings`/`backtest` values when diffed semantically; the file re-serializes but global numbers match).

- [ ] **Step 5: Commit**

```bash
git add scripts/train-model.mts data/model.json
git commit -m "feat(model): train + persist tournament-regime params with promotion candidate block"
```

---

### Task 4: `scripts/validate-model.mts` — regime variant, both rules, draw-gap, `--promote`

**Files:**
- Modify: `scripts/validate-model.mts`

**Interfaces:**
- Consumes: `fitRegimeParams`, `drawRateGap`, `type GoalSample`, `type LikRow` from `lib/regime-params`; `calibrationWinVerdict` from `lib/validation`.
- Produces: `regime` variant + `drawGap` per variant + `secondaryPromotion` block in `docs/validation/tournament-validation.json`; a `--promote` code path that stamps `model.json.promotion`.

- [ ] **Step 1: Walk-forward regime fit, cached per tournament instance**

In `validate-model.mts`, alongside the existing `plattCache` / `calibPairs` accumulation (around lines 132-138), add accumulators for regime-fit inputs and a regime collector:

```typescript
import { fitRegimeParams, drawRateGap, type GoalSample, type LikRow } from "../lib/regime-params";
import { calibrationWinVerdict } from "../lib/validation";

const regimeSamplesAll: Array<{ s: GoalSample; date: string }> = [];
const regimeLikAll: Array<{ l: LikRow; date: string }> = [];
const regimeParamCache = new Map<string, ModelParams | null>();
const regime = newCollector();
const baseDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
const regimeDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
const MIN_REGIME_SAMPLES = 400; // below this, fall back to global params for the instance
```

Inside the main `for (const row of rows)` loop, in the `if (isFinalsTournament(row.tournament) && row.date >= EVAL_FROM)` block (after the existing `record(base, ...)` / `record(platt, ...)` calls, ~line 156-158), add a regime branch:

```typescript
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
```

After the loop body's existing `calibPairs.push(...)` block, also accumulate regime-fit inputs (these feed FUTURE instances, so they are added after scoring, mirroring `calibPairs`):

```typescript
    if (isFinalsTournament(row.tournament) && row.date >= EVAL_FROM) {
      const effH = eloH + (row.neutral ? 0 : HOME_ADVANTAGE);
      const diff = (effH - eloA) / 400;
      regimeSamplesAll.push({ s: { x: diff, goals: row.hs }, date: row.date });
      regimeSamplesAll.push({ s: { x: -diff, goals: row.as }, date: row.date });
      if (row.hs < 9 && row.as < 9) regimeLikAll.push({ l: { diff, hs: row.hs, as: row.as }, date: row.date });
    }
```

> Note: `HOME_ADVANTAGE` must be imported in `validate-model.mts` (add to the existing `../lib/elo` import: `import { updateElo, HOME_ADVANTAGE } from "../lib/elo";`).

- [ ] **Step 2: Compute regime metrics, both verdicts, and draw-gaps after the loop**

After `const plattM = metricsOf(platt);` (line 179), add:

```typescript
  const regimeM = metricsOf(regime);
  const baselineDrawGap = drawRateGap(baseDraw);
  const regimeDrawGap = drawRateGap(regimeDraw);

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
```

- [ ] **Step 3: Serialize the regime variant + draw-gaps + verdicts into the artifact**

In the `out` object (lines 197-215), add `regime` to `variants`, draw-gaps to `holdout`, and a `regimePromotion` block:

```typescript
    variants: {
      baseline: serializeVariant(baseM),
      "platt-calibrated": serializeVariant(plattM),
      regime: serializeVariant(regimeM),
    },
    drawGap: { baseline: r4(baselineDrawGap), regime: r4(regimeDrawGap) },
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
```

- [ ] **Step 4: Add the `--promote` code path**

At the very end of `main()` (after the file is written, before the function returns ~line 237), add:

```typescript
  const ruleFired = primaryRegime.ship ? "primary" : secondaryRegime.ship ? "secondary" : null;
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
  } else {
    console.log(`[validate] regime rule: ${ruleFired ?? "none fired (HOLD)"}. Re-run with --promote to ship.`);
  }
```

- [ ] **Step 5: Extend `renderReport` to show the regime variant + draw-gaps**

In `renderReport` (the results table + a new draw-gap line), add the `regime` row to the variant table and a draw-gap section. Locate the results-table builder and add `regime` alongside `baseline`/`platt-calibrated`; add after the verdict block:

```typescript
  // (inside renderReport, after the existing results table)
  lines.push("", "## Draw-rate calibration", "", "| variant | draw-gap |", "| --- | --- |",
    `| baseline | ${out.drawGap.baseline} |`, `| regime | ${out.drawGap.regime} |`, "");
  lines.push("## Regime promotion", "",
    `- **primary:** ${out.regimePromotion.primary.reason}`,
    `- **secondary:** ${out.regimePromotion.secondary.reason}`, "");
```

(Adapt variable names to the actual `renderReport` implementation; the function already builds a `lines` array and the variant table — add the `regime` row to that table the same way `platt-calibrated` is added.)

- [ ] **Step 6: Run the harness and record the verdict (offline, safe)**

Run: `npm run ml:validate`
Expected: console shows three variants (baseline / platt-calibrated / regime) with Brier + CI + ECE, the draw-gap for baseline vs regime, and `regime rule: <primary|secondary|none fired (HOLD)>`. The artifact `docs/validation/tournament-validation.json` contains `variants.regime`, `drawGap`, and `regimePromotion`.

Run: `node -e "const v=require('./docs/validation/tournament-validation.json'); console.log('regime Brier', v.variants.regime.brier); console.log('drawGap', v.drawGap); console.log('primary', v.regimePromotion.primary.ship, 'secondary', v.regimePromotion.secondary.ship)"`
Expected: prints the regime Brier, both draw-gaps, and both rule outcomes. **Record this verdict — it decides whether Step 7 runs.**

- [ ] **Step 7: Conditional promotion**

- If a rule fired: `npm run ml:validate -- --promote` → confirms `model.json.promotion.shipped = true` with provenance.
- If neither fired (HOLD): do nothing; `promotion.shipped` stays `false`. This is a valid Phase-1 outcome — the harness rejected the change; report it.

- [ ] **Step 8: Commit (artifacts + script; model.json only if promoted)**

```bash
git add scripts/validate-model.mts docs/validation/tournament-validation.json docs/validation/validation-report.md
# include data/model.json in this commit ONLY if Step 7 promoted:
# git add data/model.json
git commit -m "feat(model): harness regime variant + dual promotion verdict + draw-gap"
```

---

### Task 5: `lib/predict.ts` — select regime params when promoted

**Files:**
- Modify: `lib/predict.ts`
- Test: `tests/predict-params.test.ts`

**Interfaces:**
- Consumes: `model.json` (`params`, optional `regimeParams.tournament`, optional `promotion.shipped`).
- Produces: `selectParams(model): ModelParams` exported from `lib/predict.ts`.

- [ ] **Step 1: Write the failing test**

```typescript
// tests/predict-params.test.ts
import { describe, it, expect } from "vitest";
import { selectParams } from "../lib/predict";

const global = { baseLogGoals: 0.15, eloSlope: 0.85, rho: -0.05 };
const tourney = { baseLogGoals: 0.05, eloSlope: 0.7, rho: -0.12 };

describe("selectParams", () => {
  it("uses regime params when promotion is shipped and regime params exist", () => {
    const m = { params: global, regimeParams: { tournament: tourney }, promotion: { shipped: true } };
    expect(selectParams(m)).toEqual(tourney);
  });

  it("falls back to global params when promotion is not shipped", () => {
    const m = { params: global, regimeParams: { tournament: tourney }, promotion: { shipped: false } };
    expect(selectParams(m)).toEqual(global);
  });

  it("falls back to global params when promotion or regimeParams are absent", () => {
    expect(selectParams({ params: global })).toEqual(global);
    expect(selectParams({ params: global, promotion: { shipped: true } })).toEqual(global);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/predict-params.test.ts`
Expected: FAIL — `selectParams is not exported`.

- [ ] **Step 3: Implement `selectParams` and use it in `predictFixture`**

Add near the top of `lib/predict.ts` (after the imports / `ratings` setup):

```typescript
type ModelShape = {
  params: ModelParams;
  regimeParams?: { tournament?: ModelParams };
  promotion?: { shipped?: boolean };
};

/** The product serves only World Cup fixtures (all finals-tournament regime), so
 *  regime params apply whenever they have been promoted; otherwise global params. */
export function selectParams(m: ModelShape): ModelParams {
  if (m.promotion?.shipped && m.regimeParams?.tournament) return m.regimeParams.tournament;
  return m.params;
}
```

Then replace the existing line `const params = model.params as ModelParams;` (predict.ts:85) with:

```typescript
  const params = selectParams(model as unknown as ModelShape);
```

- [ ] **Step 4: Run the test (and the full suite) to verify pass**

Run: `npx vitest run tests/predict-params.test.ts`
Expected: PASS.

Run: `npx vitest run`
Expected: PASS (full suite; predict-consuming tests still green).

- [ ] **Step 5: Commit**

```bash
git add lib/predict.ts tests/predict-params.test.ts
git commit -m "feat(model): predict selects regime params only when promoted"
```

---

### Task 6: `scripts/model-inspector.mts` + `npm run model:inspect`

**Files:**
- Create: `scripts/model-inspector.mts`
- Modify: `package.json` (add `model:inspect` script)
- Test: `tests/model-inspector.test.ts`

**Interfaces:**
- Consumes: `model.json` + `docs/validation/tournament-validation.json` shapes.
- Produces: `inspectModel(args: { model: ModelLike; verdict: VerdictLike | null }): string[]` (array of failure messages; empty = pass) + CLI guard.

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/model-inspector.test.ts
import { describe, it, expect } from "vitest";
import { inspectModel } from "../scripts/model-inspector.mts";

const okModel = {
  params: { baseLogGoals: 0.15, eloSlope: 0.85, rho: -0.05 },
  regimeParams: { tournament: { baseLogGoals: 0.05, eloSlope: 0.7, rho: -0.12 } },
  promotion: {
    shipped: true,
    rule: "secondary",
    drawGap: 0.03,
    seed: 42,
    harnessGeneratedAt: "2026-06-24T00:00:00.000Z",
  },
  backtest: { brier: 0.5085, uniformBrier: 0.6667, ece: 0.0089 },
};
const okVerdict = {
  config: { generatedAt: "2026-06-24T00:00:00.000Z", seed: 42, bootstrapSamples: 5000 },
  drawGap: { baseline: 0.15, regime: 0.03 },
  regimePromotion: { secondary: { ship: true }, primary: { ship: false } },
};

describe("inspectModel", () => {
  it("passes on a consistent shipped model + verdict", () => {
    expect(inspectModel({ model: okModel, verdict: okVerdict })).toEqual([]);
  });

  it("passes a candidate (not shipped) model without a verdict", () => {
    const m = { ...okModel, promotion: { shipped: false, status: "candidate" } };
    expect(inspectModel({ model: m, verdict: null })).toEqual([]);
  });

  it("fails when shipped but no verdict artifact exists", () => {
    expect(inspectModel({ model: okModel, verdict: null }).join(" ")).toMatch(/verdict/i);
  });

  it("fails when shipped but neither rule shipped in the artifact", () => {
    const v = { ...okVerdict, regimePromotion: { secondary: { ship: false }, primary: { ship: false } } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/rule/i);
  });

  it("fails when the regime draw-gap is worse than baseline", () => {
    const v = { ...okVerdict, drawGap: { baseline: 0.05, regime: 0.12 } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/draw/i);
  });

  it("fails on a leakage-constant mismatch (seed)", () => {
    const v = { ...okVerdict, config: { ...okVerdict.config, seed: 7 } };
    expect(inspectModel({ model: okModel, verdict: v }).join(" ")).toMatch(/seed/i);
  });

  it("fails when backtest no longer beats uniform", () => {
    const m = { ...okModel, backtest: { brier: 0.7, uniformBrier: 0.6667, ece: 0.0089 } };
    expect(inspectModel({ model: m, verdict: okVerdict }).join(" ")).toMatch(/uniform|brier/i);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/model-inspector.test.ts`
Expected: FAIL — `Cannot find module '../scripts/model-inspector.mts'`.

- [ ] **Step 3: Implement `scripts/model-inspector.mts`**

```typescript
// scripts/model-inspector.mts
//
// WC26 Model-Quality Inspector — sibling to design-inspector.mts / execution-inspector.mts.
// Guards the MODEL: a shipped regime model must trace to a real harness verdict, must not
// regress draw calibration, must respect leakage constants, and must keep clearing the
// standing backtest gates. Pure `inspectModel` + thin CLI guard (design-inspector pattern).
//
//   npm run model:inspect
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEED = 42;
const BOOTSTRAP_N = 5000;
const ECE_MAX = 0.03;
const BRIER_CEILING = 0.51;

type ModelLike = {
  backtest?: { brier?: number; uniformBrier?: number; ece?: number };
  regimeParams?: { tournament?: unknown };
  promotion?: { shipped?: boolean; rule?: string; drawGap?: number; seed?: number; harnessGeneratedAt?: string };
};
type VerdictLike = {
  config?: { generatedAt?: string; seed?: number; bootstrapSamples?: number };
  drawGap?: { baseline?: number; regime?: number };
  regimePromotion?: { primary?: { ship?: boolean }; secondary?: { ship?: boolean } };
};

export function inspectModel(args: { model: ModelLike; verdict: VerdictLike | null }): string[] {
  const { model, verdict } = args;
  const fails: string[] = [];

  // Standing backtest gates (always enforced).
  const bt = model.backtest ?? {};
  if (bt.brier === undefined || bt.uniformBrier === undefined || bt.brier >= bt.uniformBrier) {
    fails.push(`backtest Brier ${bt.brier} does not beat uniform ${bt.uniformBrier}`);
  }
  if (bt.brier !== undefined && bt.brier >= BRIER_CEILING) {
    fails.push(`backtest Brier ${bt.brier} ≥ ceiling ${BRIER_CEILING}`);
  }
  if (bt.ece === undefined || bt.ece >= ECE_MAX) {
    fails.push(`backtest ECE ${bt.ece} ≥ ${ECE_MAX}`);
  }

  // Shipped-regime provenance checks.
  if (model.promotion?.shipped) {
    if (!model.regimeParams?.tournament) {
      fails.push("promotion.shipped is true but regimeParams.tournament is missing");
    }
    if (!verdict) {
      fails.push("promotion.shipped is true but no harness verdict artifact was found");
    } else {
      const firedPrimary = verdict.regimePromotion?.primary?.ship === true;
      const firedSecondary = verdict.regimePromotion?.secondary?.ship === true;
      if (!firedPrimary && !firedSecondary) {
        fails.push("promotion.shipped is true but neither pre-registered rule shipped in the verdict");
      }
      if (verdict.config?.seed !== SEED) {
        fails.push(`verdict seed ${verdict.config?.seed} ≠ pre-registered ${SEED}`);
      }
      if (verdict.config?.bootstrapSamples !== BOOTSTRAP_N) {
        fails.push(`verdict bootstrapSamples ${verdict.config?.bootstrapSamples} ≠ pre-registered ${BOOTSTRAP_N}`);
      }
      if (model.promotion?.seed !== SEED) {
        fails.push(`model.promotion.seed ${model.promotion?.seed} ≠ pre-registered ${SEED}`);
      }
      if (model.promotion?.harnessGeneratedAt !== verdict.config?.generatedAt) {
        fails.push("model.promotion.harnessGeneratedAt does not match the verdict artifact");
      }
      const base = verdict.drawGap?.baseline;
      const reg = verdict.drawGap?.regime;
      if (base === undefined || reg === undefined || reg > base) {
        fails.push(`regime draw-gap ${reg} is not better than baseline ${base}`);
      }
    }
  }
  return fails;
}

// ── CLI guard (design-inspector pattern) ─────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const modelPath = join(ROOT, "data", "model.json");
  const verdictPath = join(ROOT, "docs", "validation", "tournament-validation.json");
  const model = JSON.parse(readFileSync(modelPath, "utf8")) as ModelLike;
  const verdict = existsSync(verdictPath)
    ? (JSON.parse(readFileSync(verdictPath, "utf8")) as VerdictLike)
    : null;
  const fails = inspectModel({ model, verdict });
  console.log("\nWC26 Model-Quality Inspector");
  console.log("────────────────────────────");
  console.log(`  promotion: ${model.promotion?.shipped ? `SHIPPED (${model.promotion.rule})` : "candidate (global params live)"}`);
  if (fails.length) {
    for (const f of fails) console.error(`  ✗ ${f}`);
    console.error(`\n✗ Model inspector: ${fails.length} violation(s).`);
    process.exit(1);
  }
  console.log("\n✓ Model inspector passed.");
}
```

- [ ] **Step 4: Add the npm script**

In `package.json`, after the `inspect:execution` line, add:

```json
    "model:inspect": "tsx scripts/model-inspector.mts",
```

- [ ] **Step 5: Run the tests and the gate**

Run: `npx vitest run tests/model-inspector.test.ts`
Expected: PASS (all cases).

Run: `npm run model:inspect`
Expected: prints the promotion status and `✓ Model inspector passed.` (exit 0) for the current model.json (whether shipped or candidate).

- [ ] **Step 6: Commit**

```bash
git add scripts/model-inspector.mts package.json tests/model-inspector.test.ts
git commit -m "feat(model): model:inspect gate — trace live params to a real harness verdict"
```

---

### Task 7: Full gate sweep + finish

**Files:** none (verification + branch completion).

- [ ] **Step 1: Run every commit gate and confirm green**

```bash
npm test
npm run lint
npm run design:inspect
npm run inspect:execution
npm run model:inspect
npm run build
```

Expected: vitest all pass (309 + new tests); eslint 0 errors; design/execution/model inspectors pass; build succeeds. Fix any failure before proceeding (do not claim done on a red gate).

- [ ] **Step 2: Confirm the honest outcome is recorded**

Confirm `docs/validation/validation-report.md` states the regime verdict (SHIP-primary / SHIP-secondary / HOLD) and the draw-gap before vs after. If HOLD, confirm `model.json.promotion.shipped === false` (global params remain live) — a valid, reportable result.

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch to push `feat/model-quality-p1-tournament-regime` and open a PR for user merge. PR body must state: the regime params, the verdict (which rule fired or HOLD), draw-gap before/after, and that `model.json` global params are unchanged when not promoted.

---

## Self-Review

**Spec coverage:**
- Goal 1 (regime params fit honestly) → Tasks 1, 3, 4 (walk-forward). ✓
- Goal 2 (primary rule) → Task 4 reuses `promotionVerdict`. ✓
- Goal 3 (secondary rule, δ margin) → Task 2 + Task 4. ✓
- Goal 4 (draw diagnostic reported) → Task 1 `drawRateGap`, Task 4 artifact + report. ✓
- Goal 5 (`model:inspect` gate) → Task 6. ✓
- Goal 6 (no regression; train gates; suite green) → Task 3 Step 4, Task 7. ✓
- Promotion/immutability protocol → Task 3 (candidate), Task 4 (`--promote`), Task 5 (`selectParams` keys off `shipped`); predictions immutability left to `inspect:execution` (noted in Global Constraints). ✓
- `predict.ts` selection point → Task 5. ✓

**Placeholder scan:** Task 4 Step 5 says "adapt to the actual `renderReport`" — this is unavoidable because `renderReport`'s internals were not read in full; the step gives the exact lines to add and where. All other steps contain complete code. No TBD/TODO.

**Type consistency:** `ModelParams` `{baseLogGoals, eloSlope, rho}` used consistently. `GoalSample`/`LikRow` defined in Task 1, consumed in Tasks 3-4. `selectParams` signature matches Task 5 test. `inspectModel({model, verdict})` matches Task 6 test. `calibrationWinVerdict` signature matches Task 2 test and Task 4 call. Promotion-block fields (`shipped`, `rule`, `drawGap`, `seed`, `harnessGeneratedAt`) consistent across Tasks 3, 4, 6.

**Open implementation note:** Task 4 depends on `renderReport`/`serializeVariant` existing in `validate-model.mts` (confirmed present in the current script) — the implementer should read that function before Step 5.
