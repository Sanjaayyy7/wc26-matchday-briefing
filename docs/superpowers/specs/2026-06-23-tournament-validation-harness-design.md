# Tournament-Holdout Validation Harness — Design

**Date:** 2026-06-23
**Status:** Approved (brainstorming) → ready for implementation plan
**Branch:** `feat/tournament-validation-harness`

## Problem

The model's decision harness (`ml:eval` / `scripts/eval-model.mts`) validates on a
**time split** (matches dated `2024-01-01+`, n≈2588). That test set is dominated by
**friendlies and qualifiers**, which are a different regime from the World Cup: the WC
is neutral-venue, high-stakes, draw-heavy knockout football. Past tournament settlement
showed the live failure is **draw underestimation**, invisible on a friendly-dominated
test set. Worse, "improvements" have repeatedly been judged on tiny live samples (n=37/41)
with no confidence interval, producing false positives (the draw-inflation "win" that the
harness itself flagged as within-variance).

We cannot improve what we cannot reliably measure. **Before adding any new signal, sharpen
the measuring stick.**

## Goal (success criterion)

A new `ml:validate` harness that scores any model variant on **finals-tournament matches**,
**walk-forward** (no leakage), and emits a **CI-gated ship/hold verdict** plus a reliability
diagram — so every future feature lands on a trustworthy, regime-correct, statistically
honest measuring stick.

Done = `npm run ml:validate` runs green, writes the artifacts below, the methodology page
shows the validation approach, and all existing gates stay green.

## Decisions (locked via interview)

| Decision | Choice |
| --- | --- |
| Primary objective | Minimize **Brier** subject to **ECE < 0.03** (proper score + calibration ceiling) |
| Validation regime | **Tournament holdout**: WC + Euro + Copa América + AFCON + AFC Asian Cup *finals* (exact labels; `…qualification` excluded) |
| Leakage protocol | **Walk-forward, strictly-prior fit**: Elo updated through D−1; Platt + goal-regression refit per-tournament-instance on data strictly before that tournament's start date |
| Promotion rule | Ship iff **ΔBrier 95% bootstrap CI fully > 0** AND challenger **ECE < 0.03** on the holdout |
| Outputs | `docs/validation/` JSON + markdown report; public methodology page gets a concise validation section |
| Scope | **Harness only.** Market blend and rest/congestion feature explicitly deferred (YAGNI) |

## Holdout set (grounded)

Exact `tournament` labels, finals only (counts since 2000, will be larger all-time):
`FIFA World Cup` (456), `African Cup of Nations` (525), `UEFA Euro` (277),
`AFC Asian Cup` (256), `Copa América` (248). ≈1,762 matches since 2000 — enough for tight CIs.
`Confederations Cup`, `Nations League`, and all `… qualification` labels are excluded.

## Components (small, isolated, testable)

### 1. `lib/validation.ts` (pure; TDD — tests first)

Reuses `lib/calibration` (`brier`, `rps`, `calibrationBins` → 10-bin reliability + ECE).
New pure functions only:

- `FINALS_TOURNAMENTS: ReadonlySet<string>` and `isFinalsTournament(label: string): boolean`
  — exact-set membership (no substring matching, so `qualification` never sneaks in).
- `mulberry32(seed: number)` — small deterministic PRNG (reproducible bootstraps).
- `bootstrapCI(values: number[], statFn, opts?: { B?: number; seed?: number; alpha?: number })`
  → `{ mean; lo; hi }` — resamples indices with replacement, percentile CI (default B=10000,
  seed=42, alpha=0.05).
- `pairedDeltaBrierCI(incumbent: number[], challenger: number[], opts?)` → `{ mean; lo; hi }`
  — paired bootstrap of per-match (incumbent − challenger); positive ⇒ challenger better.
- `promotionVerdict(incumbent: number[], challenger: number[], challengerEce: number, opts?)`
  → `{ ship: boolean; deltaBrierCI; eceOk: boolean; reason: string }`
  — `ship = deltaCI.lo > 0 && challengerEce < 0.03`.

