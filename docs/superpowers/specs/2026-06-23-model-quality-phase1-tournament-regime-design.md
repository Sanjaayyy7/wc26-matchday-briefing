# Model Quality — Phase 1: Tournament-regime model + `model:inspect` gate

_Design spec. Approved approach: regime-specific parameters (Approach 1). Part of the staged Model-Quality program; Phases 2 (market blend) and 3 (rest/players/sentiment features) are out of scope here and sketched only at the end._

## Context

The live product (`wc26-matchday-briefing`) predicts **only World Cup 2026 matches** — i.e. every fixture it serves is finals-tournament football. The prediction model (`lib/poisson-model.ts`: World-Football-Elo → Dixon-Coles double Poisson) is trained by `scripts/train-model.mts` on the martj42 international-results dataset, which is **dominated by friendlies and qualifiers**. It fits a single global parameter set `{baseLogGoals, eloSlope, rho}` (currently `model.json`: ~`{0.156, 0.849, -0.05}`).

The freshly-merged tournament-holdout harness (`npm run ml:validate`, PR #34) measured the model on the regime it actually runs in (finals tournaments, walk-forward, n=2237) and established two facts:

- Tournament Brier **0.577** vs ~0.509 on the friendly-heavy `ml:eval` split — a real regime shift.
- Post-hoc Platt recalibration gives **no** significant Brier gain (ΔBrier 95% CI straddles 0 → HOLD). **Recalibration is tapped out.**

Separately, the live record documents the model's **#1 failure mode — draw-blindness** (`docs/phase-iv/executive-forecast-recovery-report.md`): observed draw rate ~38% vs ~22.7% predicted; the model topped a draw as its most-likely outcome **0 / 21** matches (and 0/11 in Phase V); 4 of 6 favorites at ≥70% drew. Root causes recorded there: rho under-tuned for tournaments, lambdas too high for favorites in cagey knockout games, calibration fit on a lower-draw regime.

**Conclusion:** gains must come from model **structure on the correct regime**, not more calibration. The model serves tournament matches with friendly-trained parameters — so it systematically under-weights draws and over-sharpens favorites. Phase 1 fixes that and builds the enforcement gate every later phase reuses.

## Problem statement

Fit a **tournament-regime parameter set** for the generative model, validate it walk-forward through the existing harness under a **pre-registered** rule, promote it into the live model **only if** the harness says it is real, and guard the whole loop with a new `model:inspect` build gate — without touching locked predictions or violating data-safety.

## Goals (pre-registered success criteria)

All measured by `npm run ml:validate` on the finals-tournament holdout (walk-forward, no leakage), pre-registered here to prevent post-hoc goalpost-moving:

1. **Regime params fit honestly.** A tournament-regime `{baseLogGoals, eloSlope, rho}` is fit from finals-tournament matches only, strictly-prior to any match it is scored on.
2. **Promotion rule — primary (Brier win).** Ship the regime variant iff `ΔBrier(incumbent − regime)` 95% bootstrap CI > 0 (B=5000, seed=42) **AND** regime ECE < 0.03. This reuses `promotionVerdict` from `lib/validation.ts` unchanged.
3. **Promotion rule — secondary (calibration win), also pre-registered.** If the primary rule does not fire but the regime variant is **non-inferior** on Brier (ΔBrier 95% CI lower bound ≥ −δ, where **δ = 0.005 Brier points**, a pre-registered non-inferiority margin) **AND** reduces the draw-rate calibration gap by ≥ 5 percentage points **AND** ECE < 0.03 → ship as an explicitly-labeled "calibration win." Rationale: a tournament draw-fix is expected to land Brier-neutral (the CI straddles 0, as Platt did) while materially improving draw calibration; δ bounds how much Brier we are willing to trade for that honesty, and the draw-gap condition ensures we only trade it for a real calibration gain. We decide all thresholds *now*, not after seeing results.
4. **Draw diagnostic reported.** The harness reports the draw-rate gap `|mean predicted P(draw) − observed draw frequency|` for each variant, so the draw fix is visible and auditable.
5. **`model:inspect` gate exists** and fails the build when the live model is not traceable to a harness-validated promotion (details below).
6. **No regression elsewhere.** `ml:train`'s existing gates still pass (beats uniform, ECE < 0.03, friendly-split Brier < 0.51). Full vitest suite green.

If neither promotion rule fires, the honest outcome is **HOLD + report** (exactly as Platt did). That is an acceptable Phase-1 result — the harness is the arbiter, not the wish.

## Non-goals (deferred)

- Market blend (Polymarket/Kalshi) — **Phase 2**.
- Rest/congestion, player-availability, form/sentiment features — **Phase 3**.
- Re-architecting away from Dixon-Coles (gradient-boosted / hierarchical) — out of scope; YAGNI.
- Re-locking or re-grading any existing prediction — locked predictions are immutable.

## Approach (Approach 1 — regime-specific parameters)

Tournament football is lower-scoring and compresses favorites (tighter games, more draws). Fitting `{baseLogGoals, eloSlope, rho}` on finals-tournament matches is expected to yield **lower base goals**, a **flatter eloSlope**, and a **more-negative rho** — all of which lift draw mass toward the observed ~38% and reduce favorite over-sharpening. The change is interpretable, small-surface, and native to the existing harness.

### Why not the alternatives
- **Global model + post-hoc draw-inflation term** (Approach 2): less principled, a magic correction factor that is hard to fit honestly walk-forward.
- **Full re-architecture** (Approach 3): high effort/risk, unjustified before the cheap structural fix is measured.

## Components & interfaces

### New: `lib/regime-params.ts` (pure)
- `fitRegimeParams(samples, likPairs): ModelParams` — pure fit of `{baseLogGoals, eloSlope}` (binned log-mean regression) + `rho` (likelihood grid search), identical *method* to `train-model.mts` but over a **caller-supplied** subset of matches. Extracting the fit into a pure, tested function lets both the trainer and the harness call it without duplicating the regression.
- `drawRateGap(pairs): number` — pure draw-class calibration diagnostic.
- Reuses existing primitives; introduces no new math.

This refactor pulls the regression currently inline in `train-model.mts` into a tested unit (the file is doing several things; this is a targeted improvement that serves the goal, per brainstorming guidance — not unrelated refactoring).

### Changed: `scripts/train-model.mts`
- Fit the existing **global** params (unchanged path), **and** a **tournament-regime** set via `fitRegimeParams` over finals-tournament rows only.
- Write both to `model.json`: keep `params` (global, back-compat) and add `regimeParams.tournament`. Add `promotion` provenance block (see protocol). Existing gates unchanged.

### Changed: `scripts/validate-model.mts`
- Add a **third variant** `regime` computed with the tournament-regime params, fit walk-forward (strictly-prior finals-tournament matches, same trailing-window discipline as the per-instance Platt cache).
- Compare `regime` vs `baseline` with `promotionVerdict` (primary rule) and compute the secondary-rule inputs. Report draw-rate gap per variant. Emit `regime` into `tournament-validation.json` + the report. **No change to the pre-registered rule code in `lib/validation.ts`.**

### Changed: `lib/predict.ts`
- Select `regimeParams.tournament` iff `model.json.promotion.shipped === true` **and** the fixture is finals-tournament (for this product: all WC26 fixtures qualify), else fall back to global `params`. Single, explicit selection point; back-compatible when `regimeParams`/`promotion` are absent (falls back to global).

### New: `scripts/model-inspector.mts` + `npm run model:inspect`
Sibling to `design-inspector.mts` / `execution-inspector.mts`. Read-only; fails the build (exit 2) unless:
- `model.json` carries a `promotion` block whose verdict matches the latest `docs/validation/tournament-validation.json` (live params trace to a real harness promotion).
- The shipped variant's draw-rate gap ≤ baseline's (the draw fix did not regress).
- Leakage invariants hold: harness `evalFrom` set, walk-forward markers present, promotion `seed`/`bootstrapSamples` match the pre-registered constants.
- `ml:train`'s standing gates are encoded as assertions over `model.json.backtest` (beats uniform, ECE < 0.03, Brier < 0.51).
- Predictions immutability untouched: `data/predictions.json` locked entries unchanged (hash/count check, mirroring execution-inspector's ethos).
- Prints the MUSTUSE skill-discipline reminder (brainstorm → writing-plans → executing-plans → TDD → verification), matching execution-inspector's standing-rules footer.

## Data flow

```
results.csv (read-only, seeded)
  └─ ml:train ─→ fit global params  ┐
                 fit regime params  ┘─→ model.json { params, regimeParams.tournament, promotion }
  └─ ml:validate ─→ walk-forward harness ─→ docs/validation/{tournament-validation.json, report.md}
                    variants: baseline · platt · regime ; verdict (primary+secondary) ; draw-gap
  predict.ts ─→ picks regimeParams.tournament for WC26 fixtures ─→ live forecasts (knockouts, not-yet-locked)
  model:inspect ─→ gate: live params ⇔ harness verdict, draw not regressed, no leakage, immutability
```

## Promotion & immutability protocol

The `promotion` block lifecycle is strictly ordered so it can never be circular (the trainer cannot know the verdict before the harness runs):

1. `ml:train` writes both param sets (`params` global + `regimeParams.tournament`) and stamps `promotion: { shipped: false, status: "candidate" }`. At this point `predict.ts` still uses global params.
2. `ml:validate` runs the harness and writes the verdict artifact (`docs/validation/tournament-validation.json`) including the `regime` variant, both pre-registered rule evaluations, and the draw-gap.
3. A **deliberate promotion step** (a small `--promote` flag on the validate script, run only after reviewing the artifact) stamps `promotion: { shipped: true, rule: "primary"|"secondary", deltaBrierCI, ece, drawGap, harnessGeneratedAt, seed }` into `model.json` **only when** a pre-registered rule fired in the artifact. If neither rule fired, `shipped` stays `false` → HOLD.
4. `predict.ts` reads `promotion.shipped` to decide which params to use; `model:inspect` enforces that `shipped === true` ⇔ a matching real verdict exists in the artifact (seed/samples/CI/draw-gap all consistent).
5. Locked `predictions.json` entries are never re-written; new params apply only to fixtures locked after promotion (knockout stage).

## Testing (TDD — write tests first, watch red, then implement)

- `tests/regime-params.test.ts`: `fitRegimeParams` recovers known params on synthetic data; `drawRateGap` correct on hand cases; regime fit on a draw-heavy synthetic set yields more-negative rho / lower base goals than a goal-heavy set.
- `tests/validation.test.ts` (extend): secondary-rule logic (non-inferiority + draw-gap threshold) decided correctly on fixtures; draw-gap reported.
- `tests/model-inspector.test.ts`: gate passes on a well-formed `model.json` + verdict; fails on (a) missing `promotion`, (b) live params not matching verdict, (c) regressed draw-gap, (d) leakage-constant mismatch.
- Existing suite stays green (309 → higher).

## Gates before commit

`npm test` · `npm run lint` · `npm run design:inspect` · `npm run inspect:execution` · **`npm run model:inspect`** · `npm run build`. `ml:validate` is run manually to produce the verdict artifact (offline, not a commit gate), exactly as today.

## Risks & honest failure modes

- **Regime fix may also show no Brier gain** (like Platt) — draws are high-entropy and Brier rewards sharpness. Mitigated by the pre-registered secondary rule (calibration win) so a genuine draw-calibration improvement can ship without inventing a new bar after the fact. If even that doesn't fire: HOLD + report.
- **Smaller fit sample** for regime params (tournament-only) → wider parameter uncertainty. Mitigated by fitting over the full pre-1990 onward tournament history and reporting fit diagnostics.
- **`predict.ts` selection bug** could silently apply wrong params. Mitigated by the explicit single selection point + `model:inspect` traceability check + tests.

## Roadmap (next specs, not this one)

- **Phase 2 — market blend:** shadow-mode blend of Polymarket/Kalshi consensus (`lib/polymarket.ts`, `lib/kalshi.ts`, data on disk) as a 4th harness variant; promote only if it beats baseline under the same rule. Target: beat the market's Brier on tournament matches. *Reality-check (Wong et al. 2025):* a 52-feature ML ensemble only **matched** bookmakers on accuracy (~63% vs ~66.6%) and lost on F1 — beating the market is hard; shadow-mode first, promote only on a real harness verdict.
- **Phase 3 — richer signal:** additive features, each must independently clear the harness or it does not ship. Literature-grounded + feasibility-filtered against our **results-only** martj42 dataset (score/tournament/neutral — no per-match box scores):
  - **Feasible now:** fatigue/congestion (days since last game, avg rest over last 3 — computable from fixture dates; per Wong et al. and the heat-stress literature [35][54], relevant to a June–July North-American WC) and goal-based form (we already store `forms` but do not feed it to the model — only Elo).
  - **Needs new data:** shot/corner/card momentum and venue weather (Wong et al. show signal, but require box-score / weather sources we don't have).
  - Player-availability via `player-stats.json` (note Peters & Pacheco: "lineups do not improve predictions" — treat as low-prior, prove via harness).

### Literature grounding

`docs/references/` — Wong, Li, Le, Bhangu, Bhatia (2025), "A predictive analytics framework for forecasting soccer match outcomes using machine learning models," _Decision Analytics Journal_ 14:100537. Our project already exceeds its evaluation rigor (proper scoring + walk-forward + bootstrap CIs + calibration vs their single-split hard-classification accuracy/MCC) and tackles 3-way draw-aware probabilities where the paper collapses to binary Win/Not-Win. Use it as the feature recipe for Phase 3, not for Phase 1.
