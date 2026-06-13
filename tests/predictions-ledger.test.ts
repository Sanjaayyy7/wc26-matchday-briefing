import { describe, it, expect } from "vitest";
import { lockNew, settle, type LockedEntry } from "@/lib/predictions-ledger";
import { scoreGrid, DEFAULT_PARAMS } from "@/lib/poisson-model";

const split = { home: 50, draw: 30, away: 20 };

describe("lockNew", () => {
  const fixtures = [
    { slug: "a-vs-b", kickoffISO: "2026-06-20T18:00:00Z" },
    { slug: "c-vs-d", kickoffISO: "2026-06-10T18:00:00Z" }, // already kicked off
  ];
  const predictFn = () => ({ split, mostLikely: { home: 1, away: 0 } });

  it("locks only future, not-yet-locked fixtures", () => {
    const out = lockNew([], fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    expect(out.map((e) => e.slug)).toEqual(["a-vs-b"]);
    expect(out[0].split).toEqual(split);
    expect(out[0].lockedAt).toBe("2026-06-12T00:00:00.000Z");
  });

  it("NEVER mutates an existing lock (immutability is the integrity core)", () => {
    const existing: LockedEntry[] = [
      {
        slug: "a-vs-b",
        lockedAt: "2026-06-11T00:00:00.000Z",
        split: { home: 99, draw: 1, away: 0 },
        mostLikely: { home: 9, away: 0 },
      },
    ];
    const out = lockNew(existing, fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    const entry = out.find((e) => e.slug === "a-vs-b")!;
    expect(entry.split.home).toBe(99);
    expect(entry.lockedAt).toBe("2026-06-11T00:00:00.000Z");
  });

  it("never creates a lock for an already-started fixture (no retroactive predictions)", () => {
    const out = lockNew([], fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    expect(out.find((e) => e.slug === "c-vs-d")).toBeUndefined();
  });
});

describe("settle", () => {
  const locked: LockedEntry[] = [
    {
      slug: "a-vs-b",
      lockedAt: "2026-06-11T00:00:00.000Z",
      split,
      mostLikely: { home: 1, away: 0 },
      market: { home: 0.6, draw: 0.25, away: 0.15 },
    },
  ];

  it("computes outcome, correctness, Brier and RPS for model and market", () => {
    const out = settle(locked, [
      { slug: "a-vs-b", homeScore: 2, awayScore: 1 },
    ]);
    const e = out[0];
    expect(e.result).toBe("2-1");
    expect(e.realized).toBe("home");
    expect(e.correctPick).toBe(true); // top of split was home at 50
    // Brier: (0.5-1)^2+(0.3)^2+(0.2)^2 = 0.25+0.09+0.04 = 0.38
    expect(e.modelBrier).toBeCloseTo(0.38, 10);
    // RPS: cum (0.5-1)^2 + (0.8-1)^2 over 2 = (0.25+0.04)/2
    expect(e.modelRps).toBeCloseTo(0.145, 10);
    expect(e.marketBrier).toBeCloseTo(0.4 ** 2 + 0.25 ** 2 + 0.15 ** 2, 10);
  });

  it("leaves unsettled entries untouched and is idempotent", () => {
    const once = settle(locked, [{ slug: "a-vs-b", homeScore: 2, awayScore: 1 }]);
    const twice = settle(once, [{ slug: "a-vs-b", homeScore: 2, awayScore: 1 }]);
    expect(twice).toEqual(once);
    const none = settle(locked, [{ slug: "a-vs-b" }]);
    expect(none[0].result).toBeUndefined();
  });
});

describe("settle — per-match grading extensions", () => {
  // A real-ish grid: 1.5 home, 1.2 away lambdas.
  // Result: 2-1 (home wins, both teams scored, total 3 > 2.5)
  const realGrid = scoreGrid(1.5, 1.2, DEFAULT_PARAMS.rho);

  // Entry whose mostLikely won't exactly be 2-1 (likely 1-1 or 1-0)
  const lockedEntry: LockedEntry = {
    slug: "x-vs-y",
    lockedAt: "2026-06-11T00:00:00.000Z",
    split: { home: 50, draw: 30, away: 20 },
    mostLikely: { home: 1, away: 1 }, // NOT 2-1, so scorelineHit=false
  };

  const gridForSlug = (slug: string) => (slug === "x-vs-y" ? realGrid : undefined);

  it("computes logLoss correctly (−ln(p_home/100) for realized=home)", () => {
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    const e = out[0];
    // split.home = 50 → p = 50/100 = 0.5; logLoss = -ln(0.5)
    expect(e.logLoss).toBeCloseTo(-Math.log(0.5), 10);
  });

  it("clamps logLoss when probability is zero (avoids -Infinity)", () => {
    const zeroProb: LockedEntry = {
      ...lockedEntry,
      slug: "x-vs-y",
      split: { home: 0, draw: 50, away: 50 }, // home=0, realized=home → clamp to 1e-9
    };
    const out = settle([zeroProb], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    expect(out[0].logLoss).toBeCloseTo(-Math.log(1e-9), 2);
  });

  it("scorelineHit is false when mostLikely != realized score", () => {
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    // mostLikely is {home:1,away:1}, realized is 2-1 → false
    expect(out[0].scorelineHit).toBe(false);
  });

  it("scorelineHit is true when mostLikely exactly matches", () => {
    const exact: LockedEntry = { ...lockedEntry, mostLikely: { home: 2, away: 1 } };
    const out = settle([exact], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    expect(out[0].scorelineHit).toBe(true);
  });

  it("computes btts and ou25 from the grid with derivedPostHoc flag", () => {
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    const e = out[0];

    // 2-1: both teams scored → btts.actual = true; total 3 goals > 2.5 → ou25.actual = true
    expect(e.btts).toBeDefined();
    expect(e.btts!.actual).toBe(true);
    expect(e.btts!.derivedPostHoc).toBe(true);
    expect(e.btts!.prob).toBeGreaterThan(0);
    expect(e.btts!.prob).toBeLessThan(1);
    // Brier = (prob - actual)^2 with actual=1
    expect(e.btts!.brier).toBeCloseTo((e.btts!.prob - 1) ** 2, 10);

    expect(e.ou25).toBeDefined();
    expect(e.ou25!.actual).toBe(true);
    expect(e.ou25!.derivedPostHoc).toBe(true);
    expect(e.ou25!.brier).toBeCloseTo((e.ou25!.prob - 1) ** 2, 10);
  });

  it("top3ScorelineHit is true when realized score is among top-3", () => {
    // For lambdas 1.5/1.2, the top scorelines will include common scores like 1-1, 1-0, 2-1
    // We'll settle with a score that's very likely to be top-3
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 1, awayScore: 1 }], { gridForSlug });
    // 1-1 is almost certainly in top 3 for these lambdas
    expect(out[0].top3ScorelineHit).toBe(true);
  });

  it("omits grid-derived fields when gridForSlug returns undefined", () => {
    const noGrid = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], {
      gridForSlug: () => undefined,
    });
    const e = noGrid[0];
    expect(e.btts).toBeUndefined();
    expect(e.ou25).toBeUndefined();
    expect(e.top3ScorelineHit).toBeUndefined();
  });

  it("omits grid-derived fields when no gridForSlug is provided", () => {
    const noGrid = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }]);
    const e = noGrid[0];
    expect(e.btts).toBeUndefined();
    expect(e.ou25).toBeUndefined();
    expect(e.top3ScorelineHit).toBeUndefined();
    // But logLoss and scorelineHit should still be computed (no grid needed)
    expect(e.logLoss).toBeDefined();
    expect(e.scorelineHit).toBeDefined();
  });

  it("populates markets.kalshi when entry has a market field", () => {
    const withMarket: LockedEntry = {
      ...lockedEntry,
      market: { home: 0.6, draw: 0.25, away: 0.15 },
      marketTicker: "KXTEST",
    };
    const out = settle([withMarket], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], { gridForSlug });
    const e = out[0];
    expect(e.markets?.kalshi).toBeDefined();
    expect(e.markets!.kalshi!.probs).toEqual({ home: 0.6, draw: 0.25, away: 0.15 });
    // marketBrier legacy field still present
    expect(e.marketBrier).toBeDefined();
  });

  it("does NOT populate markets.polymarket for degenerate post-settlement probs", () => {
    // Degenerate: home = 0.998 (post-settlement price)
    const polymarketData = { [lockedEntry.slug]: { probs: { home: 0.998, draw: 0.001, away: 0.001 }, resolved: { home: 1, draw: 0, away: 0 } } };
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], {
      gridForSlug,
      polymarketData,
    });
    // Should not include polymarket brier for degenerate prices
    expect(out[0].markets?.polymarket?.brier).toBeUndefined();
  });

  it("populates markets.polymarket.brier for genuine pre-kickoff probs (all < 0.95)", () => {
    const polymarketData = { [lockedEntry.slug]: { probs: { home: 0.5, draw: 0.3, away: 0.2 }, resolved: null } };
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], {
      gridForSlug,
      polymarketData,
    });
    // Realized = home; brier = (0.5-1)^2 + 0.3^2 + 0.2^2 = 0.38
    expect(out[0].markets?.polymarket?.brier).toBeCloseTo(0.38, 10);
  });

  it("populates resolutionCheck from injected kalshiResolutions", () => {
    const kalshiResolutions = {
      "x-vs-y": { resolved: { home: 1, draw: 0, away: 0 } },
    };
    const out = settle([lockedEntry], [{ slug: "x-vs-y", homeScore: 2, awayScore: 1 }], {
      gridForSlug,
      kalshiResolutions,
    });
    const e = out[0];
    expect(e.resolutionCheck?.kalshi).toBe("home");
    expect(e.resolutionCheck?.agreesWithResult).toBe(true);
  });
});
