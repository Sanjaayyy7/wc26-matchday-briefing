# Tournament-Holdout Validation Report

_Generated 2026-06-24T00:34:50.527Z. Do not edit by hand — produced by `npm run ml:validate`._

## What this measures

Model variants scored on **finals-tournament matches** (FIFA World Cup, UEFA Euro, Copa América, African Cup of Nations, AFC Asian Cup),
from 1990-01-01, **walk-forward**: Elo and Platt calibration only ever see matches
strictly before the one being scored. This is the World-Cup-like regime — neutral venues,
high stakes, more draws — not the friendly-dominated time split that `ml:eval` uses.

Holdout: **2237 matches**.

## Promotion rule (pre-registered)

> ship iff ΔBrier(incumbent−challenger) 95% bootstrap CI > 0 AND challenger ECE < eceMax (eceMax = 0.03).

A challenger ships only if its Brier improvement is **statistically real** (95% bootstrap CI of
ΔBrier excludes zero, 5000 resamples, seed 42) **and** it stays
calibrated. This is the rule that correctly rejects small-sample "wins" within variance.

## Results

| variant | Brier | 95% CI | ECE |
| --- | --- | --- | --- |
| baseline (raw model) | 0.5769 | [0.5631, 0.591] | 0.0079 |
| platt-calibrated | 0.5768 | [0.5637, 0.59] | 0.0086 |

**ΔBrier (baseline − platt-calibrated):** mean 0.0001,
95% CI [-0.0008, 0.0011].

**Verdict:** HOLD — ΔBrier 95% CI [-0.0008, 0.0011] straddles 0 (not significant)

## Reliability — platt-calibrated (per-outcome)

| mean predicted | realized | count |
| --- | --- | --- |
| 0.066 | 0.066 | 288 |
| 0.157 | 0.148 | 927 |
| 0.264 | 0.259 | 2815 |
| 0.349 | 0.357 | 843 |
| 0.450 | 0.468 | 695 |
| 0.547 | 0.557 | 528 |
| 0.642 | 0.653 | 349 |
| 0.744 | 0.717 | 173 |
| 0.842 | 0.853 | 75 |
| 0.929 | 0.833 | 18 |

## Holdout composition

| tournament | matches |
| --- | --- |
| African Cup of Nations | 642 |
| FIFA World Cup | 596 |
| Copa América | 378 |
| UEFA Euro | 323 |
| AFC Asian Cup | 298 |
