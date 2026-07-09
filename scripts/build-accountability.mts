/**
 * Build the WC26 accountability report.
 *
 * Reads:
 *   data/predictions.json
 *   data/match-facts.json
 *   data/markets/kalshi-resolutions.json
 *   data/markets/polymarket.json
 *
 * Writes:
 *   data/backtest/wc26-accountability.json
 *   README/accountability-report.md
 *
 *   npm run report:accountability
 */

import { existsSync, readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appDir } from "./shared.mts";
import {
  buildAccountability,
  type LockedEntry,
  type MatchFacts,
  type KalshiResolution,
  type PolymarketEntry,
  type OfficialRow,
  type InformationalRow,
  type Aggregates,
} from "../lib/accountability.js";

// ---------------------------------------------------------------------------
// File readers
// ---------------------------------------------------------------------------

function readJson<T>(filePath: string): T {
  return JSON.parse(readFileSync(filePath, "utf8")) as T;
}

// ---------------------------------------------------------------------------
// Markdown rendering helpers
// ---------------------------------------------------------------------------

function pct(v: number | null, decimals = 1): string {
  if (v === null) return "—";
  return `${(v * 100).toFixed(decimals)}%`;
}

function num(v: number | null, decimals = 4): string {
  if (v === null) return "—";
  return v.toFixed(decimals);
}

function verdictEmoji(v: "hit" | "close" | "miss"): string {
  if (v === "hit") return "✅";
  if (v === "close") return "🟡";
  return "❌";
}

function renderOfficialTable(rows: OfficialRow[]): string {
  if (rows.length === 0) return "_No official graded entries yet._\n";
  const header = [
    "| Match | Model Call | Actual | BTTS | Model Brier | Kalshi Brier | Verdict |",
    "|-------|-----------|--------|------|-------------|--------------|---------|",
  ];
  const rowLines = rows.map((r) => {
    const modelCall = `${r.locked.home}/${r.locked.draw}/${r.locked.away}`;
    const bttsMark =
      r.grades.bttsBrier !== undefined
        ? num(r.grades.bttsBrier, 4) + (r.grades.bttsDerivedPostHoc ? " †" : "")
        : "—";
    const kalshiBrier = r.kalshi ? num(r.kalshi.brier, 4) : "—";
    return `| ${r.slug} | ${modelCall} | ${r.actual} | ${bttsMark} | ${num(r.grades.modelBrier, 4)} | ${kalshiBrier} | ${verdictEmoji(r.verdict)} ${r.verdict} |`;
  });
  return [...header, ...rowLines].join("\n");
}

function renderAggregates(agg: Aggregates): string {
  const lines: string[] = [
    `**n** = ${agg.n} (tiny sample — do not over-read)`,
    "",
    "| Metric | Value |",
    "|--------|-------|",
    `| Accuracy (correct outcome bucket) | ${pct(agg.accuracy)} |`,
    `| Mean Brier | ${num(agg.meanBrier)} |`,
    `| Mean RPS | ${num(agg.meanRps)} |`,
    `| Scoreline hit rate | ${pct(agg.scorelineHitRate)} |`,
    `| Top-3 scoreline rate | ${pct(agg.top3Rate)} |`,
    `| BTTS accuracy † | ${pct(agg.bttsAccuracy)} |`,
    "",
    "### vs Kalshi",
    "",
    `n = ${agg.vsKalshi.n}${agg.vsKalshi.n === 0 ? " (no data)" : ""}`,
    "",
    "| | Model | Kalshi | Edge (Kalshi−Model) |",
    "|--|-------|--------|---------------------|",
    `| Brier | ${num(agg.vsKalshi.modelBrier)} | ${num(agg.vsKalshi.marketBrier)} | ${num(agg.vsKalshi.edge)} |`,
    "",
    "### vs Polymarket",
    "",
    `n = ${agg.vsPolymarket.n} — No pre-kickoff Polymarket books available for played matches. Comparison deferred to Phase C backtest.`,
  ];
  return lines.join("\n");
}

function renderInformationalTable(rows: InformationalRow[]): string {
  if (rows.length === 0) return "_No informational entries._\n";
  const header = [
    "| Match | Actual | BTTS | Goals | Kalshi | Polymarket | Note |",
    "|-------|--------|------|-------|--------|------------|------|",
  ];
  const rowLines = rows.map((r) => {
    const btts = r.btts !== undefined ? (r.btts ? "Yes" : "No") : "—";
    const goals = r.totalGoals !== undefined ? String(r.totalGoals) : "—";
    const kalshi = r.kalshiResolution ?? "—";
    const pm = r.polymarketResolution ?? "—";
    return `| ${r.slug} | ${r.actual} | ${btts} | ${goals} | ${kalshi} | ${pm} | no lock |`;
  });
  return [...header, ...rowLines].join("\n");
}

