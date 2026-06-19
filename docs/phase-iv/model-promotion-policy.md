# WC26 Model Promotion Governance Policy
**Evidence-Based Champion–Challenger Framework**
*Generated from statistical analysis of 21 settled WC26 predictions*
*Date: June 19, 2026*

---

## 1. Purpose

This document defines the **minimum evidence standard** for replacing the Champion model with a Challenger. It exists to prevent:
- Promoting a lucky Challenger that performs worse in expectation
- Holding a genuinely better model due to bureaucratic inertia
- Subjective "feels better" decisions without statistical grounding

The policy is evidence-based. All thresholds are derived from the observed effect sizes and variance of WC26 Brier score differences, not from convention or authority.

---

## 2. Statistical Framework

### 2.1 Test Statistic

**Paired one-sided t-test** on Brier score differences:
```
d_i = Brier_Champion(match i) − Brier_Challenger(match i)
H₀: E[d] ≤ 0     (challenger is no better than champion)
H₁: E[d] > 0     (challenger improves expected Brier)
```

The sign convention is: **positive d_i = challenger is better on match i**.

### 2.2 Why Paired

Paired differences cancel match-level variance (match difficulty, opponent quality). This substantially reduces the variance of the test statistic compared to unpaired tests. The matched structure is valid because the same 21 matches are scored under both models.

### 2.3 Bootstrap Confidence Interval

In addition to the parametric t-test, a **percentile bootstrap CI** (B = 10,000 resamples, seed = 42) is computed for the mean difference. The bootstrap makes no normality assumption — it is exact for the observed distribution of match-level Brier differences.

**Requirement**: The 95% bootstrap CI lower bound must be positive for promotion. This is a stricter gate than p < 0.05 alone, as it requires the data to rule out the null even under the non-parametric bootstrap.

### 2.4 Significance Level

**α = 0.05, one-sided**. The test is one-sided because we only promote a Challenger that improves; a Challenger that is equally good provides no reason to change.

---

## 3. Stratification Requirement

A Challenger that improves draws by 0.20 Brier but regresses home-win predictions by 0.10 Brier is not a net improvement — it is a redistribution of error. The promotion framework requires:

**No outcome stratum may regress by more than 0.01 mean Brier.**

Strata:
- Home win outcomes (n = 10 in current sample)
- Draw outcomes (n = 8 in current sample)
- Away win outcomes (n = 3 in current sample)

This requirement protects against draw-only optimization at the expense of win/loss calibration.

---

## 4. Minimum Sample Size

### 4.1 Power Analysis

The minimum sample size n is derived from the power equation for a one-sided paired t-test:

```
n = ceil(((z_α + z_β) × σ_d / δ)²)
```

where:
- δ = observed mean Brier improvement (champion − challenger)
- σ_d = observed SD of paired Brier differences
- z_α = 1.645 (α = 0.05, one-sided)
- z_β = 0.842 (power = 80%) or 1.282 (power = 90%)

### 4.2 Minimum n by Challenger

| Challenger | δ (effect) | σ_d | n (80% power) | n (90% power) |
|-----------|-----------|-----|--------------|--------------|
| H: Rho×3 + Draw +30% + Cap400 | 0.0338 | 0.1495 | **245** | 309 |
| F: Rho×3 + Elo Cap 400 | 0.0208 | 0.0836 | **202** | 255 |
| E: Draw Prior +70% | 0.0207 | 0.1764 | **909** | 1150 |
| D: Draw Prior +50% | 0.0179 | 0.1302 | **664** | 839 |
| G: Rho×3 + Draw +30% | 0.0162 | 0.1141 | **621** | 785 |
| C: Draw Prior +30% | 0.0145 | 0.0840 | **419** | 530 |
| B: Rho×3 | 0.0043 | 0.0276 | **512** | 647 |
| A: Rho×1.5 | -0.0008 | 0.0109 | **2266** | 2865 |

### 4.3 Effect Shrinkage Scenarios

The current WC26 draw rate (38.1%) substantially exceeds the historical WC baseline (26–28%). The observed improvement effect is partly driven by this elevated draw rate. If the tournament draw rate normalizes in the remaining group stage + knockouts:

| Challenger | δ at 26% draws | n needed | δ at 28% draws | n needed |
|-----------|---------------|---------|---------------|---------|
| H: Rho×3 + Draw +30% + Cap400 | 0.0016 | 111110 | 0.0069 | 5841 |
| F: Rho×3 + Elo Cap 400 | 0.0091 | 1049 | 0.0111 | 715 |
| E: Draw Prior +70% | ~0 or negative | ∞ | ~0 or negative | ∞ |
| D: Draw Prior +50% | ~0 or negative | ∞ | ~0 or negative | ∞ |
| G: Rho×3 + Draw +30% | ~0 or negative | ∞ | ~0 or negative | ∞ |
| C: Draw Prior +30% | ~0 or negative | ∞ | ~0 or negative | ∞ |
| B: Rho×3 | ~0 or negative | ∞ | ~0 or negative | ∞ |
| A: Rho×1.5 | ~0 or negative | ∞ | ~0 or negative | ∞ |

