// Run the Monte Carlo tournament simulation and write data/simulation.json.
//
//   npm run ml:simulate [-- <runs>]     (default 10000, max 50000)
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { simulateTournament, type SimFixture, type Bracket } from "../lib/simulate";
import type { ModelParams } from "../lib/poisson-model";
import { appDir } from "./shared.mts";

const runs = Math.min(Number(process.argv[2] ?? 10000) || 10000, 50000);

const read = (f: string) =>
  JSON.parse(readFileSync(path.join(appDir, "data", f), "utf8"));
const groupsFile = read("groups.json") as { groups: Record<string, string[]> };
const bracket = read("bracket.json") as Bracket;
const fixturesJson = read("fixtures.json") as Array<{
  homeId: string; awayId: string; group?: string; neutral?: boolean;
  homeScore?: number; awayScore?: number;
}>;
const clubs = read("clubs.json") as Array<{ id: string; datasetName?: string; name: string }>;
const model = read("model.json") as {
  dataThrough: string;
  params: ModelParams;
  ratings: Record<string, number>;
};

const byId = new Map(clubs.map((c) => [c.id, c.datasetName ?? c.name]));
const fixtures: SimFixture[] = fixturesJson.map((f) => ({
  home: byId.get(f.homeId)!,
  away: byId.get(f.awayId)!,
  group: f.group!,
  neutral: f.neutral ?? true,
  homeScore: f.homeScore,
  awayScore: f.awayScore,
}));

// Settled knockout matches are pinned, not resampled (data/knockout-results.json).
const koResults = (() => {
  try {
    return read("knockout-results.json") as {
      roundOf32: Array<{ match: number; winnerId: string }>;
    };
  } catch {
    return { roundOf32: [] };
  }
})();
const knownWinners = Object.fromEntries(
  koResults.roundOf32.map((r) => [r.match, byId.get(r.winnerId)!]),
);

const t0 = Date.now();
const out = simulateTournament(
  {
    groups: groupsFile.groups,
    fixtures,
    bracket,
    ratings: model.ratings,
    params: model.params,
    knownWinners,
  },
  runs,
);
const elapsed = ((Date.now() - t0) / 1000).toFixed(1);

writeFileSync(
  path.join(appDir, "data", "simulation.json"),
  JSON.stringify(
    {
      runMeta: {
        runs: out.runs,
        seed: out.seed,
        dataThrough: model.dataThrough,
        generatedAt: new Date().toISOString(),
        playedLocked: fixtures.filter((f) => f.homeScore !== undefined).length,
        knockoutVenueNote:
          "Knockout matches simulated as neutral-venue; host venue edges not modeled.",
      },
      teams: out.teams,
    },
    null,
    1,
  ),
);

const top = Object.entries(out.teams)
  .sort((a, b) => b[1].champion - a[1].champion)
  .slice(0, 8)
  .map(([t, o]) => `${t} ${(o.champion * 100).toFixed(1)}%`)
  .join(" · ");
console.log(`simulated ${runs} tournaments in ${elapsed}s`);
console.log(`champions: ${top}`);
console.log("wrote data/simulation.json");
