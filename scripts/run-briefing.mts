// Generate a fixture briefing from the trained ML model (no API, no cost),
// validate it against the Output Contract parser, and save it for calibration.
//
//   npm run pipeline:run -- <fixture-slug>
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { predictFixture } from "../lib/predict";
import { buildPreviewMarkdown } from "../lib/briefing-template";
import { parsePreview } from "../lib/preview-parser";
import { appDir, fixtureBySlugOrDie, outDir, teams } from "./shared.mts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pipeline:run -- <fixture-slug>");
  process.exit(1);
}
const fixture = fixtureBySlugOrDie(slug);
const teamName = (id: string) => {
  const t = teams().find((x) => x.id === id);
  if (!t) throw new Error(`unknown team ${id}`);
  return t.name;
};

const homeName = teamName(fixture.homeId);
const awayName = teamName(fixture.awayId);
const HOSTS = ["United States", "Canada", "Mexico"];
const prediction = predictFixture({
  home: homeName,
  away: awayName,
  neutral: !HOSTS.includes(homeName),
  stage: fixture.stage ?? "group",
});
const markdown = buildPreviewMarkdown(prediction, { homeName, awayName });

const dir = outDir(slug);
writeFileSync(path.join(dir, "preview.md"), markdown);
const modelMeta = JSON.parse(
  readFileSync(path.join(appDir, "data", "model.json"), "utf8"),
);
writeFileSync(
  path.join(dir, "run-meta.json"),
  JSON.stringify(
    {
      predictor: "elo-dixon-coles",
      dataThrough: modelMeta.dataThrough,
      params: modelMeta.params,
      backtest: modelMeta.backtest,
      generatedAt: new Date().toISOString(),
      elo: prediction.elo,
      lambdas: prediction.lambdas,
    },
    null,
    2,
  ),
);

const parsed = parsePreview(markdown);
const sum = parsed.probabilities
  ? parsed.probabilities.home + parsed.probabilities.draw + parsed.probabilities.away
  : NaN;
console.log(`wrote ${dir}/preview.md`);
console.log(
  `split: ${JSON.stringify(prediction.split)} | band: ${prediction.band} | contract ok=${parsed.ok} sum=${sum}`,
);
if (!parsed.ok || sum !== 100) {
  console.error("CONTRACT VIOLATION — generated briefing failed validation");
  process.exit(2);
}
