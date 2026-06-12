// The accountability ledger: predictions are locked before kickoff and never
// modified afterwards; settling only ever ADDS result fields. No retroactive
// predictions, ever.
import { brier, rps, type Outcome, type Split } from "./calibration";

export type LockedEntry = {
  slug: string;
  lockedAt: string;
  split: Split;
  mostLikely: { home: number; away: number };
  /** De-vigged Kalshi probabilities (0..1) captured at lock time, if a market existed. */
  market?: Split;
  marketTicker?: string;
  // Settlement fields (added once, when the result lands):
  result?: string;
  realized?: Outcome;
  correctPick?: boolean;
  modelBrier?: number;
  modelRps?: number;
  marketBrier?: number;
  marketRps?: number;
};

export function lockNew(
  existing: LockedEntry[],
  fixtures: Array<{ slug: string; kickoffISO: string }>,
  predictFn: (slug: string) => {
    split: Split;
    mostLikely: { home: number; away: number };
    market?: Split;
    marketTicker?: string;
  },
  now: Date,
): LockedEntry[] {
  const locked = new Set(existing.map((e) => e.slug));
  const added: LockedEntry[] = [];
  for (const f of fixtures) {
    if (locked.has(f.slug)) continue;
    if (new Date(f.kickoffISO).getTime() <= now.getTime()) continue;
    const p = predictFn(f.slug);
    added.push({
      slug: f.slug,
      lockedAt: now.toISOString(),
      split: p.split,
      mostLikely: p.mostLikely,
      ...(p.market ? { market: p.market, marketTicker: p.marketTicker } : {}),
    });
  }
  return [...existing, ...added];
}

export function settle(
  entries: LockedEntry[],
  fixtures: Array<{ slug: string; homeScore?: number; awayScore?: number }>,
): LockedEntry[] {
  const scores = new Map(
    fixtures
      .filter((f) => f.homeScore !== undefined && f.awayScore !== undefined)
      .map((f) => [f.slug, [f.homeScore!, f.awayScore!] as const]),
  );
  return entries.map((e) => {
    if (e.result !== undefined) return e;
    const score = scores.get(e.slug);
    if (!score) return e;
    const [h, a] = score;
    const realized: Outcome = h > a ? "home" : h < a ? "away" : "draw";
    const top = (Object.entries(e.split) as Array<[Outcome, number]>).reduce(
      (best, cur) => (cur[1] > best[1] ? cur : best),
    )[0];
    const settled: LockedEntry = {
      ...e,
      result: `${h}-${a}`,
      realized,
      correctPick: top === realized,
      modelBrier: brier(e.split, realized),
      modelRps: rps(e.split, realized),
    };
    if (e.market) {
      const marketPct: Split = {
        home: e.market.home * 100,
        draw: e.market.draw * 100,
        away: e.market.away * 100,
      };
      settled.marketBrier = brier(marketPct, realized);
      settled.marketRps = rps(marketPct, realized);
    }
    return settled;
  });
}