type ParlaySlipRow = {
  verdict?: "no-slip";
  engineVersion?: string;
  jointProb?: number;
  legs?: Array<{ ticker: string }>;
  result?: { legs: Array<{ ticker: string; hit: boolean }>; slipHit: boolean };
};

type ParlaySummary = {
  slips: number;
  noSlips: number;
  graded: number;
  slipHits: number;
  slipHitRate: number | null;
  legHits: number;
  legs: number;
  legHitRate: number | null;
  meanLockedJoint: number | null;
  realizedSlipHitRate: number | null;
};

function summarizeParlayRows(rows: ParlaySlipRow[]): ParlaySummary {
  const locked = rows.filter((r) => r.verdict !== "no-slip");
  const noSlips = rows.length - locked.length;
  const graded = locked.filter((r) => r.result);
  const slipHits = graded.filter((r) => r.result?.slipHit).length;
  const legRows = graded.flatMap((r) => r.result?.legs ?? []);
  const legHits = legRows.filter((l) => l.hit).length;
  const joints = graded.map((r) => r.jointProb).filter((j): j is number => typeof j === "number");
  const slipHitRate = graded.length > 0 ? slipHits / graded.length : null;
  return {
    slips: locked.length,
    noSlips,
    graded: graded.length,
    slipHits,
    slipHitRate,
    legHits,
    legs: legRows.length,
    legHitRate: legRows.length > 0 ? legHits / legRows.length : null,
    meanLockedJoint: joints.length > 0 ? joints.reduce((a, b) => a + b, 0) / joints.length : null,
    realizedSlipHitRate: slipHitRate,
  };
}

/** Per-engine-version slip/leg hit rates + locked-joint calibration from data/parlays.json. */
function parlaySummaries(): Array<ParlaySummary & { version: string }> {
  const parlaysPath = path.join(appDir, "data", "parlays.json");
  if (!existsSync(parlaysPath)) return [];
  const rows = readJson<ParlaySlipRow[]>(parlaysPath);
  if (!Array.isArray(rows) || rows.length === 0) return [];
  const groups = new Map<string, ParlaySlipRow[]>();
  for (const r of rows) {
    const v = r.engineVersion ?? "v1";
    groups.set(v, [...(groups.get(v) ?? []), r]);
  }
  return [...groups.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([version, group]) => ({ version, ...summarizeParlayRows(group) }));
}

function renderParlays(summaries: Array<ParlaySummary & { version: string }>): string {
  const sections = summaries.map((p) =>
    [
      `### Engine ${p.version}`,
      "",
      "| Metric | Value |",
      "|--------|-------|",
      `| Locked slips | ${p.slips} |`,
      `| No-slip days | ${p.noSlips} |`,
      `| Graded | ${p.graded} |`,
      `| Slip hit rate | ${pct(p.slipHitRate)} (${p.slipHits}/${p.graded}) |`,
      `| Leg hit rate | ${pct(p.legHitRate)} (${p.legHits}/${p.legs}) |`,
      `| Locked joint avg (graded) | ${pct(p.meanLockedJoint)} |`,
      `| Realized slip hit rate | ${pct(p.realizedSlipHitRate)} |`,
    ].join("\n"),
  );
  return [
    "## Parlays",
    "",
    "Model-optimized Kalshi parlay slips (pre-registered floors per engine version, locked pre-kickoff, graded on the same 90-minute semantics as predictions; v2 slips restricted to combo-eligible markets).",
    "",
    ...sections,
    "",
    "---",
    "",
  ].join("\n");
}

