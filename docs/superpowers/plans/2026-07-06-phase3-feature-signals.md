# Phase 3 Feature Signals (rest-days + goal-form) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a report-only `features` variant to the walk-forward tournament harness that adjusts Dixon-Coles goal rates with rest-days and goal-form signals, evaluated under the pre-registered promotion rules.

**Architecture:** New pure module `lib/feature-signals.ts` (per-team walk-forward state, coordinate-grid-search MLE fitter, λ adjuster) wired into `scripts/validate-model.mts` exactly like the `regime` variant (per-instance expanding-window fit cache, min-samples fallback to baseline). `predict.ts` and `data/model.json` stay byte-untouched.

**Tech Stack:** TypeScript (strict), vitest, existing `lib/poisson-model.ts` (`scoreGrid`, `ModelParams`) and `lib/validation.ts` (`promotionVerdict`, `calibrationWinVerdict`).

**Spec:** `docs/superpowers/specs/2026-07-06-phase3-feature-signals-design.md`

## Global Constraints

- Report-only: no changes to `lib/predict.ts`, `data/model.json`, or any UI file.
- Pre-registered: `MIN_FEATURE_SAMPLES = 400`; β grid `[-0.3, 0.3]` step `0.02`; rest clamp `[3, 14]`; form window last 5, min 3; promotion rules verbatim from existing harness (no new thresholds).
- Walk-forward purity: features for a match at date D must derive only from matches with date < D (state pushed AFTER the row is scored, same as Elo/calibPairs).
- Repo gates before any commit: `npx vitest run` green, `npx eslint .` 0 errors.
- JSX/lib comment gotchas: no hyphenated `shadow-` substring in lib/ comments (design-inspector regex); no HTML entities.
- Files under 500 lines. CommonJS not applicable (repo is ESM/TS).
- Never run `npm run matchday` / `ml:fetch` / `ml:cycle`.

---

### Task 1: Feature tracker — `lib/feature-signals.ts` (state + features)

**Files:**
- Create: `lib/feature-signals.ts`
- Test: `tests/feature-signals.test.ts`

**Interfaces:**
- Produces (Task 2 and 3 consume):
  - `type TeamFeatState = { lastDate: string | null; recentGd: number[] }`
  - `type FeatureState = Map<string, TeamFeatState>`
  - `newFeatureState(): FeatureState`
  - `matchFeatures(state: FeatureState, row: { date: string; home: string; away: string }): { restF: number; formF: number }`
  - `pushMatch(state: FeatureState, row: { date: string; home: string; away: string; hs: number; as: number }): void`

Definitions (from spec, pre-registered):
- rest days = whole days between `row.date` and team's `lastDate` (`(Date.parse(a) - Date.parse(b)) / 86400000`), clamped to `[3, 14]`; no prior match ⇒ 14 (fully rested).
- `restF = (clampedHome - clampedAway) / 11` (∈ [−1, 1] by construction).
- team form = mean of `recentGd` (last-5 ring buffer of signed goal diffs, most recent last); fewer than 3 entries ⇒ 0.
- `formF = clamp((formHome - formAway) / 3, -1, 1)`.

- [ ] **Step 1: Write the failing tests**

