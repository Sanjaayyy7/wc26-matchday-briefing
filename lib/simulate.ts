// Monte Carlo tournament simulator: locked real results + Dixon-Coles score
// sampling for everything unplayed, FIFA group tiebreakers, verified bracket
// chaining, ET/pens fold for drawn knockout games.
import { mulberry32 } from "./rng";
import { lambdasFromElo, scoreGrid, GRID_SIZE, type ModelParams } from "./poisson-model";

export type SimFixture = {
  home: string; // dataset team name
  away: string;
  group: string;
  neutral: boolean;
  homeScore?: number;
  awayScore?: number;
};

export type Qualifier =
  | { type: "winner" | "runnerup"; group: string }
  | { type: "third"; allowed: string[] };

export type Bracket = {
  roundOf32: Array<{ match: number; home: Qualifier; away: Qualifier }>;
  roundOf16: Array<{ match: number; home: number; away: number }>;
  quarterFinals: Array<{ match: number; home: number; away: number }>;
  semiFinals: Array<{ match: number; home: number; away: number }>;
  final: { match: number; home: number; away: number };
};

export type SimInput = {
  groups: Record<string, string[]>;
  fixtures: SimFixture[];
  bracket: Bracket;
  ratings: Record<string, number>;
  params: ModelParams;
  /** Settled knockout outcomes, bracket match number → winning team.
   *  Pinned in every run instead of sampling (keeps odds conditional on reality). */
  knownWinners?: Record<number, string>;
};

export type TeamOdds = {
  advanceGroup: number;
  reachR16: number;
  reachQF: number;
  reachSF: number;
  reachFinal: number;
  champion: number;
};

type Standing = {
  team: string;
  pts: number;
  gf: number;
  ga: number;
};

/** FIFA ordering: points, GD, GF, then head-to-head points among tied, then lot. */
export function rankGroup(
  rows: Standing[],
  results: Map<string, [number, number]>,
  rnd: () => number,
): Standing[] {
  const h2hPts = (a: string, b: string): number => {
    const key = `${a}|${b}`;
    const rev = `${b}|${a}`;
    let scored: [number, number] | undefined = results.get(key);
    let mine: number | undefined;
    let theirs: number | undefined;
    if (scored) [mine, theirs] = scored;
    else if ((scored = results.get(rev))) [theirs, mine] = scored;
    if (mine === undefined || theirs === undefined) return 0;
    return mine > theirs ? 3 : mine === theirs ? 1 : 0;
  };
  return [...rows].sort((x, y) => {
    if (y.pts !== x.pts) return y.pts - x.pts;
    const gdX = x.gf - x.ga;
    const gdY = y.gf - y.ga;
    if (gdY !== gdX) return gdY - gdX;
    if (y.gf !== x.gf) return y.gf - x.gf;
    const h = h2hPts(y.team, x.team) - h2hPts(x.team, y.team);
    if (h !== 0) return h;
    return rnd() < 0.5 ? -1 : 1;
  });
}

/** Pick the 8 best thirds, then assign them to slots respecting allowed-group sets (backtracking). */
export function assignThirds(
  thirds: Array<Standing & { group: string }>,
  slots: Array<{ match: number; allowed: string[] }>,
  rnd: () => number,
): Map<number, string> {
  const ranked = rankGroup(thirds, new Map(), rnd) as Array<Standing & { group: string }>;
  const qualified = ranked.slice(0, 8);
  const assignment = new Map<number, string>();
  const used = new Set<number>();
  const solve = (slotIdx: number): boolean => {
    if (slotIdx === slots.length) return true;
    const slot = slots[slotIdx];
    for (let i = 0; i < qualified.length; i++) {
      if (used.has(i)) continue;
      if (!slot.allowed.includes(qualified[i].group)) continue;
      used.add(i);
      assignment.set(slot.match, qualified[i].team);
      if (solve(slotIdx + 1)) return true;
      used.delete(i);
      assignment.delete(slot.match);
    }
    return false;
  };
  if (!solve(0)) {
    // No constraint-satisfying assignment (rare combination) — fall back to
    // rank order ignoring constraints rather than crashing the run.
    slots.forEach((s, i) => assignment.set(s.match, qualified[i].team));
  }
  return assignment;
}

function sampleScore(grid: number[][], rnd: () => number): [number, number] {
  let r = rnd();
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      r -= grid[h][a];
      if (r <= 0) return [h, a];
    }
  }
  return [0, 0];
}

