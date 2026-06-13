// Settle locked predictions against results now present in data/fixtures.json.
// Only adds settlement fields; never edits locked probabilities.
//
//   npm run pipeline:settle
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { settle, type LockedEntry } from "../lib/predictions-ledger";
import { predictFixture } from "../lib/predict";
import { appDir, fixtures, teams } from "./shared.mts";

const ledgerPath = path.join(appDir, "data", "predictions.json");
if (!existsSync(ledgerPath)) {
  console.log("no predictions.json yet — nothing to settle");
  process.exit(0);
}
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
  entries: LockedEntry[];
};

// Load market resolution data for cross-checks.
const kalshiResPath = path.join(appDir, "data", "markets", "kalshi-resolutions.json");
const polymarketPath = path.join(appDir, "data", "markets", "polymarket.json");
const kalshiResolutions = existsSync(kalshiResPath)
  ? JSON.parse(readFileSync(kalshiResPath, "utf8"))
  : {};
const polymarketRaw = existsSync(polymarketPath)
  ? JSON.parse(readFileSync(polymarketPath, "utf8"))
  : {};
// Strip top-level metadata keys (starting with "_") to get slug-keyed entries.
const polymarketData: Record<string, { probs: { home: number; draw: number; away: number }; resolved: { home: number; draw: number; away: number } | null }> = Object.fromEntries(
  Object.entries(polymarketRaw).filter(([k]) => !k.startsWith("_")) as Array<[string, { probs: { home: number; draw: number; away: number }; resolved: { home: number; draw: number; away: number } | null }]>,
);

// Build slug → fixture row map for grid recomputation.
const allFixtures = fixtures();
const teamList = teams();
const teamName = (id: string) => teamList.find((t) => t.id === id)?.name ?? id;
const HOSTS = ["United States", "Canada", "Mexico"];

// gridForSlug: recompute the score grid post-hoc using the CURRENT model.
// Everything derived from this grid carries derivedPostHoc=true in the ledger.
function gridForSlug(slug: string): number[][] | undefined {
  const f = allFixtures.find((x) => x.slug === slug);
  if (!f) return undefined;
  try {
    const home = teamName(f.homeId);
    const pred = predictFixture({
      home,
      away: teamName(f.awayId),
      neutral: !HOSTS.includes(home),
      stage: f.stage ?? "group",
    });
    return pred.grid;
  } catch {
    // Team not in model (shouldn't happen for locked entries, but be safe)
    return undefined;
  }
}

const before = ledger.entries.filter((e) => e.result !== undefined).length;
const entries = settle(ledger.entries, allFixtures, {
  gridForSlug,
  kalshiResolutions,
  polymarketData,
});
const after = entries.filter((e) => e.result !== undefined).length;
writeFileSync(ledgerPath, JSON.stringify({ entries }, null, 1));
console.log(`settled ${after - before} new (total settled ${after}/${entries.length})`);

// Print settled entries for inspection.
if (after - before > 0) {
  const newlySettled = entries.filter((e) => {
    const was = ledger.entries.find((x) => x.slug === e.slug);
    return e.result !== undefined && was?.result === undefined;
  });
  for (const e of newlySettled) {
    console.log(`\n--- ${e.slug} ---`);
    console.log(`  result: ${e.result}  realized: ${e.realized}  correctPick: ${e.correctPick}`);
    console.log(`  modelBrier: ${e.modelBrier?.toFixed(4)}  modelRps: ${e.modelRps?.toFixed(4)}  logLoss: ${e.logLoss?.toFixed(4)}`);
    console.log(`  scorelineHit: ${e.scorelineHit}  top3Hit: ${e.top3ScorelineHit}`);
    if (e.btts) console.log(`  btts: prob=${e.btts.prob.toFixed(4)} actual=${e.btts.actual} brier=${e.btts.brier.toFixed(4)}`);
    if (e.ou25) console.log(`  ou25: prob=${e.ou25.prob.toFixed(4)} actual=${e.ou25.actual} brier=${e.ou25.brier.toFixed(4)}`);
    if (e.markets?.kalshi) console.log(`  markets.kalshi brier: ${e.markets.kalshi.brier.toFixed(4)}`);
    if (e.markets?.polymarket) console.log(`  markets.polymarket: brier=${e.markets.polymarket.brier?.toFixed(4) ?? "omitted (degenerate)"}`);
    if (e.resolutionCheck) console.log(`  resolutionCheck: ${JSON.stringify(e.resolutionCheck)}`);
  }
}