```ts
// tests/feature-signals.test.ts
import { describe, expect, it } from "vitest";
import {
  newFeatureState,
  matchFeatures,
  pushMatch,
} from "@/lib/feature-signals";

describe("matchFeatures", () => {
  it("cold start: both unseen teams are fully rested with zero form", () => {
    const s = newFeatureState();
    expect(matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" })).toEqual({
      restF: 0,
      formF: 0,
    });
  });

  it("rest diff: 4 days vs 14+ days, clamped and scaled", () => {
    const s = newFeatureState();
    pushMatch(s, { date: "2026-07-05", home: "fra", away: "x1", hs: 1, as: 0 });
    pushMatch(s, { date: "2026-06-01", home: "mar", away: "x2", hs: 1, as: 0 });
    // fra rested 4 days (clamp 4), mar 38 days (clamp 14) → (4 − 14)/11
    const f = matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" });
    expect(f.restF).toBeCloseTo((4 - 14) / 11, 10);
  });

  it("rest clamps at 3 days minimum", () => {
    const s = newFeatureState();
    pushMatch(s, { date: "2026-07-08", home: "fra", away: "x1", hs: 0, as: 0 });
    pushMatch(s, { date: "2026-07-08", home: "mar", away: "x2", hs: 0, as: 0 });
    // both 1 day → both clamp to 3 → 0
    expect(matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" }).restF).toBe(0);
  });

  it("form needs at least 3 matches, uses last-5 mean goal diff", () => {
    const s = newFeatureState();
    // fra: 6 matches, gds +1,+1,+1,+2,+2,+3 → last 5 = +1,+1,+2,+2,+3 → mean 1.8
    const gds: Array<[number, number]> = [[1, 0], [2, 1], [3, 2], [2, 0], [4, 2], [3, 0]];
    gds.forEach(([hs, as], i) =>
      pushMatch(s, { date: `2026-06-0${i + 1}`, home: "fra", away: `y${i}`, hs, as }),
    );
    // mar: only 2 matches → form 0
    pushMatch(s, { date: "2026-06-01", home: "mar", away: "z1", hs: 0, as: 4 });
    pushMatch(s, { date: "2026-06-05", home: "mar", away: "z2", hs: 0, as: 4 });
    const f = matchFeatures(s, { date: "2026-06-20", home: "fra", away: "mar" });
    expect(f.formF).toBeCloseTo(Math.min((1.8 - 0) / 3, 1), 10);
  });

  it("away perspective: goal diff is signed from the team's side", () => {
    const s = newFeatureState();
    // mar loses 0-4 three times AS AWAY team → gd −4 each → form −4
    for (let i = 1; i <= 3; i++)
      pushMatch(s, { date: `2026-06-0${i}`, home: `w${i}`, away: "mar", hs: 4, as: 0 });
    for (let i = 1; i <= 3; i++)
      pushMatch(s, { date: `2026-06-0${i}`, home: "fra", away: `v${i}`, hs: 0, as: 0 });
    const f = matchFeatures(s, { date: "2026-06-20", home: "fra", away: "mar" });
    // (0 − (−4))/3 = 1.333 → clamped to 1
    expect(f.formF).toBe(1);
  });
});
```

- [ ] **Step 2: Run tests, verify they fail**

Run: `npx vitest run tests/feature-signals.test.ts`
Expected: FAIL — `Cannot find module '@/lib/feature-signals'`

- [ ] **Step 3: Implement**

```ts
// lib/feature-signals.ts
//
// Phase 3 feature signals: rest-days and goal-form, computed walk-forward
// from results rows. Pure — no I/O. State is pushed AFTER a match is scored
// so features for date D only ever see matches strictly before D.
// Pre-registered: rest clamp [3,14] days; form = last-5 mean goal diff,
// minimum 3 matches; both scaled to [-1, 1].

export type TeamFeatState = { lastDate: string | null; recentGd: number[] };
export type FeatureState = Map<string, TeamFeatState>;

const REST_MIN = 3;
const REST_MAX = 14;
const FORM_WINDOW = 5;
const FORM_MIN = 3;

export function newFeatureState(): FeatureState {
  return new Map();
}

const teamState = (state: FeatureState, team: string): TeamFeatState => {
  let t = state.get(team);
  if (!t) {
    t = { lastDate: null, recentGd: [] };
    state.set(team, t);
  }
  return t;
};

const restDays = (t: TeamFeatState, date: string): number => {
  if (t.lastDate === null) return REST_MAX;
  const days = (Date.parse(date) - Date.parse(t.lastDate)) / 86_400_000;
  return Math.max(REST_MIN, Math.min(REST_MAX, days));
};

const form = (t: TeamFeatState): number =>
  t.recentGd.length < FORM_MIN
    ? 0
    : t.recentGd.reduce((a, b) => a + b, 0) / t.recentGd.length;

export function matchFeatures(
  state: FeatureState,
  row: { date: string; home: string; away: string },
): { restF: number; formF: number } {
  const h = teamState(state, row.home);
  const a = teamState(state, row.away);
  const restF = (restDays(h, row.date) - restDays(a, row.date)) / (REST_MAX - REST_MIN);
  const rawForm = (form(h) - form(a)) / 3;
  const formF = Math.max(-1, Math.min(1, rawForm));
  return { restF, formF };
}

export function pushMatch(
  state: FeatureState,
  row: { date: string; home: string; away: string; hs: number; as: number },
): void {
  const h = teamState(state, row.home);
  const a = teamState(state, row.away);
  h.lastDate = row.date;
  a.lastDate = row.date;
  h.recentGd.push(row.hs - row.as);
  a.recentGd.push(row.as - row.hs);
  if (h.recentGd.length > FORM_WINDOW) h.recentGd.shift();
  if (a.recentGd.length > FORM_WINDOW) a.recentGd.shift();
}
```

