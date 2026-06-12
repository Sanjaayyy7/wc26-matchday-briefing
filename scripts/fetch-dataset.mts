// Download the international results dataset (martj42 mirror, no auth) to
// data/raw/results.csv. ~49k matches, 1872 → present, updated with WC26 rows.
//
//   npm run ml:fetch
import { writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { appDir } from "./shared.mts";

const URL =
  "https://raw.githubusercontent.com/martj42/international_results/master/results.csv";

const res = await fetch(URL);
if (!res.ok) {
  console.error(`fetch failed: ${res.status}`);
  process.exit(1);
}
const csv = await res.text();
const rows = csv.trim().split("\n").length - 1;
if (rows < 40000) {
  console.error(`suspiciously small dataset (${rows} rows) — refusing to save`);
  process.exit(1);
}
const dir = path.join(appDir, "data", "raw");
mkdirSync(dir, { recursive: true });
writeFileSync(path.join(dir, "results.csv"), csv);
console.log(`wrote data/raw/results.csv (${rows} matches)`);
