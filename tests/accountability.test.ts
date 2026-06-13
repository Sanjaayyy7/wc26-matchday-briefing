import { describe, it, expect } from "vitest";
import { buildAccountability, type LockedEntry, type MatchFacts, type KalshiResolution, type PolymarketEntry } from "@/lib/accountability";

// ---------------------------------------------------------------------------
// Hand-computed fixture data
// ---------------------------------------------------------------------------

/** USA-PAR: the one real settled + locked entry */
const usaParEntry: LockedEntry = {
  slug: "united-states-vs-paraguay",
  lockedAt: "2026-06-12T22:50:20.813Z",
  split: { home: 36, draw: 30, away: 34 },
  mostLikely: { home: 1, away: 1 },
  result: "4-1",
  realized: "home",
  correctPick: true,
  modelBrier: 0.6152000000000001,
  modelRps: 0.26260000000000006,
  logLoss: 1.0216512475319814,
  scorelineHit: false,
  top3ScorelineHit: false,
  marketBrier: 0.4189500259894558,
  marketRps: 0.16639439617831242,
  markets: {
    kalshi: {
      probs: { home: 0.472636815920398, draw: 0.2935323383084577, away: 0.2338308457711443 },
      brier: 0.4189500259894558,
      rps: 0.16639439617831242,
    },
    polymarket: {
      probs: { home: 0.9980019980019981, draw: 0.0009990009990009992, away: 0.0009990009990009992 },
    },
  },
  btts: { prob: 0.48140544549154385, actual: true, brier: 0.2689403119658241, derivedPostHoc: true },
  ou25: { prob: 0.4137650028099395, actual: true, brier: 0.3436714719304302, derivedPostHoc: true },
  resolutionCheck: { kalshi: "home", polymarket: "home", agreesWithResult: true },
};

/** Mexico-SA: played before lock window — informational only */
const mexSaFacts: MatchFacts = {
  score: { home: 2, away: 0 },
  btts: false,
  totalGoals: 2,
};

const usaParKalshiRes: KalshiResolution = {
  ticker: "KXWCGAME-26JUN12USAPAR",
  resolved: { home: 1, draw: 0, away: 0 },
  settledTime: "2026-06-13T03:04:24.592403Z",
  _source: "ledger",
};

const mexSaKalshiRes: KalshiResolution = {
  ticker: "KXWCGAME-26JUN11MEXRSA",
  resolved: { home: 1, draw: 0, away: 0 },
  settledTime: "2026-06-11T21:08:07.583473Z",
  _source: "derived",
};

const mexSaPolymarket: PolymarketEntry = {
  probs: { home: 0.9980019980019981, draw: 0.0009990009990009992, away: 0.0009990009990009992 },
  resolved: { home: 1, draw: 0, away: 0 },
};

const usaParPolymarket: PolymarketEntry = {
  probs: { home: 0.9980019980019981, draw: 0.0009990009990009992, away: 0.0009990009990009992 },
  resolved: { home: 1, draw: 0, away: 0 },
};

// ---------------------------------------------------------------------------
// Main buildAccountability tests
// ---------------------------------------------------------------------------

describe("buildAccountability — official locked record", () => {
  const result = buildAccountability(
    { entries: [usaParEntry] },
    { "mexico-vs-south-africa": mexSaFacts },
    { "united-states-vs-paraguay": usaParKalshiRes, "mexico-vs-south-africa": mexSaKalshiRes },
    { "united-states-vs-paraguay": usaParPolymarket, "mexico-vs-south-africa": mexSaPolymarket },
  );

  it("has n=1 in official aggregates", () => {
    expect(result.official.aggregates.n).toBe(1);
  });

  it("official row picks up precomputed modelBrier", () => {
    const row = result.official.rows[0];
    expect(row.slug).toBe("united-states-vs-paraguay");
    expect(row.grades.modelBrier).toBeCloseTo(0.6152, 4);
  });

  it("official row has correct actual score from result field", () => {
    const row = result.official.rows[0];
    expect(row.actual).toBe("4-1");
  });

  it("official aggregate accuracy = 1 (correctPick=true)", () => {
    expect(result.official.aggregates.accuracy).toBeCloseTo(1, 4);
  });

  it("meanBrier equals the single entry's modelBrier", () => {
    expect(result.official.aggregates.meanBrier).toBeCloseTo(0.6152, 4);
  });

  it("vsKalshi.n=1 and modelBrier < marketBrier (model worse, negative edge)", () => {
    const vk = result.official.aggregates.vsKalshi;
    expect(vk.n).toBe(1);
    // edge = marketBrier - modelBrier → should be negative (Kalshi was better)
    expect(vk.edge).toBeCloseTo(0.4189500259894558 - 0.6152000000000001, 4);
  });

  it("vsPolymarket.n=0 (no pre-kickoff PM book for played matches)", () => {
    expect(result.official.aggregates.vsPolymarket.n).toBe(0);
  });
});