Note `(REST_MAX - REST_MIN)` = 11 matches the spec's `/11`.

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/feature-signals.test.ts`
Expected: PASS (5 tests)

- [ ] **Step 5: Commit**

```bash
git add lib/feature-signals.ts tests/feature-signals.test.ts
git commit -m "feat(model): walk-forward rest-days + goal-form feature tracker"
```

---

### Task 2: Fitter + adjuster — `fitFeatureBetas`, `applyFeatureAdjust`

**Files:**
- Modify: `lib/feature-signals.ts` (append)
- Test: `tests/feature-signals.test.ts` (append)

**Interfaces:**
- Consumes: `ModelParams`, `scoreGrid` from `lib/poisson-model.ts`.
- Produces (Task 3 consumes):
  - `type FeatureLikRow = { diff: number; hs: number; as: number; restF: number; formF: number }`
  - `type FeatureBetas = { betaRest: number; betaForm: number }`
  - `fitFeatureBetas(likRows: FeatureLikRow[], params: ModelParams): FeatureBetas`
  - `applyFeatureAdjust(lambdas: { home: number; away: number }, feats: { restF: number; formF: number }, betas: FeatureBetas): { home: number; away: number }`

Fitting = coordinate grid search maximizing Dixon-Coles exact-score log-likelihood (repo idiom — same objective and grid style as `fitRho` in `lib/regime-params.ts`; deterministic, no learning-rate tuning). β grid `[-0.3, 0.3]` step `0.02`; two full sweeps (rest, form, rest, form); λs reconstructed from `params` and the row's `diff`, `rho` fixed at `params.rho`.

- [ ] **Step 1: Write the failing tests (append to tests/feature-signals.test.ts)**

```ts
import {
  applyFeatureAdjust,
  fitFeatureBetas,
  type FeatureLikRow,
} from "@/lib/feature-signals";
import { scoreGrid, type ModelParams } from "@/lib/poisson-model";

const PARAMS: ModelParams = { baseLogGoals: 0.155, eloSlope: 0.85, rho: -0.05 };

describe("applyFeatureAdjust", () => {
  it("identity at zero features and zero betas", () => {
    const l = { home: 1.4, away: 1.1 };
    expect(applyFeatureAdjust(l, { restF: 0, formF: 0 }, { betaRest: 0.2, betaForm: 0.1 })).toEqual(l);
    expect(applyFeatureAdjust(l, { restF: 0.5, formF: -0.3 }, { betaRest: 0, betaForm: 0 })).toEqual(l);
  });

  it("boosts home and suppresses away symmetrically", () => {
    const l = { home: 1.0, away: 1.0 };
    const out = applyFeatureAdjust(l, { restF: 1, formF: 0 }, { betaRest: 0.1, betaForm: 0 });
    expect(out.home).toBeCloseTo(Math.exp(0.1), 10);
    expect(out.away).toBeCloseTo(Math.exp(-0.1), 10);
  });
});

