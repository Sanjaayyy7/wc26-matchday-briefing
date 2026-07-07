# Tournament-Holdout Validation Report

_Generated 2026-07-07T02:40:37.940Z. Do not edit by hand — produced by `npm run ml:validate`._

## What this measures

Model variants scored on **finals-tournament matches** (FIFA World Cup, UEFA Euro, Copa América, African Cup of Nations, AFC Asian Cup),
from 1990-01-01, **walk-forward**: Elo and Platt calibration only ever see matches
strictly before the one being scored. This is the World-Cup-like regime — neutral venues,
high stakes, more draws — not the friendly-dominated time split that `ml:eval` uses.

Holdout: **2287 matches**.

## Promotion rule (pre-registered)

> ship iff ΔBrier(incumbent−challenger) 95% bootstrap CI > 0 AND challenger ECE < eceMax (eceMax = 0.03).

A challenger ships only if its Brier improvement is **statistically real** (95% bootstrap CI of
ΔBrier excludes zero, 5000 resamples, seed 42) **and** it stays
calibrated. This is the rule that correctly rejects small-sample "wins" within variance.

## Results

| variant | Brier | 95% CI | ECE |
| --- | --- | --- | --- |
| baseline (raw model) | 0.574 | [0.5597, 0.5884] | 0.0072 |
| platt-calibrated | 0.5741 | [0.5606, 0.5877] | 0.0092 |
| regime | 0.5749 | [0.561, 0.5889] | 0.0058 |
| stage-aware | 0.5748 | [0.5609, 0.5889] | 0.0055 |
| features | 0.5736 | [0.5589, 0.5883] | 0.0069 |

**ΔBrier (baseline − platt-calibrated):** mean -0.0001,
95% CI [-0.001, 0.0009].

**Verdict:** HOLD — ΔBrier 95% CI [-0.0010, 0.0009] straddles 0 (not significant)

## Draw-rate calibration

| variant | draw-gap |
| --- | --- |
| baseline | 0.0112 |
| regime | 0.0111 |

## Regime promotion

- **primary:** HOLD — ΔBrier 95% CI [-0.0016, -0.0000] straddles 0 (not significant)
- **secondary:** HOLD — draw-gap reduction 0.0pp < 5pp

## Feature-signals promotion (rest-days + goal-form)

- **primary:** HOLD — ΔBrier 95% CI [-0.0004, 0.0013] straddles 0 (not significant)
- **secondary:** HOLD — draw-gap reduction -0.2pp < 5pp
- fitted betas (latest instance): {"betaRest":0.02,"betaForm":-0.04}
- activation: 1874 feature-adjusted / 413 baseline fallback
- draw-gap: 0.013

## Stage-aware draw-rate calibration

| stage | baseline draw-gap | stage-aware draw-gap |
| --- | --- | --- |
| group | 0.0231 | 0.0181 |
| knockout | 0.0203 | 0.0083 |

Fallback tiers: stage 1712, pooled 162, baseline 413.

- **stage-aware primary:** HOLD — ΔBrier 95% CI [-0.0018, 0.0003] straddles 0 (not significant)
- **stage-aware secondary:** HOLD — draw-gap reduction 0.0pp < 5pp

## Reliability — platt-calibrated (per-outcome)

| mean predicted | realized | count |
| --- | --- | --- |
| 0.066 | 0.064 | 299 |
| 0.156 | 0.146 | 950 |
| 0.264 | 0.258 | 2871 |
| 0.349 | 0.353 | 863 |
| 0.451 | 0.470 | 706 |
| 0.546 | 0.561 | 535 |
| 0.643 | 0.660 | 362 |
| 0.744 | 0.726 | 179 |
| 0.842 | 0.844 | 77 |
| 0.928 | 0.842 | 19 |

## Holdout composition

| tournament | matches |
| --- | --- |
| FIFA World Cup | 646 |
| African Cup of Nations | 642 |
| Copa América | 378 |
| UEFA Euro | 323 |
| AFC Asian Cup | 298 |
