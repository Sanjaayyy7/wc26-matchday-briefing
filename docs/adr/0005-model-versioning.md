# ADR-0005: Model Versioning & Champion-Challenger Governance

**Status:** Accepted
**Date:** 2026-06-19
**Deciders:** Platform team

## Context

WC26 runs a live prediction system during an active tournament. Model updates carry risk: a worse model deployed mid-tournament would corrupt the live Brier/RPS/ECE accountability record. We need a formal promotion framework to prevent accidental regressions and maintain a permanent audit trail of every model version.

## Decision

Establish a Champion-Challenger model governance framework:

1. **Model registry** (`data/model-registry.json`) records every model version — training date, dataset version, parameters, metrics, promotion decision, and rationale.

2. **Champion = current production model** loaded by `lib/predict.ts` via `data/model.json`.

3. **Challenger = candidate model** evaluated against Champion via walk-forward validation before promotion.

4. **Promotion criteria (ALL must be satisfied):**
   - Brier score improves vs Champion on holdout
   - ECE improves or remains ≤ 3%
   - Walk-forward RPS improves
   - No feature leakage detected
   - No overfitting (train/holdout gap < 10%)
   - Results reproduce bit-for-bit with the same seed

5. **Promotion process:**
   - Run `npm run ml:eval` to score Challenger on holdout
   - Compare to Champion metrics in registry
   - If all criteria met: copy Challenger to `data/model.json`, add registry entry with `"status": "champion"`, demote previous to `"status": "retired"`
   - If any criterion fails: add registry entry with `"status": "rejected"` and `promotionRationale` documenting which criterion failed

6. **Models are never overwritten** — `data/model-registry.json` is the permanent audit trail; it only grows.

## Consequences

**Positive:**
- Complete audit trail of every model version and promotion decision
- Impossible to accidentally corrupt the live accountability record with a worse model
- Registry ships as a deployable artifact — available at runtime to show model provenance
- Formal decision record for post-tournament retrospective

**Negative:**
- Slightly more overhead per model update (write registry entry, document rationale)
- CI-automated promotion is deferred; promotions are manual during live tournament play

## Alternatives Considered

- **Ad-hoc updates (rejected):** No promotion gate → regression risk during live tournament. Unacceptable given that Brier scores on the `/record` page are permanent accountability measures.
- **CI-automated promotion (deferred):** Automatic promotion via GitHub Actions when criteria pass — viable post-tournament, too risky during live play where human review of each promotion is warranted.