describe("fitFeatureBetas", () => {
  // Deterministic LCG so the synthetic data is reproducible.
  const lcg = (seed: number) => () => {
    seed = (seed * 1664525 + 1013904223) % 4294967296;
    return seed / 4294967296;
  };

  const samplePoisson = (lambda: number, rnd: () => number): number => {
    let k = 0;
    let p = Math.exp(-lambda);
    let cdf = p;
    const u = rnd();
    while (u > cdf && k < 8) {
      k += 1;
      p = (p * lambda) / k;
      cdf += p;
    }
    return k;
  };

  const synth = (betaForm: number, n: number): FeatureLikRow[] => {
    const rnd = lcg(42);
    const rows: FeatureLikRow[] = [];
    for (let i = 0; i < n; i++) {
      const formF = rnd() * 2 - 1;
      const lh = Math.exp(PARAMS.baseLogGoals + betaForm * formF);
      const la = Math.exp(PARAMS.baseLogGoals - betaForm * formF);
      rows.push({ diff: 0, hs: samplePoisson(lh, rnd), as: samplePoisson(la, rnd), restF: 0, formF });
    }
    return rows;
  };

  it("recovers a planted form effect (sign and rough size)", () => {
    const betas = fitFeatureBetas(synth(0.2, 4000), PARAMS);
    expect(betas.betaForm).toBeGreaterThan(0.1);
    expect(betas.betaForm).toBeLessThan(0.3);
  });

  it("finds no effect in featureless data", () => {
    const betas = fitFeatureBetas(synth(0, 4000), PARAMS);
    expect(Math.abs(betas.betaForm)).toBeLessThanOrEqual(0.04);
    expect(Math.abs(betas.betaRest)).toBeLessThanOrEqual(0.04);
  });
});
```

- [ ] **Step 2: Run tests, verify the new ones fail**

Run: `npx vitest run tests/feature-signals.test.ts`
Expected: FAIL — `applyFeatureAdjust is not a function` (Task 1 tests still pass)

- [ ] **Step 3: Implement (append to lib/feature-signals.ts)**

```ts
import { scoreGrid, type ModelParams } from "./poisson-model";

export type FeatureLikRow = {
  diff: number;
  hs: number;
  as: number;
  restF: number;
  formF: number;
};
export type FeatureBetas = { betaRest: number; betaForm: number };

const BETA_MIN = -0.3;
const BETA_MAX = 0.3;
const BETA_STEP = 0.02;

export function applyFeatureAdjust(
  lambdas: { home: number; away: number },
  feats: { restF: number; formF: number },
  betas: FeatureBetas,
): { home: number; away: number } {
  const shift = betas.betaRest * feats.restF + betas.betaForm * feats.formF;
  if (shift === 0) return lambdas;
  return { home: lambdas.home * Math.exp(shift), away: lambdas.away * Math.exp(-shift) };
}

function featureLL(likRows: FeatureLikRow[], params: ModelParams, betas: FeatureBetas): number {
  let ll = 0;
  for (const m of likRows) {
    if (m.hs >= 9 || m.as >= 9) continue;
    const base = {
      home: Math.exp(params.baseLogGoals + params.eloSlope * m.diff),
      away: Math.exp(params.baseLogGoals - params.eloSlope * m.diff),
    };
    const l = applyFeatureAdjust(base, m, betas);
    const grid = scoreGrid(l.home, l.away, params.rho);
    ll += Math.log(Math.max(grid[m.hs][m.as], 1e-12));
  }
  return ll;
}

/** Coordinate grid search (two sweeps over betaRest then betaForm) maximizing
 *  Dixon-Coles exact-score log-likelihood — same objective and grid idiom as
 *  fitRho. Deterministic. */
