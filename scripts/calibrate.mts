// Score a generated preview against the Kalshi market snapshot and (optionally)
// the realized result. Appends a row to pipeline-output/calibration-log.md.
//
//   npm run pipeline:calibrate -- <fixture-slug> [home-goals-away-goals e.g. 2-0]
import { readFileSync, writeFileSync, existsSync, appendFileSync } from "node:fs";
import path from "node:path";
import { brier, splitDeviation, type Outcome, type Split } from "../lib/calibration";
import { parsePreview } from "../lib/preview-parser";
import { appDir, fixtureBySlugOrDie, outDir } from "./shared.mts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pipeline:calibrate -- <fixture-slug> [result e.g. 2-0]");
  process.exit(1);
}
fixtureBySlugOrDie(slug);
const dir = outDir(slug);

const preview = parsePreview(readFileSync(path.join(dir, "preview.md"), "utf8"));
if (!preview.probabilities) {
  console.error("preview.md has no parsable probability split");
  process.exit(1);
}
const model: Split = preview.probabilities;

const market = JSON.parse(readFileSync(path.join(dir, "market.json"), "utf8")) as {
  eventTicker: string;
  fetchedAt: string;
  deVigged: Split;
};

const dev = splitDeviation(model, market.deVigged);

let realized: Outcome | null = null;
let modelBrier = "";
let marketBrier = "";
const resultArg = process.argv[3];
if (resultArg) {
  const m = resultArg.match(/^(\d+)-(\d+)$/);
  if (!m) {
    console.error("result must look like 2-0 (90-minute score)");
    process.exit(1);
  }
  const h = Number(m[1]);
  const a = Number(m[2]);
  realized = h > a ? "home" : h < a ? "away" : "draw";
  modelBrier = brier(model, realized).toFixed(4);
  const marketPct: Split = {
    home: market.deVigged.home * 100,
    draw: market.deVigged.draw * 100,
    away: market.deVigged.away * 100,
  };
  marketBrier = brier(marketPct, realized).toFixed(4);
}

const logPath = path.join(appDir, "pipeline-output", "calibration-log.md");
if (!existsSync(logPath)) {
  writeFileSync(
    logPath,
    "# Calibration log\n\n" +
      "| When (UTC) | Fixture | Model split H/D/A | Market split H/D/A | Max dev (pts) | Result | Model Brier | Market Brier |\n" +
      "|---|---|---|---|---|---|---|---|\n",
  );
}
const pct = (x: number) => Math.round(x * 100);
const row =
  `| ${new Date().toISOString()} | ${slug} ` +
  `| ${model.home}/${model.draw}/${model.away} ` +
  `| ${pct(market.deVigged.home)}/${pct(market.deVigged.draw)}/${pct(market.deVigged.away)} ` +
  `| ${dev.max.toFixed(1)} | ${resultArg ?? "pending"} | ${modelBrier || "—"} | ${marketBrier || "—"} |\n`;
appendFileSync(logPath, row);

console.log(`model  H/D/A: ${model.home}/${model.draw}/${model.away}`);
console.log(
  `market H/D/A: ${pct(market.deVigged.home)}/${pct(market.deVigged.draw)}/${pct(market.deVigged.away)} (${market.eventTicker})`,
);
console.log(`max deviation: ${dev.max.toFixed(1)} pts${realized ? ` | realized: ${realized} | Brier model ${modelBrier} vs market ${marketBrier}` : ""}`);
console.log(`appended ${logPath}`);
