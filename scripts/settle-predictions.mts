// Settle locked predictions against results now present in data/fixtures.json.
// Only adds settlement fields; never edits locked probabilities.
//
//   npm run pipeline:settle
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { settle, type LockedEntry } from "../lib/predictions-ledger";
import { appDir, fixtures } from "./shared.mts";

const ledgerPath = path.join(appDir, "data", "predictions.json");
if (!existsSync(ledgerPath)) {
  console.log("no predictions.json yet — nothing to settle");
  process.exit(0);
}
const ledger = JSON.parse(readFileSync(ledgerPath, "utf8")) as {
  entries: LockedEntry[];
};
const before = ledger.entries.filter((e) => e.result !== undefined).length;
const entries = settle(ledger.entries, fixtures());
const after = entries.filter((e) => e.result !== undefined).length;
writeFileSync(ledgerPath, JSON.stringify({ entries }, null, 1));
console.log(`settled ${after - before} new (total settled ${after}/${entries.length})`);
