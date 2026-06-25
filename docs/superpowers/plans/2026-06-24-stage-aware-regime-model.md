# Stage-Aware Regime Model Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a `stage-aware` regime variant to the `ml:validate` tournament-holdout harness that fits `baseLogGoals` + `rho` separately for group vs knockout matches (sharing a pooled `eloSlope`), to measure whether stage-splitting sharpens knockout draw calibration.

**Architecture:** Two new pure lib primitives (`fitStageParams` for the fixed-slope per-stage fit; `indexStageLabels` for the label join) plus a pure walk-forward helper module (`lib/stage-regime.ts`: `fitStageParamsByStage` + `selectStageParams`). The harness wires these into a new variant with nested `stage → pooled → baseline` fallback, then reports the variant's Brier/CI/ECE, per-stage draw-gaps, and fallback-tier counts. Measurement-only; `predict.ts` is untouched and stage-aware is not wired to `--promote`.

**Tech Stack:** TypeScript, Node ESM `.mts` scripts run via `tsx`, vitest (`npm test`), Dixon-Coles double-Poisson + World-Football-Elo model already in `lib/`.

## Global Constraints

- **Read-only data:** never run `ml:fetch` / `matchday` / `pipeline:polymarket` (they refetch and wipe seeded `results.csv` / market data). `ml:train` is safe. This plan only reads `data/raw/results.csv` and `data/stage-labels.json`.
- **Commit gates (run before every commit):** `npm test` (vitest), `npm run lint` (0 errors; ~10 pre-existing warnings OK), `npm run design:inspect`, `npm run inspect:execution`, `npm run model:inspect`, `npm run build`.
- **No `predict.ts` change.** Stage-aware is report-only. The existing `--promote` path stays exactly as Phase 1 shipped it.
- **Pre-registered constants (verbatim):** `MIN_STAGE_SAMPLES = 150`, `MIN_REGIME_SAMPLES = 400`, non-inferiority `δ = 0.005`, `BOOTSTRAP_N = 5000`, `SEED = 42`.
- **Avoid the literal substring `shadow-` in `lib/` comments** (trips `design:inspect`). Not relevant here but a standing rule.
- All commands run from `/Users/sanjaym/Desktop/KALSHI/README/app`. No `timeout` on macOS.
- File-naming: lowercase-with-hyphens; CommonJS rule does NOT apply (this app is ESM/TS).

---

### Task 1: `fitStageParams` — fixed-slope per-stage fit

**Files:**
- Modify: `lib/regime-params.ts` (extract a binning helper; add `fitStageParams`)
- Test: `tests/regime-params.test.ts`

**Interfaces:**
- Consumes: existing `fitRho(likRows, baseLogGoals, eloSlope)`, `scoreGrid`, types `GoalSample`, `LikRow`, `ModelParams`.
- Produces: `fitStageParams(samples: GoalSample[], likRows: LikRow[], sharedSlope: number, minBinCount?: number): ModelParams` — returns `{ baseLogGoals, eloSlope: sharedSlope, rho }`. Also an internal `binnedLogMeans` helper (not exported).

- [ ] **Step 1: Write the failing tests**

Append to `tests/regime-params.test.ts` (the `syntheticSamples` helper already exists at the top of that file):

```ts
import { fitStageParams } from "../lib/regime-params"; // add to the existing import block

describe("fitStageParams", () => {
  it("recovers the intercept while holding the slope fixed", () => {
    const p = fitStageParams(syntheticSamples(0.3, 0.6, 60), [{ diff: 0, hs: 1, as: 1 }], 0.6, 50);
    expect(p.baseLogGoals).toBeCloseTo(0.3, 1);
    expect(p.eloSlope).toBe(0.6);
    expect(typeof p.rho).toBe("number");
  });

  it("returns a lower base and a more-negative rho on a cagey draw-heavy stage than an open one", () => {
    const cageySamples = syntheticSamples(Math.log(0.9), 0.6, 60); // low-scoring
    const openSamples = syntheticSamples(Math.log(1.6), 0.6, 60);  // high-scoring
    const cageyLik: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 1, as: 1 }))); // draws
    const openLik: LikRow[] = Array.from({ length: 300 }, () => ({ diff: 0, hs: 2, as: 0 }))
      .concat(Array.from({ length: 300 }, () => ({ diff: 0, hs: 0, as: 2 })));  // decisive
    const cagey = fitStageParams(cageySamples, cageyLik, 0.6, 50);
    const open = fitStageParams(openSamples, openLik, 0.6, 50);
    expect(cagey.baseLogGoals).toBeLessThan(open.baseLogGoals);
    expect(cagey.rho).toBeLessThan(open.rho);
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/regime-params.test.ts -t fitStageParams`
Expected: FAIL — `fitStageParams is not a function` / import error.