export function fitFeatureBetas(likRows: FeatureLikRow[], params: ModelParams): FeatureBetas {
  const betas: FeatureBetas = { betaRest: 0, betaForm: 0 };
  for (let sweep = 0; sweep < 2; sweep++) {
    for (const key of ["betaRest", "betaForm"] as const) {
      // Seed with the incumbent value and replace only on STRICT improvement:
      // when a feature is constant (all-tied likelihoods) the beta stays put
      // instead of drifting to a grid endpoint.
      let best = { v: betas[key], ll: featureLL(likRows, params, betas) };
      for (let v = BETA_MIN; v <= BETA_MAX + 1e-9; v += BETA_STEP) {
        const ll = featureLL(likRows, params, { ...betas, [key]: v });
        if (ll > best.ll) best = { v, ll };
      }
      betas[key] = Number(best.v.toFixed(2));
    }
  }
  return betas;
}
```

- [ ] **Step 4: Run tests, verify pass**

Run: `npx vitest run tests/feature-signals.test.ts`
Expected: PASS (9 tests). The synthetic-recovery test does ~2 sweeps × 2 coords × 31 grid values × 4000 rows of 9×9 grids — allow a few seconds.

- [ ] **Step 5: Commit**

```bash
git add lib/feature-signals.ts tests/feature-signals.test.ts
git commit -m "feat(model): feature-beta MLE fitter and lambda adjuster"
```

---

### Task 3: Wire `features` variant into the harness

**Files:**
- Modify: `scripts/validate-model.mts`

**Interfaces:**
- Consumes: everything Task 1 + 2 produce; existing harness internals (`newCollector`, `record`, `metricsOf`, `rawSplit`, `promotionVerdict`, `calibrationWinVerdict`, `drawRateGap`, `serializeVariant`, `r4`, per-instance cache pattern keyed `tournament:year`).
- Produces: `variants.features` + `featurePromotion` (+ `featureBetas`, `featureFallback`) in `docs/validation/tournament-validation.json`; a `features` row + section in `validation-report.md`; console row.

Wiring mirrors the `regime` variant exactly. Key points the implementer must follow:

1. Imports:
```ts
import {
  applyFeatureAdjust,
  fitFeatureBetas,
  matchFeatures,
  newFeatureState,
  pushMatch,
  type FeatureBetas,
  type FeatureLikRow,
} from "../lib/feature-signals";
import { summarizeGrid, scoreGrid } from "../lib/poisson-model"; // scoreGrid may already be imported — reuse the existing import line
```

2. Declarations next to the regime ones (after `const MIN_STAGE_SAMPLES = 150;`):
```ts
const MIN_FEATURE_SAMPLES = 400;
const featState = newFeatureState();
const featLikAll: Array<{ l: FeatureLikRow; date: string }> = [];
const featBetaCache = new Map<string, FeatureBetas | null>();
const features = newCollector();
const featuresDraw: Array<{ pDraw: number; isDraw: boolean }> = [];
const featTierCounts = { features: 0, baseline: 0 };
```

3. Inside the scoring block (`if (isFinalsTournament(...) && row.date >= EVAL_FROM)`), compute features BEFORE any state push, fit per instance with the expanding strictly-prior window:
```ts
const feats = matchFeatures(featState, row);
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
```
(`lambdasFromElo` is already imported at the top of the file; check and reuse. `Split` shape matches `rawSplit`'s return.)

4. In the accumulation block (where `regimeLikAll` is pushed — AFTER scoring, before Elo update), add the feature lik row using the same `diff` already computed there:
```ts
if (row.hs < 9 && row.as < 9)
  featLikAll.push({ l: { diff, hs: row.hs, as: row.as, restF: feats.restF, formF: feats.formF }, date: row.date });
```
`feats` must be hoisted so it is visible here: compute `const feats = matchFeatures(featState, row)` ONCE per row BEFORE the scoring block (it is cheap and needed in both blocks; features for non-finals rows are computed but only pushed for finals rows — fine). CRITICAL: `pushMatch(featState, { date: row.date, home: row.home, away: row.away, hs: row.hs, as: row.as })` goes at the very END of the loop body (next to the Elo update), for EVERY row (friendlies included — rest/form state accrues across all matches), and strictly after `feats` was read.

5. After the loop, verdicts + output (mirror the stage-aware block):
```ts
const featuresM = metricsOf(features);
const featuresDrawGap = drawRateGap(featuresDraw);
const featPrimary = promotionVerdict(base.brierByMatch, features.brierByMatch, featuresM.ece, { n: BOOTSTRAP_N, seed: SEED });
const featSecondary = calibrationWinVerdict(base.brierByMatch, features.brierByMatch, {
  baselineDrawGap,
  challengerDrawGap: featuresDrawGap,
  challengerEce: featuresM.ece,
  n: BOOTSTRAP_N,
  seed: SEED,
});
```
In `out`: add `features: serializeVariant(featuresM)` to `variants`; add top-level
```ts
featurePromotion: {
  incumbent: "baseline",
  challenger: "features",
  note: "report-only; rest-days + goal-form lambda multipliers (Phase 3)",
  betasLastInstance: [...featBetaCache.values()].filter(Boolean).at(-1) ?? null,
  fallbackCounts: featTierCounts,
  drawGap: r4(featuresDrawGap),
  primary: { ship: featPrimary.ship, deltaBrierCI: { mean: r4(featPrimary.deltaBrierCI.mean), lo: r4(featPrimary.deltaBrierCI.lo), hi: r4(featPrimary.deltaBrierCI.hi) }, eceOk: featPrimary.eceOk, reason: featPrimary.reason },
  secondary: { ship: featSecondary.ship, nonInferior: featSecondary.nonInferior, drawGapReduced: featSecondary.drawGapReduced, eceOk: featSecondary.eceOk, reason: featSecondary.reason },
},
```
Update the `Out` type/interface accordingly (find where `type Out` is declared — extend it; if it is `typeof out`, nothing to do).

6. `renderReport`: add `| features | ${v.features.brier} | [${v.features.brierCI.lo}, ${v.features.brierCI.hi}] | ${v.features.ece} |` to the Results table and a section:
```
## Feature-signals promotion (rest-days + goal-form)