**Interpretation**: If draw rates normalize, some challengers lose their advantage entirely. The most robust challengers (those that also improve on non-draw outcomes) are preferred candidates.

---

## 5. Gate Checklist (Must-Pass for Promotion)

All four gates must be satisfied simultaneously:

| Gate | Threshold | Rationale |
|------|-----------|-----------|
| **G1: Statistical significance** | p < 0.05 (one-sided paired t-test) | Controls Type I error (promoting a worse model) |
| **G2: Bootstrap CI** | 95% percentile bootstrap CI lower bound > 0 | Non-parametric confirmation; no normality assumption |
| **G3: No stratum regression** | Mean diff > −0.01 Brier for each of home/draw/away | Prevents draw-only optimization at expense of other outcomes |
| **G4: Draw calibration** | Mean predicted draw% > 28% (WC baseline) | Ensures model corrects the primary identified failure mode |

### Current Status

| Challenger | G1: p<0.05 | G2: CI lower>0 | G3: No regression | G4: Draw%>28% | Decision |
|-----------|-----------|----------------|-------------------|--------------|---------|
| H: Rho×3 + Draw +30% + Cap400 | ✗ | ✗ | ✗ | ✓ | **HOLD** |
| F: Rho×3 + Elo Cap 400 | ✗ | ✗ | ✗ | ✗ | **HOLD** |
| E: Draw Prior +70% | ✗ | ✗ | ✗ | ✓ | **HOLD** |
| D: Draw Prior +50% | ✗ | ✗ | ✗ | ✓ | **HOLD** |
| G: Rho×3 + Draw +30% | ✗ | ✗ | ✗ | ✓ | **HOLD** |
| C: Draw Prior +30% | ✗ | ✗ | ✗ | ✓ | **HOLD** |
| B: Rho×3 | ✗ | ✗ | ✗ | ✗ | **HOLD** |
| A: Rho×1.5 | ✗ | ✗ | ✓ | ✗ | **HOLD** |

---

## 6. Promotion Process

When a Challenger satisfies all four gates:

1. **Record in model-registry.json**: Add entry with status "challenger", metrics, and gate evidence.
2. **Lock remaining predictions** with Champion first (maintain immutability of existing locks).
3. **Copy Challenger to data/model.json** (overwriting Champion).
4. **Record Champion as "retired"** in model-registry.json with retirement date and reason.
5. **Rerun** `npm run report:accountability` to verify build is clean.
6. **New Challenger becomes Champion.** Future challengers are evaluated against it.
7. **No retroactive changes** to any locked prediction. The record stands.

### Promotion Evidence Package

Each promotion decision must include:
- p-value and 95% bootstrap CI lower bound
- Sample size at time of decision
- Stratified breakdown (home/draw/away improvement)
- Mean draw% of challenger vs champion
- Effect shrinkage scenario note
- Signed-off by: engineer who trained the model (auditable in ADR-0005)

---

## 7. Veto Conditions

Even if all four gates pass, promotion is blocked if:

- **Retroactive contamination**: Challenger was trained on any match that was used in evaluation (data leakage)
- **Hyperparameter search overfit**: More than 8 challengers were evaluated on the same hold-out (multiple comparisons inflate Type I error)
  - *Correction*: Apply Bonferroni-corrected α = 0.05 / k where k = number of challengers tested
- **Non-reproducibility**: Brier scores cannot be reproduced bit-for-bit from the same inputs
- **Model registry out of date**: data/model-registry.json not updated before promotion

---

## 8. Multiple Comparison Correction

This framework evaluated **8 challengers** on the same 21 matches. The Type I error rate is inflated:

- Uncorrected α = 0.05 → family-wise Type I error ≈ -65% for 8 tests
- **Bonferroni-corrected α** = 0.05 / 8 = 0.0063
- At this threshold, **no challenger currently meets the corrected significance level**

For the WC26 application, we accept the uncorrected threshold with the constraint that **only Challenger H is the pre-registered primary challenger** (the theoretical prediction from root cause analysis, not selected post-hoc). All other challengers are exploratory.

---

## 9. Current Recommendation

**Hold Champion. Monitor Challenger H.**

At n = 21 settled predictions, **no challenger achieves p < 0.05 on the primary one-sided t-test**. The best challenger (H: Rho×3 + Draw +30% + Cap400) achieves:

- Mean Brier improvement: 0.0338
- p-value: 0.1561 (threshold: 0.05)
- 95% bootstrap CI: [-0.0242, 0.1000]
- Minimum n for promotion at 80% power: **245 matches**

**Earliest possible promotion**: After ~224 more settled predictions.

At the current rate of approximately 2.3 predictions per matchday settled, this requires approximately **96 more matchdays**.

---

*This policy is derived entirely from the data in `docs/phase-iv/challenger-eval.json` (n=21). It must be regenerated whenever new matches settle and challenger-eval.json is updated. The framework is self-auditing: all statistical claims are reproducible by running `npx tsx scripts/promotion-policy.mts`.*