function renderMarkdown(
  output: ReturnType<typeof buildAccountability>,
  generatedDate: string,
  parlays: Array<ParlaySummary & { version: string }>,
): string {
  const sections: string[] = [
    "# WC26 Accountability Report",
    "",
    `_Generated: ${generatedDate}_`,
    "",
    "## Framing",
    "",
    "This report evaluates the matchday briefing model's predictions against final results. " +
      "The **official graded record** covers only matches for which a pre-kickoff prediction was " +
      "locked before kick-off (under the immutable integrity rule: no retroactive predictions). " +
      `As of this report, that is **n=${output.official.aggregates.n}** match(es). ` +
      "Three additional matches were played before the lock window was first operational; " +
      "they are shown below in the **informational** section with actual results and market resolutions " +
      "but are explicitly not graded against the model (that would be in-sample and dishonest). " +
      "Full out-of-sample model assessment will appear in the Phase C backtest.",
    "",
    "---",
    "",
    "## Official Graded Record",
    "",
    "Only matches with a locked pre-kickoff split AND a final result.",
    "",
    "### Per-Match",
    "",
    "_Model Call = home%/draw%/away% (percentage points). BTTS brier marked † = derived post-hoc._",
    "",
    renderOfficialTable(output.official.rows),
    "",
    "### Aggregates",
    "",
    renderAggregates(output.official.aggregates),
    "",
    "---",
    "",
    "## Informational (Played Before Lock Window)",
    "",
    "**No locked prediction exists for these matches.** Actual results and market resolutions are shown for context only. These matches are NOT scored against the model.",
    "",
    renderInformationalTable(output.informational.rows),
    "",
    "---",
    "",
    ...(parlays.length > 0 ? [renderParlays(parlays)] : []),
    "## Caveats",
    "",
    ...output.caveats.map((c) => `- ${c}`),
    "",
    "---",
    "",
    "_Report auto-generated by `scripts/build-accountability.mts`. Do not edit manually._",
  ];
  return sections.join("\n");
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------

async function main() {
  const ledgerPath = path.join(appDir, "data", "predictions.json");
  const factsPath = path.join(appDir, "data", "match-facts.json");
  const kalshiPath = path.join(appDir, "data", "markets", "kalshi-resolutions.json");
  const polymarketPath = path.join(appDir, "data", "markets", "polymarket.json");

  console.log("[accountability] Reading data files...");
  const ledger = readJson<{ entries: LockedEntry[] }>(ledgerPath);
  const matchFacts = readJson<Record<string, MatchFacts>>(factsPath);
  const kalshiRaw = readJson<Record<string, KalshiResolution>>(kalshiPath);
  const polymarketRaw = readJson<{ _checkedAt?: string; _source?: string; _summary?: unknown } & Record<string, unknown>>(polymarketPath);

  // Strip metadata keys from polymarket
  const polymarketEntries: Record<string, PolymarketEntry> = {};
  for (const [slug, val] of Object.entries(polymarketRaw)) {
    if (slug.startsWith("_")) continue;
    const entry = val as Record<string, unknown>;
    polymarketEntries[slug] = {
      probs: entry.probs as PolymarketEntry["probs"],
      resolved: entry.resolved as PolymarketEntry["resolved"],
    };
  }

  console.log("[accountability] Building accountability output...");
  const output = buildAccountability(ledger, matchFacts, kalshiRaw, polymarketEntries);
  const parlays = parlaySummaries();

  // Write JSON
  const backtestDir = path.join(appDir, "data", "backtest");
  mkdirSync(backtestDir, { recursive: true });
  const jsonPath = path.join(backtestDir, "wc26-accountability.json");
  writeFileSync(jsonPath, JSON.stringify(parlays.length > 0 ? { ...output, parlays } : output, null, 2) + "\n");
  console.log(`[accountability] Wrote ${jsonPath}`);

  // Write markdown
  const readmeDir = path.join(appDir, "..", "README");
  mkdirSync(readmeDir, { recursive: true });
  const mdPath = path.join(readmeDir, "accountability-report.md");
  const generatedDate = new Date().toISOString().replace("T", " ").slice(0, 19) + " UTC";
  writeFileSync(mdPath, renderMarkdown(output, generatedDate, parlays));
  console.log(`[accountability] Wrote ${mdPath}`);

  // Print summary to stdout
  const { aggregates } = output.official;
  console.log("\n[accountability] === Summary ===");
  console.log(`  Official graded matches: ${aggregates.n}`);
  console.log(`  Accuracy: ${aggregates.accuracy !== null ? (aggregates.accuracy * 100).toFixed(1) + "%" : "—"}`);
  console.log(`  Mean Brier: ${aggregates.meanBrier !== null ? aggregates.meanBrier.toFixed(4) : "—"}`);
  console.log(`  Mean RPS: ${aggregates.meanRps !== null ? aggregates.meanRps.toFixed(4) : "—"}`);
  console.log(`  vsKalshi n=${aggregates.vsKalshi.n}, edge=${aggregates.vsKalshi.edge !== null ? aggregates.vsKalshi.edge.toFixed(4) : "—"}`);
  console.log(`  Informational rows: ${output.informational.rows.length}`);
  for (const p of parlays) {
    console.log(
      `  Parlays [${p.version}]: ${p.graded} graded, slip hit rate ${p.slipHitRate !== null ? (p.slipHitRate * 100).toFixed(1) + "%" : "—"}, ` +
        `leg hit rate ${p.legHitRate !== null ? (p.legHitRate * 100).toFixed(1) + "%" : "—"}, ` +
        `locked joint avg ${p.meanLockedJoint !== null ? (p.meanLockedJoint * 100).toFixed(1) + "%" : "—"} vs realized ${p.realizedSlipHitRate !== null ? (p.realizedSlipHitRate * 100).toFixed(1) + "%" : "—"}`,
    );
  }
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("[accountability] Fatal error:", err);
    process.exit(1);
  });
}
