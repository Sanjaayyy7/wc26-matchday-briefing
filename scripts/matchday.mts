// The one daily command: refresh data, settle the record, retrain (gated),
// rebuild the schedule, lock new predictions, re-run the simulator.
//
//   npm run matchday
import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";
import path from "node:path";
import { appDir } from "./shared.mts";

const steps: Array<[string, string]> = [
  ["refresh dataset", "fetch-dataset.mts"],
  ["rebuild schedule (scores in)", "build-schedule.mts"],
  ["settle locked predictions", "settle-predictions.mts"],
  ["retrain model (gates)", "train-model.mts"],
  ["lock new predictions", "lock-predictions.mts"],
  ["simulate tournament", "run-simulator.mts"],
];

for (const [label, script] of steps) {
  console.log(`\n=== ${label} ===`);
  try {
    execFileSync("npx", ["tsx", path.join(appDir, "scripts", script)], {
      stdio: "inherit",
      cwd: appDir,
    });
  } catch {
    console.error(`\nMATCHDAY ABORTED at "${label}" — fix and re-run.`);
    process.exit(1);
  }
}

// Summary
const read = (f: string) => JSON.parse(readFileSync(path.join(appDir, "data", f), "utf8"));
const ledger = read("predictions.json") as {
  entries: Array<{ result?: string; correctPick?: boolean; modelBrier?: number; modelRps?: number }>;
};
const sim = read("simulation.json") as {
  teams: Record<string, { champion: number }>;
};
const settled = ledger.entries.filter((e) => e.result !== undefined);
const correct = settled.filter((e) => e.correctPick).length;
const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : NaN);
const top5 = Object.entries(sim.teams)
  .sort((a, b) => b[1].champion - a[1].champion)
  .slice(0, 5)
  .map(([t, o]) => `${t} ${(o.champion * 100).toFixed(1)}%`)
  .join(" · ");

console.log("\n=== matchday summary ===");
console.log(
  `record: ${correct}/${settled.length} correct picks` +
    (settled.length
      ? `, Brier ${avg(settled.map((e) => e.modelBrier!)).toFixed(3)}, RPS ${avg(settled.map((e) => e.modelRps!)).toFixed(3)}`
      : ""),
);
console.log(`open locks: ${ledger.entries.length - settled.length}`);
console.log(`champion odds: ${top5}`);
