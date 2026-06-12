// World Football Elo (eloratings.net method): tournament-weighted K,
// goal-margin multiplier, +100 home-advantage offset for non-neutral venues.

export const HOME_ADVANTAGE = 100;

export function expectedScore(rating: number, opponent: number): number {
  return 1 / (1 + 10 ** ((opponent - rating) / 400));
}

const K_BY_CLASS: Array<[RegExp, number]> = [
  [/^FIFA World Cup$/i, 60],
  [/qualification|UEFA Euro|Copa Am|AFC Asian Cup|African Cup|Africa Cup|CONCACAF|Gold Cup|UEFA Nations League/i, 40],
  [/friendly/i, 20],
];

export function kFactor(tournament: string): number {
  for (const [re, k] of K_BY_CLASS) {
    if (re.test(tournament)) return k;
  }
  return 30;
}

export function marginMultiplier(goalDiff: number): number {
  const d = Math.abs(goalDiff);
  if (d <= 1) return 1;
  if (d === 2) return 1.5;
  return (11 + d) / 8;
}

export function updateElo(match: {
  home: number;
  away: number;
  homeScore: number;
  awayScore: number;
  tournament: string;
  neutral: boolean;
}): { home: number; away: number } {
  const { home, away, homeScore, awayScore, tournament, neutral } = match;
  const diff = homeScore - awayScore;
  const result = diff > 0 ? 1 : diff < 0 ? 0 : 0.5;
  const effectiveHome = home + (neutral ? 0 : HOME_ADVANTAGE);
  const expected = expectedScore(effectiveHome, away);
  const delta =
    kFactor(tournament) * marginMultiplier(diff) * (result - expected);
  return { home: home + delta, away: away - delta };
}
