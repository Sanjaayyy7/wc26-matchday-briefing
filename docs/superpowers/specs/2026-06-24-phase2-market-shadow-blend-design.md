# Phase 2 — Market shadow-blend evaluation

_Design spec. Approach: shadow blend (chosen given the data reality). The original Phase-1 roadmap imagined a market blend as a 4th variant in the 1990+ walk-forward harness; that is **impossible** — market data exists only for recent WC26 matches, not the 1990+ holdout. This spec reframes Phase 2 as an honest small-sample shadow evaluation that is ready to promote as market-covered settled data accumulates._

## Context

Phase 1 (PR #35) and the harness established that recalibration is tapped out and new *signal* is the lever. The market (Polymarket/Kalshi) is the sharpest external signal available. But:
- `data/markets/polymarket.json` carries de-vigged market `probs {home,draw,away}` + a `resolved` one-hot for **72 WC26 match slugs**; `kalshi-resolutions.json` adds a few. **No historical market data exists** — so a blend cannot be scored on the 1990+ bootstrap harness.
- The evaluable sample is **settled ∩ market-covered ∩ has-a-locked-model-prediction** WC26 matches — small (tens of matches), and growing as WC26 knockouts settle.
- Existing `scripts/calibrate.mts` already scores model-vs-market Brier per fixture into `pipeline-output/calibration-log.md`; this spec generalizes that to a **blend** over the whole settled market-covered set.

## Problem statement

Build a tunable **linear-pool blend** of the model and market forecasts, evaluate model / market / blend Brier (and RPS) over the settled market-covered WC26 sample, report honestly with small-n caveats and a pre-registered shadow-adoption rule, and keep it **shadow** — no change to live `predict.ts` until the rule fires on a sufficient sample.

## Goals

1. **Pure blend primitive:** `blendSplit(model, market, lambda)` = renormalized `λ·market + (1−λ)·model`, `λ ∈ [0,1]`.
2. **λ-grid evaluation (no overfitting):** report Brier + RPS at `λ ∈ {0.0, 0.25, 0.5, 0.75, 1.0}` over the sample — `λ=0` is the model, `λ=1` is the market, interiors are blends. We do **not** fit λ to the sample (overfits at small n).
3. **Pre-registered shadow-adoption rule (decided now):** shadow-adopt the candidate blend **λ=0.5** iff, on the sample, `Brier(λ=0.5)` is strictly lower than **both** `Brier(model)` and `Brier(market)`, **AND** the sample size `n ≥ 30`. Below `n=30` the result is **PROVISIONAL — report only, never adopt** (small-sample discipline, consistent with the project's existing 30–50 match caveats).
4. **Honest reporting:** an artifact + console summary with `n`, the λ-grid Brier/RPS curve, the chosen verdict (ADOPT-SHADOW / PROVISIONAL / HOLD), and which matches were included/excluded and why.
5. **Shadow only:** no live `predict.ts` change in this spec. (A later, separately-specced step wires an adopted blend into live forecasts.)

## Non-goals

- Wiring the blend into live `predict.ts` / briefings — deferred until the rule fires.
- Fitting λ to data (overfitting at small n) — explicitly avoided; the λ-grid is reported instead.
- Any use of the 1990+ harness — not applicable (no historical market data).
- Vig removal / market microstructure — `polymarket.json` already stores de-vigged `probs`.

## Components & interfaces

### New: `lib/market-blend.ts` (pure)
- Reuse `type ProbSplit = { home; draw; away }` from `lib/polymarket`.
- `blendSplit(model: ProbSplit, market: ProbSplit, lambda: number): ProbSplit` — `normalize(λ·market + (1−λ)·model)`; throws on `λ ∉ [0,1]`.
- `type ShadowVerdict = "ADOPT-SHADOW" | "PROVISIONAL" | "HOLD"`.
- `shadowVerdict(n: number, brierModel: number, brierMarket: number, brierBlend05: number, opts?: { minN?: number }): ShadowVerdict` — implements Goal 3 exactly (`minN` default 30).
- Pure, no I/O.

### New: `scripts/market-shadow.mts` + `npm run ml:market-shadow`
- Join: for each market-covered slug with a `resolved` outcome AND a locked model prediction (from `data/predictions.json` entries), assemble `{ model: ProbSplit, market: ProbSplit, outcome }`. Skip (and count) slugs missing any of model/market/result; never fabricate a missing forecast.
- Compute Brier + RPS for model, market, and each λ-grid blend over the sample (reuse `brier`/`rps` from `lib/calibration`).
- Apply `shadowVerdict` to the λ=0.5 blend.
- Write `docs/validation/market-shadow.json`:
  ```json
  { "generatedFrom": ["data/predictions.json","data/markets/polymarket.json","data/markets/kalshi-resolutions.json"],
    "n": N, "excluded": [{ "slug","reason" }],
    "grid": [{ "lambda","brier","rps" }, ...],
    "model": { "brier","rps" }, "market": { "brier","rps" },
    "verdict": "ADOPT-SHADOW|PROVISIONAL|HOLD", "candidateLambda": 0.5 }
  ```
- Print a summary table. Manual/offline; **not** a commit gate. Data-safe (reads predictions + markets read-only; writes only the artifact). NEVER `ml:fetch`/`pipeline:polymarket` to refetch.

## Data flow

```
data/predictions.json (locked model splits) ┐
data/markets/polymarket.json (de-vigged probs + resolved) ┼─ ml:market-shadow ─→ docs/validation/market-shadow.json
data/markets/kalshi-resolutions.json (resolved)           ┘   join on slug → λ-grid Brier/RPS → shadowVerdict
   (no live predict.ts change — shadow only)
```

## Testing (TDD)

- `tests/market-blend.test.ts`:
  - `blendSplit`: `λ=0` returns the model, `λ=1` returns the market, `λ=0.5` is the renormalized midpoint; output always sums to 1; throws on `λ` out of range.
  - `shadowVerdict`: ADOPT-SHADOW only when blend beats both endpoints AND `n ≥ 30`; PROVISIONAL when it beats both but `n < 30`; HOLD when it does not beat both (regardless of n).
- The script's join logic is exercised by a small fixture test if practical, else validated by running `ml:market-shadow` and sanity-checking the artifact (n, excluded reasons, grid monotonicity sanity).
- Full suite stays green.

## Expected outcome (honest)

Given the current sample (tens of settled market-covered matches, likely `n < 30`), the most probable verdict is **PROVISIONAL** — the machinery and the λ-grid comparison are established and reportable, but adoption waits for more settled WC26 knockout matches with market coverage. This is the same eval-first discipline as Phase 1's HOLD: build the measuring stick, report honestly, adopt only when the evidence clears the pre-registered bar.

## Gates before commit

`npm test` · `npm run lint` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`. `ml:market-shadow` is run manually to produce the artifact (offline, not a commit gate).

## Follow-up (not this spec)

- Wire an ADOPT-SHADOW blend into live `predict.ts`/briefings (separate spec, once the rule fires).
- Re-run as WC26 knockouts settle to grow the sample toward the `n ≥ 30` bar.
