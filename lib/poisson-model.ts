// Goal model: expected goals from Elo difference, scored as a Dixon-Coles
// corrected double Poisson (Dixon & Coles 1997 — the standard low-score
// dependency fix bookmakers use).
import { HOME_ADVANTAGE } from "./elo";

export type ModelParams = {
  /** log of expected goals for a side at zero rating difference */
  baseLogGoals: number;
  /** sensitivity of log-goals to (ownElo - oppElo)/400 */
  eloSlope: number;
  /** Dixon-Coles low-score dependency parameter */
  rho: number;
};

/** Literature-shaped defaults; training refits baseLogGoals and eloSlope.
 *  rho < 0 per empirical Dixon-Coles fits (inflates 0-0/1-1, deflates 1-0/0-1). */
export const DEFAULT_PARAMS: ModelParams = {
  baseLogGoals: Math.log(1.3),
  eloSlope: 0.9,
  rho: -0.06,
};

export const GRID_SIZE = 9;

export function lambdasFromElo(
  homeElo: number,
  awayElo: number,
  neutral: boolean,
  params: ModelParams,
): { home: number; away: number } {
  const effHome = homeElo + (neutral ? 0 : HOME_ADVANTAGE);
  const diff = (effHome - awayElo) / 400;
  return {
    home: Math.exp(params.baseLogGoals + params.eloSlope * diff),
    away: Math.exp(params.baseLogGoals - params.eloSlope * diff),
  };
}

function poisson(lambda: number, k: number): number {
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function tau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

/** GRID_SIZE×GRID_SIZE matrix of P(home=h, away=a), normalized to 1. */
export function scoreGrid(
  lambdaHome: number,
  lambdaAway: number,
  rho: number,
): number[][] {
  const grid: number[][] = [];
  let sum = 0;
  for (let h = 0; h < GRID_SIZE; h++) {
    const row: number[] = [];
    for (let a = 0; a < GRID_SIZE; a++) {
      const p =
        poisson(lambdaHome, h) *
        poisson(lambdaAway, a) *
        tau(h, a, lambdaHome, lambdaAway, rho);
      row.push(Math.max(p, 0));
      sum += Math.max(p, 0);
    }
    grid.push(row);
  }
  return grid.map((row) => row.map((p) => p / sum));
}

export type GridSummary = {
  home: number;
  draw: number;
  away: number;
  btts: number;
  over25: number;
  cleanSheetHome: number;
  cleanSheetAway: number;
  mostLikely: { home: number; away: number };
};

export function summarizeGrid(grid: number[][]): GridSummary {
  let home = 0;
  let draw = 0;
  let away = 0;
  let over25 = 0;
  let best = { home: 0, away: 0, p: -1 };
  grid.forEach((row, h) =>
    row.forEach((p, a) => {
      if (h > a) home += p;
      else if (h === a) draw += p;
      else away += p;
      if (h + a > 2.5) over25 += p;
      if (p > best.p) best = { home: h, away: a, p };
    }),
  );
  const pHomeZero = grid[0].reduce((acc, p) => acc + p, 0);
  const pAwayZero = grid.reduce((acc, row) => acc + row[0], 0);
  return {
    home,
    draw,
    away,
    btts: 1 - pHomeZero - pAwayZero + grid[0][0],
    over25,
    cleanSheetHome: pAwayZero,
    cleanSheetAway: pHomeZero,
    mostLikely: { home: best.home, away: best.away },
  };
}

/**
 * Knockout advancement: 90-minute win plus the drawn share resolved by
 * extra time / penalties, approximated as a gentler logistic of the Elo gap
 * (pens compress skill differences toward a coin flip).
 */
export function advancementProb(
  pWin: number,
  pDraw: number,
  eloDiff: number,
): number {
  const tiebreakWin = 1 / (1 + 10 ** (-eloDiff / 800));
  return pWin + pDraw * tiebreakWin;
}
