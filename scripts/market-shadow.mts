// scripts/market-shadow.mts
//
// Shadow evaluation of a model/market linear-pool blend on the settled
// market-covered WC26 sample. Joins data/predictions.json entries (model split
// + realized outcome) with data/markets/polymarket.json (de-vigged market
// probs). Reports model/market/blend Brier+RPS over a λ-grid and the
// pre-registered shadow verdict. No live prediction is changed.
//   npm run ml:market-shadow
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { blendSplit, shadowVerdict } from "../lib/market-blend";
import { brier, rps, type Outcome, type Split } from "../lib/calibration";
import { appDir } from "./shared.mts";

const LAMBDAS = [0, 0.25, 0.5, 0.75, 1] as const;

// ── types ───────────────────────────────────────────────────────────────────

type ProbSplit = { home: number; draw: number; away: number };

type PredEntry = {
  slug: string;
  split?: { home: number; draw: number; away: number };
  realized?: string;
};

type PolymarketEntry = {
  probs: { home: number; draw: number; away: number };
  [key: string]: unknown;
};

type SampleRow = {
  slug: string;
  model: ProbSplit;   // 0..1
  market: ProbSplit;  // 0..1
  outcome: Outcome;
};

// ── load data ────────────────────────────────────────────────────────────────

const predPath = path.join(appDir, "data", "predictions.json");
const rawPred = JSON.parse(readFileSync(predPath, "utf8")) as { entries: PredEntry[] };

const polyPath = path.join(appDir, "data", "markets", "polymarket.json");
const rawPoly = JSON.parse(readFileSync(polyPath, "utf8")) as Record<string, unknown>;

// Build polymarket lookup (skip keys starting with "_")
const polymap = new Map<string, PolymarketEntry>();
for (const [key, val] of Object.entries(rawPoly)) {
  if (key.startsWith("_")) continue;
  const entry = val as PolymarketEntry;
  if (entry?.probs && typeof entry.probs.home === "number") {
    polymap.set(key, entry);
  }
}

const samples: SampleRow[] = [];
const excluded: Array<{ slug: string; reason: string }> = [];

for (const e of rawPred.entries) {
  const slug = e.slug ?? "";

  // Must have a model split (stored as percentages ~100)
  const sp = e.split;
  if (!sp || typeof sp.home !== "number" || typeof sp.draw !== "number" || typeof sp.away !== "number") {
    excluded.push({ slug, reason: "no model split" });
    continue;
  }

  // Must be settled (realized outcome present)
  const realized = e.realized ?? "";
  if (realized !== "home" && realized !== "draw" && realized !== "away") {
    // Unsettled — not part of sample, don't add to excluded
    continue;
  }

  // Must have polymarket probs for this slug
  const poly = polymap.get(slug);
  if (!poly) {
    excluded.push({ slug, reason: "settled but slug missing from polymarket" });
    continue;
  }

  // Normalize model split (percentages → 0..1)
  const mz = sp.home + sp.draw + sp.away || 1;
  const model: ProbSplit = { home: sp.home / mz, draw: sp.draw / mz, away: sp.away / mz };

  // Normalize market (defensively re-normalize even though already ~0..1)
  const mk = poly.probs;
  const kz = mk.home + mk.draw + mk.away || 1;
  const market: ProbSplit = { home: mk.home / kz, draw: mk.draw / kz, away: mk.away / kz };

  samples.push({ slug, model, market, outcome: realized as Outcome });
}

const n = samples.length;

// ── helpers ───────────────────────────────────────────────────────────────────

/** Convert a 0..1 ProbSplit to the percentage-point Split that brier/rps expect. */
function toPct(p: ProbSplit): Split {
  return { home: p.home * 100, draw: p.draw * 100, away: p.away * 100 };
}

function meanBrier(splits: ProbSplit[], outs: Outcome[]): number {
  if (splits.length === 0) return 0;
  return splits.reduce((acc, s, i) => acc + brier(toPct(s), outs[i]), 0) / splits.length;
}

function meanRps(splits: ProbSplit[], outs: Outcome[]): number {
  if (splits.length === 0) return 0;
  return splits.reduce((acc, s, i) => acc + rps(toPct(s), outs[i]), 0) / splits.length;
}

// ── λ-grid ────────────────────────────────────────────────────────────────────

const outs = samples.map((s) => s.outcome);

const grid = LAMBDAS.map((lambda) => {
  const blended = samples.map((s) => blendSplit(s.model, s.market, lambda));
  return {
    lambda,
    brier: Number(meanBrier(blended, outs).toFixed(4)),
    rps: Number(meanRps(blended, outs).toFixed(4)),
  };
});

// λ=0 → pure model, λ=1 → pure market
const modelMetrics = { brier: grid[0].brier, rps: grid[0].rps };
const marketMetrics = { brier: grid[grid.length - 1].brier, rps: grid[grid.length - 1].rps };
const blend05 = grid.find((g) => g.lambda === 0.5)!;

const verdict = shadowVerdict(n, modelMetrics.brier, marketMetrics.brier, blend05.brier);

// ── artifact ──────────────────────────────────────────────────────────────────

const artifact = {
  generatedFrom: ["data/predictions.json", "data/markets/polymarket.json"],
  n,
  excluded,
  grid,
  model: modelMetrics,
  market: marketMetrics,
  candidateLambda: 0.5,
  verdict,
};

const outDir = path.join(appDir, "docs", "validation");
mkdirSync(outDir, { recursive: true });
writeFileSync(path.join(outDir, "market-shadow.json"), JSON.stringify(artifact, null, 1));

// ── console summary ───────────────────────────────────────────────────────────

console.log(`[market-shadow] n=${n} settled market-covered matches (${excluded.length} excluded)`);
console.log("  lambda  brier   rps");
for (const g of grid) {
  console.log(`  ${g.lambda.toFixed(2)}    ${g.brier.toFixed(4)}  ${g.rps.toFixed(4)}`);
}
console.log(
  `[market-shadow] model(λ0) Brier ${modelMetrics.brier} | market(λ1) Brier ${marketMetrics.brier} | blend(λ0.5) Brier ${blend05.brier}`,
);
console.log(`[market-shadow] verdict: ${verdict}`);
