// Live group standings from played fixtures, FIFA tiebreak order
// (reuses the simulator's rankGroup so the site and the simulation
// can never disagree about ordering rules).
import { rankGroup } from "./simulate";
import type { Fixture } from "./data";

export type StandingRow = {
  teamId: string;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  gf: number;
  ga: number;
  pts: number;
};

export function groupStandings(
  teamIds: string[],
  fixtures: Fixture[],
): StandingRow[] {
  const rows = new Map<string, StandingRow>(
    teamIds.map((id) => [
      id,
      { teamId: id, played: 0, won: 0, drawn: 0, lost: 0, gf: 0, ga: 0, pts: 0 },
    ]),
  );
  const results = new Map<string, [number, number]>();
  for (const f of fixtures) {
    if (f.homeScore === undefined || f.awayScore === undefined) continue;
    const H = rows.get(f.homeId);
    const A = rows.get(f.awayId);
    if (!H || !A) continue;
    results.set(`${f.homeId}|${f.awayId}`, [f.homeScore, f.awayScore]);
    H.played++; A.played++;
    H.gf += f.homeScore; H.ga += f.awayScore;
    A.gf += f.awayScore; A.ga += f.homeScore;
    if (f.homeScore > f.awayScore) { H.won++; A.lost++; H.pts += 3; }
    else if (f.homeScore < f.awayScore) { A.won++; H.lost++; A.pts += 3; }
    else { H.drawn++; A.drawn++; H.pts++; A.pts++; }
  }
  const ranked = rankGroup(
    [...rows.values()].map((r) => ({ team: r.teamId, pts: r.pts, gf: r.gf, ga: r.ga })),
    results,
    () => 0.5, // deterministic: display never randomizes ties
  );
  return ranked.map((r) => rows.get(r.team)!);
}