- [ ] **Step 3: Refactor binning into a helper and add `fitStageParams`**

In `lib/regime-params.ts`, replace the body of `fitBaseAndSlope` to use a new `binnedLogMeans` helper, then add `fitStageParams`. The helper holds the exact binning that was inline in `fitBaseAndSlope` (no behavior change):

```ts
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
```

(`BIN`, `fitRho`, and the `ModelParams`/`GoalSample`/`LikRow` types already exist in the file.)

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/regime-params.test.ts`
Expected: PASS — the new `fitStageParams` tests AND every pre-existing test in the file (the refactor must not change `fitBaseAndSlope` behavior).

- [ ] **Step 5: Commit**

```bash
git add lib/regime-params.ts tests/regime-params.test.ts
git commit -m "feat: fitStageParams — fixed-slope per-stage base+rho fit"
```

---

### Task 2: `indexStageLabels` — stage-label join

**Files:**
- Modify: `lib/stage-derivation.ts` (add `stageKey`, `StageLabelRow`, `indexStageLabels`)
- Test: `tests/stage-derivation.test.ts`

**Interfaces:**
- Consumes: existing `StageLabel` type from the same file.
- Produces:
  - `stageKey(date: string, home: string, away: string, tournament: string): string` → `"date|home|away|tournament"`
  - `type StageLabelRow = { date: string; home: string; away: string; tournament: string; stage: StageLabel }`
  - `indexStageLabels(labels: StageLabelRow[]): Map<string, StageLabel>`

- [ ] **Step 1: Write the failing tests**

Append to `tests/stage-derivation.test.ts`:

```ts
import { indexStageLabels, stageKey } from "../lib/stage-derivation"; // add to existing import

