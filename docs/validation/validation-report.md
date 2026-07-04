# Tournament-Holdout Validation Report

_Generated 2026-07-04T05:17:22.569Z. Do not edit by hand — produced by `npm run ml:validate`._

## What this measures

Model variants scored on **finals-tournament matches** (FIFA World Cup, UEFA Euro, Copa América, African Cup of Nations, AFC Asian Cup),
from 1990-01-01, **walk-forward**: Elo and Platt calibration only ever see matches
strictly before the one being scored. This is the World-Cup-like regime — neutral venues,
high stakes, more draws — not the friendly-dominated time split that `ml:eval` uses.

Holdout: **2281 matches**.

## Promotion rule (pre-registered)

> ship iff ΔBrier(incumbent−challenger) 95% bootstrap CI > 0 AND challenger ECE < eceMax (eceMax = 0.03).

A challenger ships only if its Brier improvement is **statistically real** (95% bootstrap CI of
ΔBrier excludes zero, 5000 resamples, seed 42) **and** it stays
calibrated. This is the rule that correctly rejects small-sample "wins" within variance.

## Results

| variant | Brier | 95% CI | ECE |
| --- | --- | --- | --- |
| baseline (raw model) | 0.5742 | [0.5594, 0.5883] | 0.0076 |
| platt-calibrated | 0.5743 | [0.5604, 0.5876] | 0.0089 |
| regime | 0.5751 | [0.5606, 0.5889] | 0.0056 |
| stage-aware | 0.575 | [0.5607, 0.5886] | 0.0054 |

**ΔBrier (baseline − platt-calibrated):** mean 0,
95% CI [-0.001, 0.0009].

**Verdict:** HOLD — ΔBrier 95% CI [-0.0010, 0.0009] straddles 0 (not significant)

## Draw-rate calibration

| variant | draw-gap |
| --- | --- |
| baseline | 0.0119 |
| regime | 0.0118 |

## Regime promotion

- **primary:** HOLD — ΔBrier 95% CI [-0.0016, -0.0000] straddles 0 (not significant)
- **secondary:** HOLD — draw-gap reduction 0.0pp < 5pp

## Stage-aware draw-rate calibration

| stage | baseline draw-gap | stage-aware draw-gap |
| --- | --- | --- |
| group | 0.0231 | 0.0181 |
| knockout | 0.0203 | 0.0083 |

Fallback tiers: stage 1712, pooled 156, baseline 413.

- **stage-aware primary:** HOLD — ΔBrier 95% CI [-0.0018, 0.0003] straddles 0 (not significant)
- **stage-aware secondary:** HOLD — draw-gap reduction 0.0pp < 5pp

## Reliability — platt-calibrated (per-outcome)

| mean predicted | realized | count |
| --- | --- | --- |
| 0.066 | 0.064 | 299 |
| 0.156 | 0.146 | 949 |
| 0.264 | 0.259 | 2862 |
| 0.349 | 0.353 | 859 |
| 0.450 | 0.471 | 705 |
| 0.546 | 0.559 | 533 |
| 0.642 | 0.659 | 361 |
| 0.744 | 0.726 | 179 |
| 0.842 | 0.844 | 77 |
| 0.928 | 0.842 | 19 |

## Holdout composition

| tournament | matches |
| --- | --- |
| African Cup of Nations | 642 |
| FIFA World Cup | 640 |
| Copa América | 378 |
| UEFA Euro | 323 |
| AFC Asian Cup | 298 |
