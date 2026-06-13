// The accountability ledger: predictions are locked before kickoff and never
// modified afterwards; settling only ever ADDS result fields. No retroactive
// predictions, ever.
import { brier, rps, type Outcome, type Split } from "./calibration";
import { summarizeGrid, topKScorelines } from "./poisson-model";

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
  /** Log-loss: −ln(p_realized/100); clamped so p ≥ 1e-9. */
  logLoss?: number;
  /** True when the locked mostLikely scoreline exactly equals the actual result. */
  scorelineHit?: boolean;
  // Legacy market fields (kept for backwards compat and existing tests/UI):
  marketBrier?: number;
  marketRps?: number;
  // Grid-derived fields (derivedPostHoc: true because grid is recomputed post-match):
  top3ScorelineHit?: boolean;
  btts?: { prob: number; actual: boolean; brier: number; derivedPostHoc: true };
  ou25?: { prob: number; actual: boolean; brier: number; derivedPostHoc: true };
  // Market comparison (populated from injected data):
  markets?: {
    kalshi?: { probs: Split; brier: number; rps: number };
    polymarket?: { probs: Split; brier?: number; rps?: number };
  };
  /** Cross-check: which outcome each market resolved to, vs our model outcome. */
  resolutionCheck?: {
    kalshi?: Outcome;
    polymarket?: Outcome;
    agreesWithResult: boolean;
  };
};

/** Polymarket entry shape (subset of what fetch-polymarket.mts stores). */
type PolymarketEntry = {
  probs: { home: number; draw: number; away: number };
  resolved: { home: number; draw: number; away: number } | null;
};

/** Kalshi resolution entry shape (subset of kalshi-resolutions.json). */
type KalshiResolutionEntry = {
  resolved: { home: number; draw: number; away: number };
};

export type SettleOptions = {
  /** Callback that returns a grid for a slug, or undefined if not available. */
  gridForSlug?: (slug: string) => number[][] | undefined;
  /** Polymarket data keyed by slug (from data/markets/polymarket.json). */
  polymarketData?: Record<string, PolymarketEntry>;
  /** Kalshi resolution data keyed by slug (from data/markets/kalshi-resolutions.json). */
  kalshiResolutions?: Record<string, KalshiResolutionEntry>;
};

/** Map a {home, draw, away} resolution object to an Outcome, or undefined if none resolved. */
function resolvedToOutcome(
  r: { home: number; draw: number; away: number } | null | undefined,
): Outcome | undefined {
  if (!r) return undefined;
  if (r.home === 1) return "home";
  if (r.draw === 1) return "draw";
  if (r.away === 1) return "away";
  return undefined;
}

/** True when all three probabilities are below the degenerate threshold (0.95).
 *  Post-settlement Polymarket prices collapse to ~0.999/0.001/0.001, which are
 *  NOT valid pre-kickoff forecasts and must not be scored. */
function isNonDegenerate(probs: { home: number; draw: number; away: number }): boolean {
  return probs.home < 0.95 && probs.draw < 0.95 && probs.away < 0.95;
}

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
  options: SettleOptions = {},
): LockedEntry[] {
  const { gridForSlug, polymarketData, kalshiResolutions } = options;

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

    // --- Base settlement fields ---
    const settled: LockedEntry = {
      ...e,
      result: `${h}-${a}`,
      realized,
      correctPick: top === realized,
      modelBrier: brier(e.split, realized),
      modelRps: rps(e.split, realized),
    };

    // --- logLoss ---
    const pRealized = Math.max(e.split[realized] / 100, 1e-9);
    settled.logLoss = -Math.log(pRealized);

    // --- scorelineHit (no grid needed) ---
    settled.scorelineHit = e.mostLikely.home === h && e.mostLikely.away === a;

    // --- Legacy market fields (preserved for backwards compat) ---
    if (e.market) {
      const marketPct: Split = {
        home: e.market.home * 100,
        draw: e.market.draw * 100,
        away: e.market.away * 100,
      };
      settled.marketBrier = brier(marketPct, realized);
      settled.marketRps = rps(marketPct, realized);

      // Also populate markets.kalshi
      settled.markets = {
        ...settled.markets,
        kalshi: {
          probs: e.market,
          brier: settled.marketBrier,
          rps: settled.marketRps,
        },
      };
    }

    // --- Grid-derived fields (post-hoc, optional) ---
    const grid = gridForSlug?.(e.slug);
    if (grid) {
      const summary = summarizeGrid(grid);
      const top3 = topKScorelines(grid, 3);

      settled.top3ScorelineHit = top3.some((s) => s.home === h && s.away === a);

      const bttsProbVal = summary.btts;
      const bttsActual = h > 0 && a > 0;
      settled.btts = {
        prob: bttsProbVal,
        actual: bttsActual,
        brier: (bttsProbVal - (bttsActual ? 1 : 0)) ** 2,
        derivedPostHoc: true,
      };

      const ou25ProbVal = summary.over25;
      const ou25Actual = h + a > 2.5;
      settled.ou25 = {
        prob: ou25ProbVal,
        actual: ou25Actual,
        brier: (ou25ProbVal - (ou25Actual ? 1 : 0)) ** 2,
        derivedPostHoc: true,
      };
    }

    // --- Polymarket comparison ---
    const pm = polymarketData?.[e.slug];
    if (pm) {
      const pmProbs: Split = pm.probs as Split;
      if (isNonDegenerate(pmProbs)) {
        // Genuine pre-kickoff snapshot: compute brier and rps
        const pmPct: Split = {
          home: pmProbs.home * 100,
          draw: pmProbs.draw * 100,
          away: pmProbs.away * 100,
        };
        settled.markets = {
          ...settled.markets,
          polymarket: {
            probs: pmProbs,
            brier: brier(pmPct, realized),
            rps: rps(pmPct, realized),
          },
        };
      } else {
        // Degenerate post-settlement prices — record probs only, omit brier/rps
        settled.markets = {
          ...settled.markets,
          polymarket: {
            probs: pmProbs,
            // brier and rps intentionally omitted (degenerate post-settlement price)
          },
        };
      }
    }

    // --- Resolution cross-check ---
    const kalshiOutcome = resolvedToOutcome(kalshiResolutions?.[e.slug]?.resolved);
    const polymarketOutcome = resolvedToOutcome(pm?.resolved);

    if (kalshiOutcome !== undefined || polymarketOutcome !== undefined) {
      // agreesWithResult: every market that resolved agrees with the model outcome
      const marketOutcomes = [kalshiOutcome, polymarketOutcome].filter(
        (o): o is Outcome => o !== undefined,
      );
      const allAgree = marketOutcomes.every((o) => o === realized);
      settled.resolutionCheck = {
        ...(kalshiOutcome !== undefined ? { kalshi: kalshiOutcome } : {}),
        ...(polymarketOutcome !== undefined ? { polymarket: polymarketOutcome } : {}),
        agreesWithResult: allAgree,
      };
    }

    return settled;
  });
}
