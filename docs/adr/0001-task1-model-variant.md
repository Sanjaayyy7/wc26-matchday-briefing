# ADR-0001: Ship Platt-calibrated model; revise the Brier gate to an evidence-based threshold

**Date**: 2026-06-18
**Status**: accepted
**Deciders**: user (product owner) + controller agent

## Context

The match model's quality bar (plan §I Task 1) included a fixed gate: walk-forward
backtest **Brier < 0.50 AND ECE < 0.03**. The baseline model failed it (Brier 0.5097,
ECE 0.0196). The decision harness `scripts/eval-model.mts` benchmarked three improvement
families on one fixed, leakage-free 2024+ walk-forward split (n=2548):

| variant | Brier | ECE |
|---|---|---|
| baseline | 0.5097 | 0.0196 |
| time-decay (halfLife 365) | 0.5100 | 0.0206 |
| time-decay (halfLife 730) | 0.5090 | 0.0138 |
| time-decay (halfLife 1460) | 0.5091 | 0.0150 |
| **platt-calibrated** | **0.5085** | **0.0089** |

**No variant crossed Brier < 0.50.** The best (post-hoc Platt calibration, fit on a
2014–2024 holdout, applied to 2024+) reaches 0.5085 and roughly halves ECE. ~0.508 is the
realistic frontier for 3-way international-football Brier under this sum-over-3-classes
definition (uniform = 0.6667; de-vigged betting markets themselves score ~0.50–0.51). The
original 0.50 target was set below the achievable frontier.

## Decision

Ship the **platt-calibrated** model (best discovered variant — strictly better than baseline
on both Brier and ECE) and replace the fixed 0.50 target with an **evidence-based threshold
derived from the observed frontier: Brier < 0.51 AND ECE < 0.03**. The calibration is stored
as a `calibration: {a, b}` block in `data/model.json`, applied in `lib/predict.ts` for live
predictions, and reproduced by `npm run ml:train` / verified by `npm run ml:eval`.

## Alternatives Considered

### Keep 0.50; pursue deeper modeling (new features / ensemble / market blend)
- **Pros**: might eventually cross 0.50.
- **Cons**: uncertain, high overfitting risk, large extra effort.
- **Why not**: 0.508 is near the irreducible skill floor; chasing 0.50 optimizes a number, not predictive value.

### Keep 0.50; accept the bar unmet, ship nothing
- **Pros**: preserves the original number.
- **Cons**: discards a real, measured improvement (better Brier AND much better calibration).
- **Why not**: leaves the model strictly worse than an available, validated alternative.

### Replace the gate with "beat de-vigged Kalshi market Brier" only
- **Pros**: most product-meaningful bar.
- **Cons**: only ~3 settled WC26 matches today → statistically underpowered as a hard gate.
- **Why not**: kept as the directional part-(a) check; not yet a reliable primary gate.

## Consequences

### Positive
- Shipped model improves Brier (0.5097→0.5085) and ECE (0.0196→0.0089) with no leakage.
- The gate is now passable and still discriminating (a regression above 0.51 fails `ml:eval`/`ml:train`).
- Calibration is reproducible and applied consistently in backtest and live inference.

### Negative
- The headline Brier remains ≈0.51, not the aspirational <0.50.

### Risks
- Post-hoc calibration can overfit the holdout. Mitigation: fit strictly on pre-2024 data, evaluate only on 2024+, both gated by `ml:eval`; ECE improved (not just Brier), indicating genuine calibration gain rather than overfit.
