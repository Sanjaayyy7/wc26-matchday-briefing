// Assemble the VERIFIED_FACTS artifact for a fixture from a curated input file.
// Facts enter the pipeline ONLY with a source tag — that is the whole point
// (audit-ledger L-02): "verified" means a human or research agent attached a
// source, not that the model remembered something.
//
//   1. Create pipeline-input/<slug>.md with one fact per line:
//        [squad] Brazil: 26 named, all available (source: CBF release 10 Jun)
//   2. npm run pipeline:facts -- <fixture-slug>
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { appDir, fixtureBySlugOrDie, outDir } from "./shared.mts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pipeline:facts -- <fixture-slug>");
  process.exit(1);
}
fixtureBySlugOrDie(slug);

const inputPath = path.join(appDir, "pipeline-input", `${slug}.md`);
if (!existsSync(inputPath)) {
  console.error(`No curated facts at ${inputPath}.`);
  console.error(
    "Create it (one tagged fact per line) — a research agent or human fills this from current sources.",
  );
  process.exit(1);
}

const lines = readFileSync(inputPath, "utf8")
  .split("\n")
  .map((l) => l.trim())
  .filter((l) => l && !l.startsWith("#"));

const untagged = lines.filter((l) => !/\(source:[^)]+\)\s*$/.test(l));
if (untagged.length) {
  console.error("Rejected — facts without a (source: ...) tag:");
  for (const l of untagged) console.error(`  ${l}`);
  process.exit(1);
}

const dir = outDir(slug);
writeFileSync(path.join(dir, "facts.md"), lines.join("\n") + "\n");
console.log(`wrote ${dir}/facts.md (${lines.length} sourced facts)`);