### 2. `scripts/validate-model.mts` → `npm run ml:validate`

Mirrors the proven walk-forward machinery in `eval-model.mts`, but the eval slice is
**finals-tournament matches across all years** (not the 2024 time slice):

1. Load + date-sort all rows (reuse the CSV parse pattern).
2. Single chronological pass maintaining walk-forward Elo (`lib/elo.updateElo`); ratings only
   ever reflect strictly-past matches.
3. **Per-tournament-instance param refit:** when entering a held-out tournament instance
   (e.g. "FIFA World Cup 2018"), fit Platt + goal-regression on samples strictly before that
   instance's first match date. Honest and far cheaper than per-match refit; identical leakage
   guarantee for the matches being scored.
4. For each held-out match: predict (Poisson/Dixon-Coles grid → 3-way split → Platt) and grade
   vs actual outcome. Record per-match Brier (`lib/calibration.brier`), RPS, and the (predicted
   home-prob, outcome) pair for calibration.
5. Per variant (`baseline`, `platt-calibrated`, plus any passed challenger) compute: mean Brier,
   ECE + reliability bins (`calibrationBins`), and bootstrap CIs.
6. Compute `promotionVerdict(baseline-or-incumbent, challenger)` and print + persist.

Variants reuse the same definitions as `eval-model.mts` so numbers are comparable.

### 3. Artifacts (`docs/validation/`)

- `tournament-validation.json` — machine-readable: holdout n, per-variant {brier, brierCI, ece,
  reliabilityBins}, verdict, config (seed, B, label set, generated-at).
- `validation-report.md` — human report: holdout composition, reliability table, per-variant
  Brier±CI, the CI-gated verdict, and the pre-registered promotion rule statement.

### 4. Public methodology page (`app/methodology/page.tsx`)

A concise section — "How we validate" — stating: tournament-holdout regime, walk-forward
(no leakage), bootstrap-CI-gated promotion. Matches the existing design system (jet-black
canvas, Aurora, `text-*` clamps). Per `AGENTS.md`, consult the bundled Next docs before
touching framework patterns. No new numbers hard-coded into JSX that could drift — link/refer
to the methodology, not specific metric values, or read from the artifact at build if trivial.

### 5. Tests + gates

- `tests/lib/validation.test.ts`: tournament filter (includes the 5, excludes qualification +
  Confederations Cup), bootstrap determinism (same seed ⇒ same CI), bootstrap sanity (CI brackets
  the mean; constant input ⇒ zero-width), `pairedDeltaBrierCI` sign correctness on synthetic data,
  `promotionVerdict` truth table (CI>0 + low ECE ⇒ ship; CI straddling 0 ⇒ hold; high ECE ⇒ hold).
- All existing gates stay green: `vitest`, `eslint`, `design:inspect`, `inspect:execution`, `build`.

## Data flow

```
results.csv ─sort─▶ walk-forward Elo pass ─▶ held-out tournament match?
                                              │yes
                  per-tournament prior fit ───┤
                  (Platt + goal regression)   ▼
                                      predict ▶ per-match {brier, rps, (p,outcome)}
                                              ▼
            lib/validation: bootstrapCI · calibrationBins · promotionVerdict
                                              ▼
        docs/validation/{tournament-validation.json, validation-report.md}
                                              ▼
                       methodology page: "How we validate" section
```

## Risks / mitigations

- **Per-tournament refit cost** over ~1,762 matches: bounded — refit happens once per tournament
  instance (~dozens), not per match.
- **Heterogeneous confederation strength** in the holdout: accepted; the regime (neutral, high-stakes)
  is the thing we're matching, and bootstrap CIs quantify the resulting variance.
- **Number drift on the public page:** mitigated by not hard-coding metric values in JSX.
- **Scope creep:** market blend / rest feature are out of scope here by explicit decision.

## Out of scope (YAGNI)

- Shadow-mode market blend (next, validated *by* this harness once live n threshold is set).
- Rest/congestion or any new model feature.
- Changing `model.json` or any locked prediction. History stays immutable.
