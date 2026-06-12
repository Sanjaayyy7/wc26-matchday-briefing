import model from "@/data/model.json";
import {
  lambdasFromElo,
  scoreGrid,
  summarizeGrid,
  advancementProb,
  type GridSummary,
  type ModelParams,
} from "./poisson-model";

const ALIASES: Record<string, string> = {
  "Türkiye": "Turkey",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
};

const ratings = model.ratings as Record<string, number>;
const forms = model.forms as Record<
  string,
  { results: string; gf: number; ga: number; lastDate: string }
>;

export function resolveTeamName(appName: string): string {
  const name = ALIASES[appName] ?? appName;
  if (!(name in ratings)) {
    throw new Error(`team not in model: ${appName} (resolved: ${name})`);
  }
  return name;
}

export function roundTo100(probs: number[]): number[] {
  const scaled = probs.map((p) => p * 100);
  const floors = scaled.map(Math.floor);
  let remainder = 100 - floors.reduce((a, b) => a + b, 0);
  const order = scaled
    .map((v, i) => ({ frac: v - floors[i], i }))
    .sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (remainder <= 0) break;
    out[i] += 1;
    remainder -= 1;
  }
  return out;
}

export type Prediction = {
  elo: { home: number; away: number };
  lambdas: { home: number; away: number };
  grid: number[][];
  summary: GridSummary;
  split: { home: number; draw: number; away: number };
  band: string;
  form: {
    home: { results: string; gf: number; ga: number; lastDate: string };
    away: { results: string; gf: number; ga: number; lastDate: string };
  };
  stage: string;
  advancement?: { side: "home" | "away"; prob: number };
  model: { dataThrough: string; backtestBrier: number; matches: number };
};

export function confidenceBand(topPct: number): string {
  if (topPct < 40) return "coin-flip with a slight edge";
  if (topPct <= 55) return "lean";
  if (topPct <= 70) return "fairly confident";
  return "strong";
}

export function predictFixture(args: {
  home: string;
  away: string;
  neutral: boolean;
  stage: string;
}): Prediction {
  const homeName = resolveTeamName(args.home);
  const awayName = resolveTeamName(args.away);
  const eloHome = ratings[homeName];
  const eloAway = ratings[awayName];
  const params = model.params as ModelParams;

  const lambdas = lambdasFromElo(eloHome, eloAway, args.neutral, params);
  const grid = scoreGrid(lambdas.home, lambdas.away, params.rho);
  const summary = summarizeGrid(grid);
  const [home, draw, away] = roundTo100([summary.home, summary.draw, summary.away]);
  const split = { home, draw, away };

  const prediction: Prediction = {
    elo: { home: eloHome, away: eloAway },
    lambdas,
    grid,
    summary,
    split,
    band: confidenceBand(Math.max(home, draw, away)),
    form: { home: forms[homeName], away: forms[awayName] },
    stage: args.stage,
    model: {
      dataThrough: model.dataThrough,
      backtestBrier: model.backtest.brier,
      matches: model.matches,
    },
  };

  if (args.stage !== "group") {
    const eloDiff = eloHome - eloAway;
    const pAdvHome = advancementProb(summary.home, summary.draw, eloDiff);
    prediction.advancement =
      pAdvHome >= 0.5
        ? { side: "home", prob: pAdvHome }
        : { side: "away", prob: 1 - pAdvHome };
  }

  return prediction;
}