- **primary:** ${out.featurePromotion.primary.reason}
- **secondary:** ${out.featurePromotion.secondary.reason}
- fitted betas (latest instance): ${JSON.stringify(out.featurePromotion.betasLastInstance)}
- activation: ${out.featurePromotion.fallbackCounts.features} feature-adjusted / ${out.featurePromotion.fallbackCounts.baseline} baseline fallback
```
7. Console summary: add `["features", featuresM]` to the console table array.

- [ ] **Step 1: Make the edits above**
- [ ] **Step 2: Type-check + lint**

Run: `npx tsc --noEmit 2>/dev/null || npx eslint scripts/validate-model.mts`
Expected: 0 errors (repo may not have a bare tsc script — eslint + vitest carry type safety here; `npm run build` in Task 4 is the hard type gate).

- [ ] **Step 3: Run the harness**

Run: `npm run ml:validate`
Expected: completes (feature fits add ~1–2s per tournament instance; total may take a few minutes); console table shows a `features` row; `docs/validation/tournament-validation.json` contains `variants.features` + `featurePromotion`. Baseline row numbers must be IDENTICAL to the previous run (adding a variant must not perturb existing ones — if baseline moved, the loop was contaminated; find and fix before proceeding).

- [ ] **Step 4: Record the verdict honestly**

Whatever it says — SHIP or 7th HOLD — the JSON + report are the deliverable. Do NOT touch predict.ts/model.json regardless of verdict (adoption is a separate phase).

- [ ] **Step 5: Full test suite**

Run: `npx vitest run`
Expected: all green (417 + 9 new = 426).

- [ ] **Step 6: Commit**

```bash
git add scripts/validate-model.mts docs/validation/
git commit -m "feat(model): features variant (rest+form lambda multipliers) in tournament harness"
```

---

### Task 4: Gates, docs, PR

**Files:**
- Modify: none beyond what CI gates touch.

- [ ] **Step 1: All gates**

Run: `npx vitest run && npx eslint . && npm run build && npm run design:inspect && npm run inspect:execution && npm run model:inspect`
Expected: vitest green, eslint 0 errors (12 pre-existing warnings OK), build succeeds, all three inspectors pass. model:inspect must still say the shipped model traces to a real verdict (`promotion.shipped:false` untouched).

- [ ] **Step 2: Push + PR**

```bash
git push -u origin feat/phase3-feature-signals
gh pr create --title "feat(model): Phase 3 feature signals — rest-days + goal-form harness variant" --body "<summary: spec link, feature definitions, fitter design, verdict verbatim from validation-report.md, gates>"
```

- [ ] **Step 3: Report the verdict to the user verbatim** (Brier, CI, ECE, βs, rule fired or HOLD).

---

## Self-review notes

- Spec coverage: tracker (spec §Feature definitions) = Task 1; fitter+adjuster (§Architecture bullet 2–3) = Task 2; harness variant + report + promotion rules (§Architecture bullet 4, §Promotion rule) = Task 3; report-only guarantee + gates = Global Constraints + Task 4. Spec's "gradient ascent" refined to coordinate grid search — same MLE objective, matches `fitRho` idiom, deterministic; noted in spec deviation log below.
- Type consistency: `FeatureLikRow.diff` matches `LikRow.diff` semantics ((effHome−eloAway)/400, home-advantage included, as computed at the accumulation site); `FeatureBetas` used identically in fitter/adjuster/harness.
- Placeholder scan: none.

**Spec deviation (approved-by-plan):** fitter uses coordinate grid search, not gradient ascent — same objective (DC log-likelihood), deterministic, repo-idiomatic.
