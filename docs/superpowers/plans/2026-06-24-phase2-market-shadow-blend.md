# Phase 2 Market Shadow-Blend — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Steps use checkbox (`- [ ]`) syntax.

**Goal:** A tunable linear-pool model/market blend, evaluated model/market/blend Brier+RPS over the settled market-covered WC26 sample, with a pre-registered shadow-adoption rule — shadow only, no live change.

**Architecture:** A pure module (`lib/market-blend.ts`) provides `blendSplit` + `shadowVerdict`. A script (`scripts/market-shadow.mts`, `npm run ml:market-shadow`) joins locked model predictions + market probs + resolved outcomes, computes the λ-grid, applies the verdict, and writes `docs/validation/market-shadow.json`.

**Tech Stack:** TypeScript (strict), tsx, Vitest, ESLint flat config.

## Global Constraints

- Spec: `docs/superpowers/specs/2026-06-24-phase2-market-shadow-blend-design.md`.
- Linear-pool blend: `normalize(λ·market + (1−λ)·model)`, `λ ∈ [0,1]`. Reuse `type ProbSplit` from `lib/polymarket`. Do NOT fit λ to the sample.
- λ-grid: `{0.0, 0.25, 0.5, 0.75, 1.0}`. Candidate blend = λ=0.5.
- Pre-registered rule: `ADOPT-SHADOW` iff `Brier(λ=0.5) < Brier(model)` AND `Brier(λ=0.5) < Brier(market)` AND `n ≥ 30`; `PROVISIONAL` if it beats both but `n < 30`; else `HOLD`.
- Reuse `brier`/`rps` from `lib/calibration` (they take percentage splits `{home,draw,away}` in 0..100 and an `Outcome` `"home"|"draw"|"away"`). Never fabricate a missing model/market/result — skip + count as excluded.
- Shadow only: NO change to `lib/predict.ts` or any live forecast path.
- Data safety: `ml:market-shadow` reads `data/predictions.json` + `data/markets/*` read-only; writes only `docs/validation/market-shadow.json`. NEVER `ml:fetch`/`pipeline:polymarket`/`matchday`.
- Gates before commit: `npm test` · `npm run lint` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`.
- Commit by explicit path; one commit per task; no `Co-Authored-By` trailer.

---

### Task 1: `lib/market-blend.ts` — blend primitive + shadow verdict

**Files:**
- Create: `lib/market-blend.ts`
- Test: `tests/market-blend.test.ts`

**Interfaces — Produces:**
- `blendSplit(model: ProbSplit, market: ProbSplit, lambda: number): ProbSplit`
- `type ShadowVerdict = "ADOPT-SHADOW" | "PROVISIONAL" | "HOLD"`
- `shadowVerdict(n, brierModel, brierMarket, brierBlend05, opts?): ShadowVerdict`

- [ ] **Step 1: Write the failing tests**

```typescript
// tests/market-blend.test.ts
import { describe, it, expect } from "vitest";
import { blendSplit, shadowVerdict } from "../lib/market-blend";

const model = { home: 0.5, draw: 0.3, away: 0.2 };
const market = { home: 0.7, draw: 0.2, away: 0.1 };

describe("blendSplit", () => {
  it("returns the model at lambda=0 and the market at lambda=1", () => {
    expect(blendSplit(model, market, 0)).toEqual(model);
    expect(blendSplit(model, market, 1)).toEqual(market);
  });

  it("is the renormalized convex midpoint at lambda=0.5", () => {
    const b = blendSplit(model, market, 0.5);
    expect(b.home).toBeCloseTo(0.6, 6);
    expect(b.draw).toBeCloseTo(0.25, 6);
    expect(b.away).toBeCloseTo(0.15, 6);
    expect(b.home + b.draw + b.away).toBeCloseTo(1, 6);
  });

  it("always sums to 1 even if inputs are unnormalized", () => {
    const b = blendSplit({ home: 1, draw: 1, away: 2 }, { home: 2, draw: 1, away: 1 }, 0.5);
    expect(b.home + b.draw + b.away).toBeCloseTo(1, 6);
  });

  it("throws when lambda is out of [0,1]", () => {
    expect(() => blendSplit(model, market, -0.1)).toThrow();
    expect(() => blendSplit(model, market, 1.1)).toThrow();
  });
});