describe("buildAccountability — informational rows", () => {
  const result = buildAccountability(
    { entries: [usaParEntry] },
    { "mexico-vs-south-africa": mexSaFacts },
    { "united-states-vs-paraguay": usaParKalshiRes, "mexico-vs-south-africa": mexSaKalshiRes },
    { "united-states-vs-paraguay": usaParPolymarket, "mexico-vs-south-africa": mexSaPolymarket },
  );

  it("informational rows include mexico-vs-south-africa", () => {
    const slugs = result.informational.rows.map((r) => r.slug);
    expect(slugs).toContain("mexico-vs-south-africa");
  });

  it("informational row has no grades (no model prediction)", () => {
    const row = result.informational.rows.find((r) => r.slug === "mexico-vs-south-africa");
    expect(row).toBeDefined();
    const keys = Object.keys(row!);
    expect(keys).not.toContain("grades");
    expect(keys).not.toContain("modelBrier");
    expect(keys).not.toContain("modelRps");
    expect(keys).not.toContain("verdict");
  });

  it("informational row shows the actual score", () => {
    const row = result.informational.rows.find((r) => r.slug === "mexico-vs-south-africa");
    expect(row?.actual).toBe("2-0");
  });

  it("official row is NOT also in informational", () => {
    const slugs = result.informational.rows.map((r) => r.slug);
    expect(slugs).not.toContain("united-states-vs-paraguay");
  });
});

// ---------------------------------------------------------------------------
// Verdict classification
// ---------------------------------------------------------------------------

describe("verdict classification", () => {
  function makeEntry(overrides: Partial<LockedEntry>): LockedEntry {
    return { ...usaParEntry, ...overrides };
  }

  it("verdict=hit when correctPick=true", () => {
    const result = buildAccountability(
      { entries: [makeEntry({ correctPick: true, realized: "home" })] },
      {},
      {},
      {},
    );
    expect(result.official.rows[0].verdict).toBe("hit");
  });

  it("verdict=miss when correctPick=false and scoreline not close and realized is 3rd-most-likely bucket", () => {
    // split: home=10, draw=20, away=70 → most likely: away (70), 2nd: draw (20), 3rd: home (10)
    // realized: home → 3rd bucket and correctPick=false
    const missEntry = makeEntry({
      correctPick: false,
      realized: "home",
      split: { home: 10, draw: 20, away: 70 },
      mostLikely: { home: 0, away: 2 },
      result: "4-1",
    });
    const result = buildAccountability({ entries: [missEntry] }, {}, {}, {});
    expect(result.official.rows[0].verdict).toBe("miss");
  });

  it("verdict=close when correctPick=false but realized is 2nd-most-likely bucket", () => {
    // split: home=10, draw=30, away=60 → 1st: away (60), 2nd: draw (30)
    // realized: draw → correctPick=false but 2nd bucket
    const closeEntry = makeEntry({
      correctPick: false,
      realized: "draw",
      split: { home: 10, draw: 30, away: 60 },
      mostLikely: { home: 0, away: 1 },
      result: "1-1",
    });
    const result = buildAccountability({ entries: [closeEntry] }, {}, {}, {});
    expect(result.official.rows[0].verdict).toBe("close");
  });

  it("verdict=close when scoreline within 1 goal on both components (even if wrong bucket)", () => {
    // split: home=70, draw=20, away=10 → model says home; mostLikely 1-1
    // realized: draw (wrong bucket) with actual score 1-1 and mostLikely 1-1 → scoreline diff 0
    const closeScoreline = makeEntry({
      correctPick: false,
      realized: "draw",
      split: { home: 70, draw: 20, away: 10 },
      mostLikely: { home: 1, away: 1 },
      result: "1-1",
    });
    const result = buildAccountability({ entries: [closeScoreline] }, {}, {}, {});
    expect(result.official.rows[0].verdict).toBe("close");
  });
});

describe("buildAccountability — caveats present", () => {
  const result = buildAccountability(
    { entries: [usaParEntry] },
    {},
    {},
    {},
  );

  it("caveats array is non-empty", () => {
    expect(result.caveats.length).toBeGreaterThan(0);
  });
});
