// Build per-team Elo trajectories and per-fixture H2H aggregates for the
// 48 WC26 teams from the full results dataset → data/history.json.
//
//   npm run ml:history
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { updateElo } from "../lib/elo";
import { appDir } from "./shared.mts";

const csv = readFileSync(path.join(appDir, "data", "raw", "results.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1);
const groupsFile = JSON.parse(
  readFileSync(path.join(appDir, "data", "groups.json"), "utf8"),
) as { groups: Record<string, string[]> };
const fixtures = JSON.parse(
  readFileSync(path.join(appDir, "data", "fixtures.json"), "utf8"),
) as Array<{ slug: string; homeId: string; awayId: string }>;
const clubs = JSON.parse(
  readFileSync(path.join(appDir, "data", "clubs.json"), "utf8"),
) as Array<{ id: string; datasetName?: string; name: string }>;

const wcTeams = new Set(Object.values(groupsFile.groups).flat());

// Chronological pass: Elo + per-pair H2H for WC26 teams only.
const ratings = new Map<string, number>();
const get = (t: string) => ratings.get(t) ?? 1500;
const trajectories = new Map<string, Array<{ date: string; elo: number }>>();
const lastSampled = new Map<string, string>(); // team -> "YYYY-MM" of last sample
type H2H = {
  played: number;
  aWins: number;
  bWins: number;
  draws: number;
  lastDate: string;
  lastScore: string;
  lastHome: string;
};
const h2h = new Map<string, H2H>();
const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);

for (const line of csv) {
  const [date, home, away, hs, as, tournament, , , neutral] = line.split(",");
  if (hs === "NA" || as === "NA") continue;
  const eloH = get(home);
  const eloA = get(away);
  const updated = updateElo({
    home: eloH,
    away: eloA,
    homeScore: Number(hs),
    awayScore: Number(as),
    tournament,
    neutral: neutral?.trim().toUpperCase() === "TRUE",
  });
  ratings.set(home, updated.home);
  ratings.set(away, updated.away);

  for (const team of [home, away]) {
    if (!wcTeams.has(team) || date < "2002-01-01") continue;
    const month = date.slice(0, 7);
    // Sample at most one point per quarter to keep the artifact small.
    const quarter = `${date.slice(0, 4)}-Q${Math.floor(Number(date.slice(5, 7)) / 4)}`;
    if (lastSampled.get(team) === quarter) continue;
    lastSampled.set(team, quarter);
    const arr = trajectories.get(team) ?? [];
    arr.push({ date: month, elo: Math.round(get(team)) });
    trajectories.set(team, arr);
  }

  if (wcTeams.has(home) && wcTeams.has(away)) {
    const key = pairKey(home, away);
    const [a] = key.split("|");
    const rec = h2h.get(key) ?? {
      played: 0, aWins: 0, bWins: 0, draws: 0, lastDate: "", lastScore: "", lastHome: "",
    };
    rec.played++;
    const hWin = Number(hs) > Number(as);
    const aWin = Number(as) > Number(hs);
    if (Number(hs) === Number(as)) rec.draws++;
    else if ((home === a && hWin) || (away === a && aWin)) rec.aWins++;
    else rec.bWins++;
    rec.lastDate = date;
    rec.lastScore = `${hs}-${as}`;
    rec.lastHome = home;
    h2h.set(key, rec);
  }
}

// Keep the last 40 trajectory points per team.
const trajOut: Record<string, Array<{ date: string; elo: number }>> = {};
for (const [team, arr] of trajectories) {
  trajOut[team] = arr.slice(-40);
}

// H2H rows for each scheduled WC26 fixture.
const byId = new Map(clubs.map((c) => [c.id, c.datasetName ?? c.name]));
const h2hOut: Record<
  string,
  (H2H & { teamA: string; teamB: string }) | null
> = {};
for (const f of fixtures) {
  const home = byId.get(f.homeId)!;
  const away = byId.get(f.awayId)!;
  const key = pairKey(home, away);
  const rec = h2h.get(key);
  const [a, b] = key.split("|");
  h2hOut[f.slug] = rec ? { ...rec, teamA: a, teamB: b } : null;
}

writeFileSync(
  path.join(appDir, "data", "history.json"),
  JSON.stringify({ trajectories: trajOut, h2h: h2hOut }, null, 0),
);
const withHistory = Object.values(h2hOut).filter(Boolean).length;
console.log(
  `wrote history.json: ${Object.keys(trajOut).length} trajectories, H2H for ${withHistory}/${fixtures.length} fixtures`,
);