describe("shadowVerdict", () => {
  it("ADOPT-SHADOW when blend beats both endpoints and n >= 30", () => {
    expect(shadowVerdict(30, 0.50, 0.48, 0.45)).toBe("ADOPT-SHADOW");
  });
  it("PROVISIONAL when blend beats both but n < 30", () => {
    expect(shadowVerdict(20, 0.50, 0.48, 0.45)).toBe("PROVISIONAL");
  });
  it("HOLD when blend does not beat both endpoints", () => {
    expect(shadowVerdict(50, 0.50, 0.40, 0.45)).toBe("HOLD"); // market better than blend
    expect(shadowVerdict(50, 0.44, 0.48, 0.45)).toBe("HOLD"); // model better than blend
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/market-blend.test.ts`
Expected: FAIL — `Cannot find module '../lib/market-blend'`.

- [ ] **Step 3: Implement `lib/market-blend.ts`**

```typescript
// lib/market-blend.ts
//
// Linear-pool blend of the model and market forecasts + the pre-registered
// shadow-adoption rule. Pure; no I/O. Used by scripts/market-shadow.mts to
// evaluate the blend on the settled market-covered sample without touching live
// predictions.
import type { ProbSplit } from "./polymarket";

/** normalize(λ·market + (1−λ)·model). λ ∈ [0,1]; throws otherwise. */
export function blendSplit(model: ProbSplit, market: ProbSplit, lambda: number): ProbSplit {
  if (lambda < 0 || lambda > 1) throw new Error(`blendSplit: lambda ${lambda} out of [0,1]`);
  const mix = (m: number, k: number) => (1 - lambda) * m + lambda * k;
  const home = mix(model.home, market.home);
  const draw = mix(model.draw, market.draw);
  const away = mix(model.away, market.away);
  const z = home + draw + away;
  return { home: home / z, draw: draw / z, away: away / z };
}

export type ShadowVerdict = "ADOPT-SHADOW" | "PROVISIONAL" | "HOLD";

/**
 * Pre-registered rule: the λ=0.5 blend is ADOPT-SHADOW iff it strictly beats both
 * the model-only and market-only Brier AND the sample is large enough (n ≥ minN);
 * PROVISIONAL if it beats both but the sample is too small; HOLD otherwise.
 */
export function shadowVerdict(
  n: number,
  brierModel: number,
  brierMarket: number,
  brierBlend05: number,
  opts: { minN?: number } = {},
): ShadowVerdict {
  const { minN = 30 } = opts;
  const beatsBoth = brierBlend05 < brierModel && brierBlend05 < brierMarket;
  if (!beatsBoth) return "HOLD";
  return n >= minN ? "ADOPT-SHADOW" : "PROVISIONAL";
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/market-blend.test.ts`
Expected: PASS (all cases).

- [ ] **Step 5: Commit**

```bash
git add lib/market-blend.ts tests/market-blend.test.ts
git commit -m "feat(model): linear-pool market blend + pre-registered shadow rule"
```

---

### Task 2: `scripts/market-shadow.mts` + `npm run ml:market-shadow`

**Files:**
- Create: `scripts/market-shadow.mts`
- Modify: `package.json` (add `ml:market-shadow` script)
- Generated: `docs/validation/market-shadow.json`

**Interfaces — Consumes:** `blendSplit`, `shadowVerdict` from `lib/market-blend`; `type ProbSplit` from `lib/polymarket`; `brier`, `rps`, `type Outcome`, `type Split` from `lib/calibration`; `appDir` from `scripts/shared.mts`.

- [ ] **Step 1: Read the input shapes before coding**

Read these to confirm exact field names (do NOT assume):
- `data/predictions.json` — top-level `entries` array. Determine each entry's fixture-slug field and its locked probability split (home/draw/away, and whether 0..1 or 0..100). Use the actual fields.
- `data/markets/polymarket.json` — object keyed by slug (skip keys starting with `_`); each value has `probs: {home,draw,away}` (0..1, de-vigged) and, when settled, `resolved: {home,draw,away}` one-hot.
- `data/markets/kalshi-resolutions.json` — object keyed by slug; each has `resolved: {home,draw,away}` one-hot (fallback result source).
- `lib/calibration.ts` — confirm `brier`/`rps` take a `Split` in **0..100** percentages and an `Outcome`.

- [ ] **Step 2: Implement the script**

```typescript
// scripts/market-shadow.mts
//
// Shadow evaluation of a model/market linear-pool blend on the settled
// market-covered WC26 sample. Joins locked model predictions + de-vigged market
// probs + resolved outcomes; reports model/market/blend Brier+RPS over a λ-grid
// and the pre-registered shadow verdict. No live prediction is changed.
//   npm run ml:market-shadow
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { blendSplit, shadowVerdict } from "../lib/market-blend";
import type { ProbSplit } from "../lib/polymarket";
import { brier, rps, type Outcome, type Split } from "../lib/calibration";
import { appDir } from "./shared.mts";

const LAMBDAS = [0, 0.25, 0.5, 0.75, 1];

// NOTE: adjust the prediction-entry field reads in this block to the ACTUAL
// shape confirmed in Step 1 (slug field + locked split, normalized to 0..1).
type PredEntry = { slug: string; probs: ProbSplit };
function loadModelPredictions(): Map<string, ProbSplit> {
  const raw = JSON.parse(readFileSync(path.join(appDir, "data", "predictions.json"), "utf8")) as { entries: any[] };
  const out = new Map<string, ProbSplit>();
  for (const e of raw.entries) {
    // <-- replace `.slug` / `.probabilities` with the real fields; normalize to 0..1 if stored as 0..100
    const slug: string | undefined = e.slug ?? e.fixtureSlug ?? e.matchSlug;
    const p = e.probabilities ?? e.split ?? e.probs;
    if (!slug || !p) continue;
    const z = (p.home + p.draw + p.away) || 1;
    out.set(slug, { home: p.home / z, draw: p.draw / z, away: p.away / z });
  }
  return out;
}

const pm = JSON.parse(readFileSync(path.join(appDir, "data", "markets", "polymarket.json"), "utf8")) as Record<string, any>;
const kr = JSON.parse(readFileSync(path.join(appDir, "data", "markets", "kalshi-resolutions.json"), "utf8")) as Record<string, any>;
const model = loadModelPredictions();

const outcomeOf = (r: { home: number; draw: number; away: number }): Outcome =>
  r.home ? "home" : r.draw ? "draw" : "away";

type Sample = { slug: string; model: ProbSplit; market: ProbSplit; outcome: Outcome };
const samples: Sample[] = [];
const excluded: Array<{ slug: string; reason: string }> = [];

for (const slug of Object.keys(pm)) {
  if (slug.startsWith("_")) continue;
  const entry = pm[slug];
  const market: ProbSplit | undefined = entry.probs;
  const resolved = entry.resolved ?? kr[slug]?.resolved;
  const m = model.get(slug);
  if (!market) { excluded.push({ slug, reason: "no market probs" }); continue; }
  if (!resolved) { excluded.push({ slug, reason: "not settled" }); continue; }
  if (!m) { excluded.push({ slug, reason: "no model prediction" }); continue; }
  samples.push({ slug, model: m, market, outcome: outcomeOf(resolved) });
}

const pct = (p: ProbSplit): Split => ({ home: p.home * 100, draw: p.draw * 100, away: p.away * 100 });
const meanBrier = (splits: ProbSplit[], outs: Outcome[]) => splits.reduce((a, s, i) => a + brier(pct(s), outs[i]), 0) / (splits.length || 1);
const meanRps = (splits: ProbSplit[], outs: Outcome[]) => splits.reduce((a, s, i) => a + rps(pct(s), outs[i]), 0) / (splits.length || 1);

const outs = samples.map((s) => s.outcome);
const grid = LAMBDAS.map((lambda) => {
  const blended = samples.map((s) => blendSplit(s.model, s.market, lambda));
  return { lambda, brier: Number(meanBrier(blended, outs).toFixed(4)), rps: Number(meanRps(blended, outs).toFixed(4)) };
});

const modelMetrics = { brier: grid[0].brier, rps: grid[0].rps };   // λ=0
const marketMetrics = { brier: grid[grid.length - 1].brier, rps: grid[grid.length - 1].rps }; // λ=1
const blend05 = grid.find((g) => g.lambda === 0.5)!;
const verdict = shadowVerdict(samples.length, modelMetrics.brier, marketMetrics.brier, blend05.brier);

const out = {
  generatedFrom: ["data/predictions.json", "data/markets/polymarket.json", "data/markets/kalshi-resolutions.json"],
  n: samples.length,
  excluded,
  grid,
  model: modelMetrics,
  market: marketMetrics,
  candidateLambda: 0.5,
  verdict,
};
const dir = path.join(appDir, "docs", "validation");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "market-shadow.json"), JSON.stringify(out, null, 1));

console.log(`[market-shadow] n=${samples.length} settled market-covered matches (${excluded.length} excluded)`);
console.log("  lambda  brier   rps");
for (const g of grid) console.log(`  ${g.lambda.toFixed(2)}    ${g.brier.toFixed(4)}  ${g.rps.toFixed(4)}`);
console.log(`[market-shadow] model(λ0) Brier ${modelMetrics.brier} | market(λ1) Brier ${marketMetrics.brier} | blend(λ0.5) Brier ${blend05.brier}`);
console.log(`[market-shadow] verdict: ${verdict}`);
```

- [ ] **Step 3: Add the npm script**

In `package.json`, after `ml:stage-labels` (or `ml:validate` if that line is absent on this branch), add:

```json
    "ml:market-shadow": "tsx scripts/market-shadow.mts",
```

- [ ] **Step 4: Run it and record the verdict (data-safe: read-only)**

Run: `npm run ml:market-shadow`
Expected: prints `n`, the λ-grid Brier/RPS table, the model/market/blend comparison, and the verdict. Writes `docs/validation/market-shadow.json`.

Run: `node -e "const s=require('./docs/validation/market-shadow.json'); console.log('n',s.n,'verdict',s.verdict); console.log('grid',s.grid); console.log('excluded',s.excluded.length)"`
Expected: a coherent grid (λ=0 == model row, λ=1 == market row), a verdict consistent with the rule. RECORD `n`, the grid, and the verdict. If `n` is 0 or the join produced no samples, STOP and report — the prediction-entry field names in Step 1 were likely wrong; fix the field reads and re-run.

- [ ] **Step 5: Commit**

```bash
git add scripts/market-shadow.mts package.json docs/validation/market-shadow.json
git commit -m "feat(model): ml:market-shadow — model/market/blend evaluation (shadow)"
```

---

### Task 3: Full gate sweep + finish

- [ ] **Step 1: Run every commit gate and confirm green**

```bash
npm test
npm run lint
npm run design:inspect
npm run inspect:execution
npm run model:inspect
npm run build
```

Expected: all pass (incl. new market-blend tests). Fix any failure before proceeding.

- [ ] **Step 2: Confirm the verdict is recorded honestly**

Confirm `docs/validation/market-shadow.json` has `n`, the λ-grid, and the verdict, and that `lib/predict.ts` is unchanged (shadow only). If the verdict is PROVISIONAL (likely at small n), state it plainly — the blend is built and measured but not adopted.

- [ ] **Step 3: Finish the branch**

Use superpowers:finishing-a-development-branch to push `feat/phase2-market-shadow-blend` and open a PR for user merge. PR body must state: the blend definition, the λ-grid result (model vs market vs blend Brier), `n`, the verdict (and that PROVISIONAL/HOLD means shadow-only, no live change), and that live wiring is a follow-up once the rule fires.

---

## Self-Review

**Spec coverage:** blend primitive (Task 1) ✓; λ-grid no-overfit eval (Task 2) ✓; pre-registered rule (Task 1 `shadowVerdict`, Task 2 applies it) ✓; honest artifact + excluded reasons (Task 2) ✓; shadow-only / no predict.ts change (Global Constraints + Task 3 Step 2) ✓.

**Placeholder scan:** Task 2 Step 1/2 explicitly flag the prediction-entry field reads as MUST-CONFIRM-against-the-file (the only unknown is `predictions.json`'s exact field names) — Step 4 has a guard (n=0 → stop and fix). All other code is complete.

**Type consistency:** `ProbSplit {home,draw,away}` (0..1) throughout; converted to 0..100 `Split` only at the `brier`/`rps` boundary via `pct()`. `shadowVerdict` signature matches Task 1 test and Task 2 call. `Outcome` from `lib/calibration`.
