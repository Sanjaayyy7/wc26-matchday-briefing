# Stage-Aware Regime Model — Design

_Date: 2026-06-24. Phase: modeling half of Phase 1.5 (unblocked by merged `data/stage-labels.json`, PR #36). Eval-first, harness-gated, measurement-only._

## Problem

Phase 1 fit a single tournament-regime parameter set `{baseLogGoals, eloSlope, rho}` and the
holdout harness returned HOLD: on the full 1990+ finals holdout the aggregate draw mass is already
well-calibrated (~1.2pp draw-gap, holdout draw rate 26.2%). The observed "draw-blindness" (38%
predicted vs 22.7% realized) was a **knockout-only** 21-match live sample — a *conditional* failure
the aggregate metric cannot surface.

This phase tests the conditional lever directly: **does fitting the regime separately for group vs
knockout stages sharpen knockout draw calibration without harming aggregate Brier?**

It is measurement-only — like the existing `regime` variant, it does NOT touch live `predict.ts`.
The pre-registered outcome may well be another honest HOLD; the value is the measurement.

## Decision: which parameters split by stage

Per match stage, fit **`baseLogGoals` + `rho`**; **share `eloSlope`** (pooled fit on all prior
finals matches).

Rationale (karpathy-guidelines: surgical, surface assumptions; agentic-engineering: parsimony):

- Knockouts are cagier → lower scoring → more 0-0/1-1 draws. Scoring level (`baseLogGoals`) plausibly
  differs by stage and directly drives draw rate. **Split it.**
- `rho` (Dixon-Coles low-score correlation) is the Phase 1 draw hypothesis. **Split it.**
- `eloSlope` (how an Elo gap maps to goals) is the most data-hungry term and least plausibly
  stage-dependent. Splitting it on the small knockout sample would add variance and likely trip the
  CI gate. **Assumption (made explicit): the Elo→goals slope is stage-invariant. Keep it pooled.**

Splitting all three = overcomplication that overfits the ~25%-of-sample knockout fits.
Splitting `rho` only = too weak; draw rate is driven more by λ magnitude (base) than by `rho`.
Base + rho is the surgical middle that tests the lever. Per stage we estimate only an intercept plus
a 1-D `rho` grid search → low variance even on the smaller knockout sample.

## Data grounding

`data/stage-labels.json` (2157 labels, 1990+): **1516 group, 641 knockout**, across FIFA World Cup,
UEFA Euro, Copa América, AFCON, AFC Asian Cup. Knockout accumulates: ≈169 by 2000, ≈264 by 2006,
≈327 by 2010. Labels are keyed `(date, home, away, tournament)`, derived structurally from the same
`results.csv` the harness loads, so the join is exact and deterministic. Pen-decided knockouts are
draws in `results.csv` (the 90/120-min result) — exactly the knockout-draw signal we want to model.

## Architecture (extend, do not new-file)

### `lib/regime-params.ts` — add `fitStageParams`

```ts
// Fit a stage-specific {baseLogGoals, rho} holding eloSlope fixed at the pooled value.
// baseLogGoals = intercept that best fits this stage's binned log-goal means given sharedSlope;
// rho = existing 1-D grid search on this stage's likRows under that base/slope.
export function fitStageParams(
  samples: GoalSample[],
  likRows: LikRow[],
  sharedSlope: number,
  minBinCount?: number,
): ModelParams;
```

Implementation: bin `samples` as in `fitBaseAndSlope`; with slope fixed, the least-squares intercept
is `mean(y - sharedSlope * x)` over populated bins (`y = log(mean goals)`). Then `fitRho(likRows,
baseLogGoals, sharedSlope)`. Reuses existing binning and `fitRho`; no new math beyond the
fixed-slope intercept. `fitRegimeParams` (pooled) is unchanged and supplies `sharedSlope`.

### `lib/stage-derivation.ts` — add `indexStageLabels`

```ts
// Pure: build an exact lookup from the stage-label list.
export function indexStageLabels(
  labels: Array<{ date: string; home: string; away: string; tournament: string; stage: "group" | "knockout" }>,
): Map<string, "group" | "knockout">; // key = `${date}|${home}|${away}|${tournament}`
```

The harness reads `data/stage-labels.json` and calls this once. A finals match with no entry
(unlabeled / unresolved edition) is treated as **unknown stage** → pooled-regime fallback.

### `scripts/validate-model.mts` — add `stage-aware` variant

- **Accumulate** prior finals samples/likRows partitioned by stage, alongside the existing pooled
  accumulation (`regimeSamplesAll` / `regimeLikAll`) which still supplies the shared slope and the
  pooled fallback.
- **Per tournament instance** (cached by the existing `${tournament}:${year}` key), using only
  matches strictly before that instance's first date:
  1. Fit pooled regime params if `priorL.length ≥ MIN_REGIME_SAMPLES` (existing) → gives `sharedSlope`.
  2. **Only if pooled regime params exist** (so `sharedSlope` is defined): for each stage with
     `≥ MIN_STAGE_SAMPLES` strictly-prior matches of that stage, call
     `fitStageParams(stageSamples, stageLik, sharedSlope, 30)`. The stage fit depends on the pooled
     slope, so it can never activate before the pooled regime does; if pooled is unavailable the
     match falls straight through to baseline.
- **Score** each finals match via nested fallback:
  `params(match.stage)` if fitted → else pooled regime params → else global baseline (`rs`).
- **Collect**: Brier + calibration + draw rows as today, PLUS per-stage draw rows
  (`groupDraw`, `koDraw`) for both baseline and stage-aware, and a tally of which fallback tier
  scored each match.

### Reporting (the deliverable)

`docs/validation/tournament-validation.json` + `validation-report.md` gain:

- `stage-aware` row in the Brier / 95% CI / ECE table.
- **Per-stage draw-gap**: group and knockout, baseline vs stage-aware. (The headline — does the
  knockout draw-gap shrink?)
- **Fallback counts**: how many holdout matches were scored by stage params / pooled regime /
  baseline, so we see how often each tier fired.

## Promotion rules (pre-registered, unchanged)

Challenger = `stage-aware`, incumbent = `baseline`:

- **Primary** (`promotionVerdict`): ΔBrier(baseline − stage-aware) 95% bootstrap CI > 0 **AND**
  stage-aware ECE < `ECE_MAX`.
- **Secondary** (`calibrationWinVerdict`): Brier non-inferior (δ = 0.005) **AND** aggregate
  draw-gap reduced **AND** ECE ok.
- **Knockout draw-gap is a reported diagnostic, NOT a ship gate.** Knockout n is small; inventing a
  third ship rule on it would be overfitting the decision procedure (YAGNI). It informs the next
  phase; it does not flip `model.json`.

`model.json.promotion.shipped` flips to `true` only if a rule fires (via existing `--promote`
path). `predict.ts` is untouched regardless.

## Constants (pre-registered)

| Constant | Value | Note |
| --- | --- | --- |
| `MIN_STAGE_SAMPLES` | 150 | Knockout stage-fit activates ≈2000, aligned with pooled regime's 400-total activation; group (1516) always clears. |
| `MIN_REGIME_SAMPLES` | 400 | Unchanged (pooled fallback + shared slope). |
| non-inferiority δ | 0.005 | Unchanged. |
| `ECE_MAX`, `BOOTSTRAP_N`, `SEED` | existing | 5000 resamples, seed 42. |

## Testing (TDD)

- **lib `regime-params`**: `fitStageParams` recovers the intercept under a fixed slope on synthetic
  data; on a draw-heavy/low-scoring synthetic "knockout" sample vs a "group" sample it returns the
  expected directional difference (lower base, more-negative rho on the cagey set).
- **lib `stage-derivation`**: `indexStageLabels` builds correct keys; lookups hit on present
  triples, miss (return undefined) on absent ones.
- **harness**: stage params for an instance see only strictly-prior **same-stage** matches (leakage
  proof); nested fallback resolves sparse stage → pooled → baseline in order; output is deterministic
  given `SEED`.

## Data safety

Read-only on `data/raw/results.csv` and `data/stage-labels.json`. **Never** run
`ml:fetch` / `matchday` / `pipeline:polymarket` (they refetch and would wipe seeded data).
`ml:validate` is the extended entry point and is manual/offline — NOT a commit gate.

## Success criteria (verifiable)

1. `npm run ml:validate` emits the `stage-aware` variant with Brier + 95% CI + ECE, per-stage
   draw-gaps (group + knockout), and fallback-tier counts.
2. Walk-forward leakage-free, proven by test.
3. Pre-registered verdict printed; `model.json` unchanged unless a rule fires.
4. All commit gates green: `npm test`, `npm run lint` (0 errors), `design:inspect`,
   `inspect:execution`, `model:inspect`, `npm run build`.

## Scope / YAGNI

One new variant inside the existing harness; one new lib primitive (`fitStageParams`); one join
helper (`indexStageLabels`); harness wiring; tests. No new npm script, no `predict.ts` change, no
third ship rule, no unrelated refactor.
