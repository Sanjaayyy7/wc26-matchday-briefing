# Phase 3 — Feature signals: rest-days + goal-form (design)

**Date:** 2026-07-06
**Status:** Spec — awaiting user review
**Branch:** `feat/phase3-feature-signals`
**Prior art:** Phase VIII regime (PR #35), Phase 1.5 stage-aware (PR #38), Phase 2 market shadow (PR #37) — all HOLD. Market beats model at every blend λ (model 0.5414 / market 0.4965 at n=69). This is the "richer signal" lever those verdicts pointed to.
**Literature:** Wong et al. 2025 (*Decision Analytics Journal* 14:100537) — fatigue (days since last game) + momentum (rolling goal averages) are the two feature families computable from a results-only dataset. Shot/corner/card momentum and weather are NOT feasible (martj42 has scores only). Player availability: low prior (paper: lineups don't improve predictions).

## Problem

The shipped model is Elo + Dixon-Coles: the only per-match signal is the Elo diff. Two matches with identical ratings get identical splits regardless of whether one side played 3 days ago or is on a 5-game scoring tear. Six straight validation HOLDs say the current signal is exhausted; the market gap (~0.045 Brier) needs *new information*, not re-weighting of the old.

## Goal / non-goals

**Goal:** a `features` variant in the walk-forward tournament harness (`npm run ml:validate`) that adjusts Dixon-Coles goal rates with two pre-registered feature signals, evaluated under the existing promotion rules. Report-only: `predict.ts` and `model.json` byte-untouched (adoption is a separate phase gated on a SHIP verdict, same as stage-aware).

**Non-goals:** new data sources; weather; player data; XGB/ensemble re-ranks (paper's 52-feature ensemble still lost to bookmakers); any UI change; any live-prediction change.

## Feature definitions (pre-registered)

Both computed walk-forward from rows already in `results.csv`, state accumulated over ALL matches (friendlies included — rest and form are real regardless of competition), βs fit on finals-tournament rows only (same regime the harness scores).

1. **Rest diff** — days since each team's previous match, clamped to [3, 14] (≥14 = fully rested; the clamp keeps inter-tournament gaps from dominating). Feature = `(clampedHome − clampedAway) / 11` ∈ [−1, 1]. Zero when both fully rested — the common case outside tournaments; the signal lives inside congested tournament windows (this WC: R16 → QF on 3–5 days).
2. **Goal-form diff** — mean goal difference over each team's last 5 matches (min 3 to activate, else 0). Feature = `(formHome − formAway) / 3`, clamped to [−1, 1]. Raw form deliberately NOT residualized against Elo in v1 (simplicity first; Elo updates lag form by design — K is small — so recent-form signal is not fully absorbed).

## Approaches considered

**A. λ-multiplier via walk-forward Poisson MLE (recommended).**
`λ'_home = λ_home · exp(β_r·restF + β_f·formF)`, symmetric for away (features negated). Two scalars (β_r, β_f) fit by maximizing Dixon-Coles log-likelihood on strictly-prior finals matches (expanding window, per-instance cache — exactly the regime/stage pattern). Interpretable, tiny param count (no overfit on ~4k regime samples), reuses `scoreGrid`/`summarizeGrid` untouched.

**B. Elo-diff adjustment.** Add `k_r·restF + k_f·formF` Elo points before `lambdasFromElo`. Single insertion point, but conflates persistent rating with transient state, and the k's units (Elo points) make the fit awkward against the existing binned-means machinery. Rejected.

**C. Paper-style ML ensemble.** Needs box-score features we don't have; the paper's own ensemble only matched bookmakers on accuracy. Rejected.

## Architecture

- **`lib/feature-signals.ts` (new, pure):**
  - `FeatureTracker` — per-team state (last match date, ring buffer of last-5 goal diffs); `pushMatch(state, row)` + `featuresFor(state, row)` → `{ restF, formF }`. Pure data-in/data-out, no I/O.
  - `fitFeatureBetas(likRows, params, iters)` — gradient ascent on DC log-likelihood over (β_r, β_f); likRow = `{ diff, hs, as, restF, formF }`. Returns `{ betaRest, betaForm }`.
  - `applyFeatureAdjust(lambdas, feats, betas)` → adjusted `{ home, away }`.
- **`scripts/validate-model.mts`:** `features` variant wired like `regime`/`stage-aware`: tracker updated per row in the main loop; per-instance β cache keyed `tournament:year`; `MIN_FEATURE_SAMPLES = 400` (reuse regime convention); fallback = pooled baseline params when under-sampled. Base λs come from the pooled global params (isolate the feature effect from the regime intercept question).
- **Report:** variant metrics + fitted βs + activation counts into `docs/validation/tournament-validation.json` + `validation-report.md` (same shape as stage-aware).

## Promotion rule (pre-registered, unchanged)

SHIP iff ΔBrier(baseline − features) 95% bootstrap CI > 0 (B=5000, seed=42) AND features ECE < 0.03; else the `calibrationWinVerdict` secondary rule (δ=0.005 non-inferiority + draw-gap ≥5pp improvement); else HOLD. No peeking, no rule edits after seeing results.

## Testing

TDD per unit: tracker (rest clamps, ring buffer, min-3 form gate, cold start), fitter (recovers known βs on synthetic DC data; β=0 on featureless data), adjuster (exp symmetry, zero-feature identity), harness integration (leakage: features for match at date D use only rows < D; per-instance cache boundaries). Mirror `tests/regime-params.test.ts` structure.

## Risks

- Rest-days ≈ 0 variance outside tournaments → β_r fit dominated by tournament rows: correct — that's the regime we score.
- Form double-counts Elo: βs can go to ~0 in the fit; that's the honest outcome and the harness will say HOLD.
- 7th HOLD is a real possibility. The harness exists to say no cheaply.
