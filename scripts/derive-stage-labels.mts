// scripts/derive-stage-labels.mts
//
// Derives binary group/knockout stage labels for 1990+ finals-tournament matches
// structurally from results.csv (no external/memory facts) and writes
// data/stage-labels.json. Manual/offline; not a commit gate.
//   npm run ml:stage-labels
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { deriveEditionStages, type EditionMatch } from "../lib/stage-derivation";
import { isFinalsTournament } from "../lib/validation";
import { appDir } from "./shared.mts";

type Row = { date: string; home: string; away: string; tournament: string };

const csv = readFileSync(path.join(appDir, "data", "raw", "results.csv"), "utf8").trim().split("\n").slice(1);
const rows: Row[] = [];
for (const line of csv) {
  const p = line.split(",");
  if (p.length < 9) continue;
  const [date, home, away, hs, as, tournament] = p;
  if (hs === "NA" || as === "NA") continue;
  if (!isFinalsTournament(tournament)) continue;
  if (date.slice(0, 4) < "1990") continue;
  rows.push({ date, home, away, tournament });
}

// Group by tournament:year, preserving a stable global idx for join-back.
const editions = new Map<string, Array<{ row: Row; idx: number }>>();
rows.forEach((row, idx) => {
  const key = `${row.tournament}:${row.date.slice(0, 4)}`;
  (editions.get(key) ?? editions.set(key, []).get(key)!).push({ row, idx });
});

const labels: Array<{ date: string; home: string; away: string; tournament: string; stage: string }> = [];
const unresolved: Array<{ tournament: string; year: string; reason: string }> = [];
let group = 0, knockout = 0, resolvedCount = 0;

for (const [key, items] of editions) {
  const [tournament, year] = key.split(":");
  const ems: EditionMatch[] = items.map((it) => ({ date: it.row.date, home: it.row.home, away: it.row.away, idx: it.idx }));
  const res = deriveEditionStages(ems);
  if (!res.resolved) { unresolved.push({ tournament, year, reason: res.reason ?? "unresolved" }); continue; }
  resolvedCount++;
  for (const it of items) {
    const stage = res.labels.get(it.idx)!;
    if (stage === "group") group++; else knockout++;
    labels.push({ date: it.row.date, home: it.row.home, away: it.row.away, tournament, stage });
  }
}

const out = {
  generatedFrom: "data/raw/results.csv",
  evalFrom: "1990",
  labels,
  unresolved,
  summary: { editions: editions.size, resolved: resolvedCount, group, knockout },
};
writeFileSync(path.join(appDir, "data", "stage-labels.json"), JSON.stringify(out, null, 1));
console.log(`[stage-labels] ${editions.size} editions, ${resolvedCount} resolved, ${unresolved.length} flagged`);
console.log(`[stage-labels] labels: ${group} group + ${knockout} knockout = ${labels.length}`);
if (unresolved.length) console.log("[stage-labels] unresolved:", unresolved.map((u) => `${u.tournament} ${u.year} (${u.reason})`).join("; "));
console.log(`[stage-labels] wrote ${path.join(appDir, "data", "stage-labels.json")}`);