describe("indexStageLabels", () => {
  it("builds an exact lookup keyed by date|home|away|tournament", () => {
    const idx = indexStageLabels([
      { date: "2018-06-14", home: "Russia", away: "Saudi Arabia", tournament: "FIFA World Cup", stage: "group" },
      { date: "2018-07-15", home: "France", away: "Croatia", tournament: "FIFA World Cup", stage: "knockout" },
    ]);
    expect(idx.get(stageKey("2018-06-14", "Russia", "Saudi Arabia", "FIFA World Cup"))).toBe("group");
    expect(idx.get(stageKey("2018-07-15", "France", "Croatia", "FIFA World Cup"))).toBe("knockout");
  });

  it("returns undefined for an absent triple", () => {
    const idx = indexStageLabels([]);
    expect(idx.get(stageKey("2018-06-14", "A", "B", "FIFA World Cup"))).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/stage-derivation.test.ts -t indexStageLabels`
Expected: FAIL — `indexStageLabels is not a function`.

- [ ] **Step 3: Add the join helpers**

Append to `lib/stage-derivation.ts`:

```ts
export type StageLabelRow = { date: string; home: string; away: string; tournament: string; stage: StageLabel };

/** Stable join key for a single match. */
export const stageKey = (date: string, home: string, away: string, tournament: string): string =>
  `${date}|${home}|${away}|${tournament}`;

/** Index stage labels (e.g. data/stage-labels.json `labels`) for O(1) per-match lookup. */
export function indexStageLabels(labels: StageLabelRow[]): Map<string, StageLabel> {
  const m = new Map<string, StageLabel>();
  for (const l of labels) m.set(stageKey(l.date, l.home, l.away, l.tournament), l.stage);
  return m;
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/stage-derivation.test.ts`
Expected: PASS — new tests and all pre-existing `deriveEditionStages` tests.

- [ ] **Step 5: Commit**

```bash
git add lib/stage-derivation.ts tests/stage-derivation.test.ts
git commit -m "feat: indexStageLabels — exact stage-label join helper"
```

---

### Task 3: `lib/stage-regime.ts` — walk-forward fit + nested fallback

**Files:**
- Create: `lib/stage-regime.ts`
- Test: `tests/stage-regime.test.ts`

**Interfaces:**
- Consumes: `fitStageParams`, `GoalSample`, `LikRow` (Task 1); `ModelParams`; `StageLabel`.
- Produces:
  - `type StageSample = GoalSample & { date: string; stage: StageLabel }`
  - `type StageLik = LikRow & { date: string; stage: StageLabel }`
  - `type StageFits = Partial<Record<StageLabel, ModelParams>>`
  - `type FallbackTier = "stage" | "pooled" | "baseline"`
  - `fitStageParamsByStage(samples, liks, beforeDate, sharedSlope, minStageSamples, minBinCount?): StageFits` — fits each stage with `≥ minStageSamples` strictly-prior matches, holding `sharedSlope` fixed; returns `{}` when `sharedSlope` is `null`.
  - `selectStageParams(stage, fits, pooled, baseline): { params: ModelParams; tier: FallbackTier }` — nested `stage → pooled → baseline`.

- [ ] **Step 1: Write the failing tests**

Create `tests/stage-regime.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import {
  fitStageParamsByStage,
  selectStageParams,
  type StageSample,
  type StageLik,
} from "../lib/stage-regime";
import type { ModelParams } from "../lib/poisson-model";

const P = (base: number): ModelParams => ({ baseLogGoals: base, eloSlope: 0.8, rho: -0.05 });

describe("selectStageParams (nested fallback)", () => {
  const baseline = P(0);
  const pooled = P(0.1);
  const fits = { knockout: P(0.2) };

  it("uses the stage fit when present", () => {
    const r = selectStageParams("knockout", fits, pooled, baseline);
    expect(r.tier).toBe("stage");
    expect(r.params.baseLogGoals).toBe(0.2);
  });

  it("falls back to pooled when the stage has no fit", () => {
    const r = selectStageParams("group", fits, pooled, baseline);
    expect(r.tier).toBe("pooled");
    expect(r.params.baseLogGoals).toBe(0.1);
  });

  it("falls back to pooled for an unlabeled (undefined) stage", () => {
    expect(selectStageParams(undefined, fits, pooled, baseline).tier).toBe("pooled");
  });

  it("falls back to baseline when pooled is null", () => {
    const r = selectStageParams("group", fits, null, baseline);
    expect(r.tier).toBe("baseline");
    expect(r.params.baseLogGoals).toBe(0);
  });
});

describe("fitStageParamsByStage (walk-forward leakage)", () => {
  const sharedSlope = 0.7;
  function mk(n: number, date: string, stage: "group" | "knockout", goals: number) {
    const s: StageSample[] = [];
    const l: StageLik[] = [];
    for (let i = 0; i < n; i++) {
      for (const x of [-1.5, -1, -0.5, 0, 0.5, 1, 1.5]) s.push({ x, goals, date, stage });
      l.push({ diff: 0, hs: 1, as: 1, date, stage });
    }
    return { s, l };
  }

  it("fits only stages meeting the minimum and ignores entries dated on/after beforeDate", () => {
    const prior = mk(200, "2009-01-01", "group", 1.2);
    const future = mk(500, "2011-01-01", "group", 5.0);   // must be ignored (leakage guard)
    const koPrior = mk(50, "2009-01-01", "knockout", 1.0); // below the minimum
    const samples = [...prior.s, ...future.s, ...koPrior.s];
    const liks = [...prior.l, ...future.l, ...koPrior.l];
    const fits = fitStageParamsByStage(samples, liks, "2010-01-01", sharedSlope, 150, 20);
    expect(fits.group).toBeDefined();        // 200 >= 150
    expect(fits.knockout).toBeUndefined();   // 50 < 150
    // base reflects the prior goals ≈1.2 (log ≈0.18), NOT the future 5.0 → proves no leakage
    expect(fits.group!.baseLogGoals).toBeCloseTo(Math.log(1.2), 1);
  });

  it("returns no fits when the shared slope is unavailable", () => {
    const prior = mk(200, "2009-01-01", "group", 1.2);
    expect(fitStageParamsByStage(prior.s, prior.l, "2010-01-01", null, 150, 20).group).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the tests to verify they fail**

Run: `npx vitest run tests/stage-regime.test.ts`
Expected: FAIL — cannot find module `../lib/stage-regime`.

- [ ] **Step 3: Create `lib/stage-regime.ts`**

```ts
// lib/stage-regime.ts
//
// Pure walk-forward helpers for the stage-aware regime variant of ml:validate.
// fitStageParamsByStage fits per-stage {base,rho} on STRICTLY-PRIOR same-stage matches
// (the date filter is the leakage guard) holding the pooled slope fixed; selectStageParams
// resolves the nested stage -> pooled -> baseline fallback at scoring time. No I/O.
import { fitStageParams, type GoalSample, type LikRow } from "./regime-params";
import type { ModelParams } from "./poisson-model";
import type { StageLabel } from "./stage-derivation";

export type StageSample = GoalSample & { date: string; stage: StageLabel };
export type StageLik = LikRow & { date: string; stage: StageLabel };
export type StageFits = Partial<Record<StageLabel, ModelParams>>;
export type FallbackTier = "stage" | "pooled" | "baseline";

const STAGES: StageLabel[] = ["group", "knockout"];

/** Fit each stage that has >= minStageSamples matches dated strictly before `beforeDate`,
 *  holding eloSlope = sharedSlope. Returns {} if sharedSlope is null (no pooled fit yet),
 *  so a stage fit can never activate before the pooled regime does. */
export function fitStageParamsByStage(
  samples: StageSample[],
  liks: StageLik[],
  beforeDate: string,
  sharedSlope: number | null,
  minStageSamples: number,
  minBinCount = 30,
): StageFits {
  const fits: StageFits = {};
  if (sharedSlope === null) return fits;
  for (const stage of STAGES) {
    const priorLik = liks.filter((l) => l.date < beforeDate && l.stage === stage);
    if (priorLik.length < minStageSamples) continue;
    const priorSamp = samples.filter((s) => s.date < beforeDate && s.stage === stage);
    fits[stage] = fitStageParams(priorSamp, priorLik, sharedSlope, minBinCount);
  }
  return fits;
}

/** Nested fallback: stage params if fitted, else pooled regime params, else global baseline. */
export function selectStageParams(
  stage: StageLabel | undefined,
  fits: StageFits,
  pooled: ModelParams | null,
  baseline: ModelParams,
): { params: ModelParams; tier: FallbackTier } {
  if (stage && fits[stage]) return { params: fits[stage]!, tier: "stage" };
  if (pooled) return { params: pooled, tier: "pooled" };
  return { params: baseline, tier: "baseline" };
}
```

- [ ] **Step 4: Run the tests to verify they pass**

Run: `npx vitest run tests/stage-regime.test.ts`
Expected: PASS (6 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/stage-regime.ts tests/stage-regime.test.ts
git commit -m "feat: stage-regime walk-forward fit + nested fallback (pure)"
```

---

### Task 4: Wire the `stage-aware` variant into the harness + reporting

**Files:**
- Modify: `scripts/validate-model.mts`

**Interfaces:**
- Consumes: `fitStageParamsByStage`, `selectStageParams`, `StageSample`, `StageLik`, `StageFits`, `FallbackTier` (Task 3); `indexStageLabels`, `stageKey`, `StageLabelRow` (Task 2); existing `drawRateGap`, `promotionVerdict`, `calibrationWinVerdict`, `rawSplit`, `record`, `metricsOf`, `newCollector`, `serializeVariant`.
- Produces: the `ml:validate` JSON/report gains `variants["stage-aware"]`, `stageDrawGap`, `fallbackCounts`, and `stageAwarePromotion`; console prints the stage-aware verdict.

This task has no new unit test (it edits a script `main()` whose logic now lives in the Task 1–3 lib functions that ARE unit-tested). Its deliverable is verified by running `ml:validate` and the full gate sweep.

- [ ] **Step 1: Add imports**

In `scripts/validate-model.mts`, extend the existing import blocks:

```ts
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
```

- [ ] **Step 2: Add the constant + load stage labels**

Below `const MIN_REGIME_SAMPLES = 400;` (inside `main`), add:

```ts
  const MIN_STAGE_SAMPLES = 150;

  const stageLabels = JSON.parse(
    readFileSync(path.join(appDir, "data", "stage-labels.json"), "utf8"),
  ) as { labels: StageLabelRow[] };
  const stageIndex = indexStageLabels(stageLabels.labels);
  const stageOf = (row: Row) => stageIndex.get(stageKey(row.date, row.home, row.away, row.tournament));
```

- [ ] **Step 3: Add stage-aware accumulators**

Next to the existing `regime`/`baseDraw`/`regimeDraw` declarations, add:

```ts
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
```

- [ ] **Step 4: Score the stage-aware variant inside the finals block**

In the `isFinalsTournament(...) && row.date >= EVAL_FROM` scoring block, immediately after the existing regime lines (`record(regime, rgSplit, o);` … `regimeDraw.push(...)`), add. Note `regimeParams` is already in scope here (the pooled per-instance fit, `ModelParams | null`):

```ts
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
      if (stage === "group" || stage === "knockout") {
        stageDraw[stage].baseline.push({ pDraw: rs.draw, isDraw: o === "draw" });
        stageDraw[stage].stageAware.push({ pDraw: saSplit.draw, isDraw: o === "draw" });
      }
```

- [ ] **Step 5: Accumulate stage-tagged prior samples**

In the second `isFinalsTournament(...) && row.date >= EVAL_FROM` block (the one that pushes to `regimeSamplesAll` AFTER scoring), append, reusing the `diff` already computed there:

```ts
      const stg = stageOf(row);
      if (stg === "group" || stg === "knockout") {
        stageSamplesAll.push({ x: diff, goals: row.hs, date: row.date, stage: stg });
        stageSamplesAll.push({ x: -diff, goals: row.as, date: row.date, stage: stg });
        if (row.hs < 9 && row.as < 9) stageLikAll.push({ diff, hs: row.hs, as: row.as, date: row.date, stage: stg });
      }
```

- [ ] **Step 6: Compute stage-aware metrics + verdicts**

After the existing `const regimeM = metricsOf(regime);` / draw-gap lines, add:

```ts
  const stageAwareM = metricsOf(stageAware);
  const stageAwareDrawGap = drawRateGap(stageAwareDraw);
  const stageDrawGaps = {
    group: { baseline: r4(drawRateGap(stageDraw.group.baseline)), stageAware: r4(drawRateGap(stageDraw.group.stageAware)) },
    knockout: { baseline: r4(drawRateGap(stageDraw.knockout.baseline)), stageAware: r4(drawRateGap(stageDraw.knockout.stageAware)) },
  };

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
```

- [ ] **Step 7: Add to the output JSON**

Add `"stage-aware": serializeVariant(stageAwareM)` to the `variants` object, and add these top-level keys to `out`:

```ts
    stageDrawGap: stageDrawGaps,
    fallbackCounts: tierCounts,
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
```

Update the `Out` type and `serializeVariant` usage accordingly: add `"stage-aware": SerializedVariant` to `variants`, and add `stageDrawGap`, `fallbackCounts`, `stageAwarePromotion` fields mirroring the shapes above so `renderReport` type-checks.

- [ ] **Step 8: Add to console + markdown report**

After the existing regime console line, add:

```ts
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
```

In `renderReport`, add a `stage-aware` row to the results table and a per-stage draw-gap table:

```ts
  // results table — add this row after the regime row:
  `| stage-aware | ${v["stage-aware"].brier} | [${v["stage-aware"].brierCI.lo}, ${v["stage-aware"].brierCI.hi}] | ${v["stage-aware"].ece} |`
```

```markdown
## Stage-aware draw-rate calibration

| stage | baseline draw-gap | stage-aware draw-gap |
| --- | --- | --- |
| group | ${out.stageDrawGap.group.baseline} | ${out.stageDrawGap.group.stageAware} |
| knockout | ${out.stageDrawGap.knockout.baseline} | ${out.stageDrawGap.knockout.stageAware} |

Fallback tiers: stage ${out.fallbackCounts.stage}, pooled ${out.fallbackCounts.pooled}, baseline ${out.fallbackCounts.baseline}.

- **stage-aware primary:** ${out.stageAwarePromotion.primary.reason}
- **stage-aware secondary:** ${out.stageAwarePromotion.secondary.reason}
```

(`--promote` is NOT touched — it stays scoped to the `regime` rule from Phase 1.)

- [ ] **Step 9: Run the harness and verify output**

Run: `npm run ml:validate`
Expected: completes; console shows a `stage-aware Brier=...` line, a `draw-gap group X->Y knockout X->Y` line, and `stage-aware rule: ... | fallback stage=N pooled=N baseline=N (report-only)`. Then:

Run: `node -e "const o=require('./docs/validation/tournament-validation.json'); console.log('variants:', Object.keys(o.variants)); console.log('stageDrawGap:', JSON.stringify(o.stageDrawGap)); console.log('fallbackCounts:', JSON.stringify(o.fallbackCounts)); console.log('stageAwarePromotion.primary.ship:', o.stageAwarePromotion.primary.ship);"`
Expected: `variants` includes `stage-aware`; `stageDrawGap` has group + knockout baseline/stageAware numbers; `fallbackCounts` sums to the holdout `n`; `stageAwarePromotion` present. Confirm `data/model.json` is unchanged (`git status` shows no model.json diff).

- [ ] **Step 10: Run the full commit-gate sweep**

```bash
npm test && npm run lint && npm run design:inspect && npm run inspect:execution && npm run model:inspect && npm run build
```
Expected: vitest all green (≥ 349: prior 343 + 2 fitStageParams + 2 indexStageLabels + 6 stage-regime), lint 0 errors, all three inspectors pass, build succeeds.

- [ ] **Step 11: Commit**

```bash
git add scripts/validate-model.mts docs/validation/tournament-validation.json docs/validation/validation-report.md
git commit -m "feat: stage-aware regime variant in ml:validate (report-only)"
```

---

## Self-Review

**Spec coverage:**
- Param split (base + rho, shared slope) → Task 1 (`fitStageParams`).
- Stage join → Task 2 (`indexStageLabels`).
- Walk-forward per-stage fit + nested fallback → Task 3 (`fitStageParamsByStage`, `selectStageParams`).
- Harness variant + per-stage draw-gap + fallback counts + pre-registered verdicts → Task 4.
- `MIN_STAGE_SAMPLES=150`, shared pooled slope, unchanged δ/ECE/BOOTSTRAP/SEED → Global Constraints + Task 2/3/4.
- Report-only, no `predict.ts` change, `--promote` untouched → Task 4 Steps 7–8 + Global Constraints.
- Data safety (read-only) → Global Constraints.
- Tests: fixed-slope recovery + directional rho; join hit/miss; leakage + min + null-slope; nested fallback → Tasks 1–3.

**Placeholder scan:** none — every code/test step shows complete code; every run step shows the exact command + expected result.

**Type consistency:** `fitStageParams(samples, likRows, sharedSlope, minBinCount?)` identical across Tasks 1, 3. `StageSample`/`StageLik`/`StageFits`/`FallbackTier` defined in Task 3, consumed in Task 4. `selectStageParams(stage, fits, pooled, baseline)` and `fitStageParamsByStage(samples, liks, beforeDate, sharedSlope, minStageSamples, minBinCount?)` signatures match between Task 3 definition and Task 4 calls. `stageKey`/`StageLabelRow`/`indexStageLabels` consistent across Tasks 2 and 4.