export function simulateTournament(
  input: SimInput,
  runs: number,
  seed = 20260612,
): { teams: Record<string, TeamOdds>; runs: number; seed: number } {
  const rnd = mulberry32(seed);
  const { groups, fixtures, bracket, ratings, params } = input;
  const counters = new Map<string, TeamOdds>();
  for (const teams of Object.values(groups)) {
    for (const t of teams) {
      counters.set(t, {
        advanceGroup: 0, reachR16: 0, reachQF: 0, reachSF: 0, reachFinal: 0, champion: 0,
      });
    }
  }
  const gridCache = new Map<string, number[][]>();
  const gridFor = (home: string, away: string, neutral: boolean): number[][] => {
    const key = `${home}|${away}|${neutral}`;
    let g = gridCache.get(key);
    if (!g) {
      const l = lambdasFromElo(ratings[home], ratings[away], neutral, params);
      g = scoreGrid(l.home, l.away, params.rho);
      gridCache.set(key, g);
    }
    return g;
  };
  // Knockouts treated as neutral-venue (approximation; hosts may get a venue
  // edge in reality — documented on the simulator page).
  const koWin = (a: string, b: string): string => {
    const grid = gridFor(a, b, true);
    const [h, w] = sampleScore(grid, rnd);
    if (h > w) return a;
    if (w > h) return b;
    const tiebreak = 1 / (1 + 10 ** (-(ratings[a] - ratings[b]) / 800));
    return rnd() < tiebreak ? a : b;
  };

  for (let run = 0; run < runs; run++) {
    const firsts = new Map<string, string>();
    const seconds = new Map<string, string>();
    const thirds: Array<Standing & { group: string }> = [];

    for (const [letter, teams] of Object.entries(groups)) {
      const table = new Map<string, Standing>(
        teams.map((t) => [t, { team: t, pts: 0, gf: 0, ga: 0 }]),
      );
      const results = new Map<string, [number, number]>();
      for (const f of fixtures) {
        if (f.group !== letter) continue;
        let hs = f.homeScore;
        let as = f.awayScore;
        if (hs === undefined || as === undefined) {
          [hs, as] = sampleScore(gridFor(f.home, f.away, f.neutral), rnd);
        }
        results.set(`${f.home}|${f.away}`, [hs, as]);
        const H = table.get(f.home)!;
        const A = table.get(f.away)!;
        H.gf += hs; H.ga += as; A.gf += as; A.ga += hs;
        if (hs > as) H.pts += 3;
        else if (hs < as) A.pts += 3;
        else { H.pts += 1; A.pts += 1; }
      }
      const ranked = rankGroup([...table.values()], results, rnd);
      firsts.set(letter, ranked[0].team);
      seconds.set(letter, ranked[1].team);
      thirds.push({ ...ranked[2], group: letter });
      counters.get(ranked[0].team)!.advanceGroup++;
      counters.get(ranked[1].team)!.advanceGroup++;
    }

    const thirdSlots = bracket.roundOf32
      .flatMap((m) =>
        m.away.type === "third"
          ? [{ match: m.match, allowed: (m.away as { allowed: string[] }).allowed }]
          : [],
      );
    const thirdAssign = assignThirds(thirds, thirdSlots, rnd);
    for (const team of thirdAssign.values()) {
      counters.get(team)!.advanceGroup++;
    }

    const resolve = (q: Qualifier, match: number): string => {
      if (q.type === "winner") return firsts.get(q.group)!;
      if (q.type === "runnerup") return seconds.get(q.group)!;
      return thirdAssign.get(match)!;
    };

    const winners = new Map<number, string>();
    const known = input.knownWinners ?? {};
    for (const m of bracket.roundOf32) {
      const w = known[m.match] ?? koWin(resolve(m.home, m.match), resolve(m.away, m.match));
      winners.set(m.match, w);
      counters.get(w)!.reachR16++;
    }
    for (const m of bracket.roundOf16) {
      const w = known[m.match] ?? koWin(winners.get(m.home)!, winners.get(m.away)!);
      winners.set(m.match, w);
      counters.get(w)!.reachQF++;
    }
    for (const m of bracket.quarterFinals) {
      const w = known[m.match] ?? koWin(winners.get(m.home)!, winners.get(m.away)!);
      winners.set(m.match, w);
      counters.get(w)!.reachSF++;
    }
    for (const m of bracket.semiFinals) {
      const w = known[m.match] ?? koWin(winners.get(m.home)!, winners.get(m.away)!);
      winners.set(m.match, w);
      counters.get(w)!.reachFinal++;
    }
    const f = bracket.final;
    const finalist1 = winners.get(f.home)!;
    const finalist2 = winners.get(f.away)!;
    counters.get(known[f.match] ?? koWin(finalist1, finalist2))!.champion++;
  }

  const teams: Record<string, TeamOdds> = {};
  for (const [team, c] of counters) {
    teams[team] = {
      advanceGroup: c.advanceGroup / runs,
      reachR16: c.reachR16 / runs,
      reachQF: c.reachQF / runs,
      reachSF: c.reachSF / runs,
      reachFinal: c.reachFinal / runs,
      champion: c.champion / runs,
    };
  }
  return { teams, runs, seed };
}
