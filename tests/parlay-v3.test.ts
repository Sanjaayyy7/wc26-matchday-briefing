import { describe, expect, it } from "vitest";
import {
  COMBO_SERIES_V3, ENGINE_VERSION_V3, V3_CONSTRAINTS, YES_ONLY_SERIES_V3,
  candidateLegsV3, comboImpliedV3, jointProbV3, legProbV3, legReasoningV3,
  parseMarketV3, scorerTailProb, selectSlipV3,
  type CandidateLegV3, type PlayerShare,
} from "../lib/parlay-v3";
import { REDUNDANCY_CAP, type KalshiMarket } from "../lib/parlay";
import { Q_FIRST_HALF, halfLattice, seriesOf } from "../lib/parlay-v2";
import { scoreGrid } from "../lib/poisson-model";

const mk = (ticker: string, yesMid: number | null = 0.5, title = `T ${ticker}`): KalshiMarket =>
  ({ ticker, title, yesMid });

const grid = scoreGrid(1.4, 0.9, -0.05);
const lattice = halfLattice(grid, Q_FIRST_HALF);
const ET = 0.62;
const PLAYERS: PlayerShare[] = [
  { code: "FRAKMBAP10", name: "Kylian Mbappé", teamSide: "home", share: 0.6 },
  { code: "MARZIRAC7", name: "Zakaria El Ouahdi", teamSide: "away", share: 0.3 },
];

describe("v3 registry", () => {
  it("pre-registered constants", () => {
    expect(ENGINE_VERSION_V3).toBe("v3-value");
    expect(V3_CONSTRAINTS).toEqual({
      legMin: 0.5, legMax: 0.9, jointMin: 0.3, jointMax: 0.6,
      maxLegs: 4, minEdge: 0.03, maxLegsPerSeries: 1,
      exclusiveSeries: [["KXWCGAME", "KXWCADVANCE"]],
    });
    expect(COMBO_SERIES_V3).toHaveLength(10);
    expect(COMBO_SERIES_V3).toContain("KXWCGOAL");
    expect([...YES_ONLY_SERIES_V3].sort()).toEqual(["KXWC1H", "KXWCGAME", "KXWCGOAL"]);
  });
});

describe("parseMarketV3", () => {
  it("parses scorer tickers with player code and strike", () => {
    const p = parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-2"), "FRA", "MAR");
    expect(p).toMatchObject({ kind: "scorer", playerCode: "FRAKMBAP10", k: 2 });
  });
  it("rejects malformed scorer tickers, delegates the rest to v2", () => {
    expect(parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-NOSTRIKE"), "FRA", "MAR")).toBeNull();
    expect(parseMarketV3(mk("KXWCTOTAL-26JUL09FRAMAR-4"), "FRA", "MAR")).toMatchObject({ kind: "reg" });
    expect(parseMarketV3(mk("KXWCCORNERS-26JUL09FRAMAR-9"), "FRA", "MAR")).toBeNull();
  });
});

describe("scorerTailProb", () => {
  it("matches hand-computed Binomial tails", () => {
    expect(scorerTailProb(2, 0.5, 1)).toBeCloseTo(0.75, 12);
    expect(scorerTailProb(2, 0.5, 2)).toBeCloseTo(0.25, 12);
    expect(scorerTailProb(3, 0.3, 1)).toBeCloseTo(1 - 0.7 ** 3, 12);
    expect(scorerTailProb(0, 0.9, 1)).toBe(0);
    expect(scorerTailProb(4, 0.5, 0)).toBe(1);
    expect(scorerTailProb(3, 0, 1)).toBe(0);
    expect(scorerTailProb(3, 1, 3)).toBeCloseTo(1, 12);
  });
});

describe("jointProbV3 scorer legs", () => {
  const scorer1: CandidateLegV3 = {
    market: parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1"), "FRA", "MAR")!, side: "yes",
  };
  it("single scorer leg equals the direct lattice thinning sum", () => {
    let expected = 0;
    for (const c of lattice) expected += c.mass * scorerTailProb(c.h, 0.6, 1);
    expect(legProbV3(scorer1, lattice, ET, PLAYERS)).toBeCloseTo(expected, 12);
  });
  it("scorer ∧ total joint is exact on the lattice (not an independence product)", () => {
    const over15: CandidateLegV3 = {
      market: parseMarketV3(mk("KXWCTOTAL-26JUL09FRAMAR-2"), "FRA", "MAR")!, side: "yes",
    };
    let expected = 0;
    for (const c of lattice) {
      if (c.h + c.a >= 2) expected += c.mass * scorerTailProb(c.h, 0.6, 1);
    }
    const joint = jointProbV3([scorer1, over15], lattice, ET, PLAYERS);
    expect(joint).toBeCloseTo(expected, 12);
    const prod = legProbV3(scorer1, lattice, ET, PLAYERS) * legProbV3(over15, lattice, ET, PLAYERS);
    expect(Math.abs(joint - prod)).toBeGreaterThan(1e-3); // positively correlated
  });
  it("throws on a scorer leg without a stored share", () => {
    const ghost: CandidateLegV3 = {
      market: parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-FRAGHOST9-1"), "FRA", "MAR")!, side: "yes",
    };
    expect(() => legProbV3(ghost, lattice, ET, PLAYERS)).toThrow(/FRAGHOST9/);
  });
});

describe("candidateLegsV3", () => {
  it("YES-only on GAME/1H/GOAL; scorer markets need a stored share", () => {
    const markets = [
      mk("KXWCGAME-26JUL09FRAMAR-FRA"),
      mk("KXWCTOTAL-26JUL09FRAMAR-2"),
      mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1"),
      mk("KXWCGOAL-26JUL09FRAMAR-FRAGHOST9-1"), // no share → skipped
    ];
    const legs = candidateLegsV3(markets, "FRA", "MAR", { source: "t", lineupConfirmed: false, players: PLAYERS });
    const keys = legs.map((l) => `${seriesOf(l.market.ticker)}:${l.side}`).sort();
    expect(keys).toEqual([
      "KXWCGAME:yes", "KXWCGOAL:yes", "KXWCTOTAL:no", "KXWCTOTAL:yes",
    ]);
  });
  it("null playerModel drops all scorer candidates", () => {
    const legs = candidateLegsV3([mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1")], "FRA", "MAR", null);
    expect(legs).toEqual([]);
  });
});

describe("comboImpliedV3", () => {
  it("side-adjusts mids and nulls out on a missing mid", () => {
    const yes: CandidateLegV3 = { market: parseMarketV3(mk("KXWCTOTAL-26JUL09FRAMAR-2", 0.7), "FRA", "MAR")!, side: "yes" };
    const no: CandidateLegV3 = { market: parseMarketV3(mk("KXWCTOTAL-26JUL09FRAMAR-4", 0.2), "FRA", "MAR")!, side: "no" };
    expect(comboImpliedV3([yes, no])).toBeCloseTo(0.7 * 0.8, 12);
    const noMid: CandidateLegV3 = { market: parseMarketV3(mk("KXWCBTTS-26JUL09FRAMAR-BTTS", null), "FRA", "MAR")!, side: "yes" };
    expect(comboImpliedV3([yes, noMid])).toBeNull();
  });
});

describe("selectSlipV3", () => {
  // Model probs on this grid: GAME FRA yes ≈ .518, TOTAL-2 yes ≈ .669,
  // TOTAL-3 no ≈ .596, BTTS no ≈ .53, ADVANCE FRA yes ≈ .68, scorer ≈ .55.
  // Mids set cheap so edges are large and positive.
  const MARKETS = [
    mk("KXWCGAME-26JUL09FRAMAR-FRA", 0.45),
    mk("KXWCTOTAL-26JUL09FRAMAR-2", 0.60),
    mk("KXWCTOTAL-26JUL09FRAMAR-3", 0.45),
    mk("KXWCBTTS-26JUL09FRAMAR-BTTS", 0.50),
    mk("KXWCADVANCE-26JUL09FRAMAR-FRA", 0.60),
    mk("KXWCSPREAD-26JUL09FRAMAR-MAR2", 0.06), // NO side ≈ .93 model → outside leg band
    mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1", 0.40),
  ];
  const pm = { source: "t", lineupConfirmed: false, players: PLAYERS };
  const pool = candidateLegsV3(MARKETS, "FRA", "MAR", pm);

  function bruteBest(): { edge: number; joint: number } | null {
    const eligible = pool
      .map((leg) => ({ leg, p: legProbV3(leg, lattice, ET, PLAYERS) }))
      .filter((c) => c.p >= 0.5 && c.p <= 0.9);
    let best: { edge: number; joint: number } | null = null;
    const n = eligible.length;
    const subsets = (idx: number[], from: number): void => {
      if (idx.length >= 2 && idx.length <= 4) {
        const legs = idx.map((i) => eligible[i].leg);
        const series = legs.map((l) => seriesOf(l.market.ticker));
        if (new Set(series).size === series.length &&
            !(series.includes("KXWCGAME") && series.includes("KXWCADVANCE"))) {
          let pairwiseOk = true;
          for (let a = 0; a < legs.length && pairwiseOk; a++) {
            for (let b = a + 1; b < legs.length && pairwiseOk; b++) {
              const pij = jointProbV3([legs[a], legs[b]], lattice, ET, PLAYERS);
              const pa = legProbV3(legs[a], lattice, ET, PLAYERS);
              const pb = legProbV3(legs[b], lattice, ET, PLAYERS);
              if (pij / Math.min(pa, pb) > REDUNDANCY_CAP) pairwiseOk = false;
            }
          }
          if (pairwiseOk) {
            const joint = jointProbV3(legs, lattice, ET, PLAYERS);
            const implied = comboImpliedV3(legs);
            if (joint >= 0.3 && joint <= 0.6 && implied !== null) {
              const edge = joint - implied;
              if (edge >= 0.03 && (best === null || edge > best.edge)) best = { edge, joint };
            }
          }
        }
      }
      if (idx.length === 4) return;
      for (let i = from; i < n; i++) subsets([...idx, i], i + 1);
    };
    subsets([], 0);
    return best;
  }

  it("finds the brute-force max-edge subset, deterministically", () => {
    const sel = selectSlipV3(pool, lattice, ET, PLAYERS, V3_CONSTRAINTS);
    const brute = bruteBest();
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    expect(brute).not.toBeNull();
    expect(sel.edge).toBeCloseTo(brute!.edge, 12);
    expect(sel.jointProb).toBeCloseTo(brute!.joint, 12);
    expect(selectSlipV3(pool, lattice, ET, PLAYERS, V3_CONSTRAINTS)).toEqual(sel);
  });

  it("respects the registered constraints on the winning slip", () => {
    const sel = selectSlipV3(pool, lattice, ET, PLAYERS, V3_CONSTRAINTS);
    if (sel.verdict !== "slip") throw new Error("expected slip");
    expect(sel.legs.length).toBeGreaterThanOrEqual(2);
    expect(sel.legs.length).toBeLessThanOrEqual(4);
    const series = sel.legs.map((l) => seriesOf(l.market.ticker));
    expect(new Set(series).size).toBe(series.length);
    expect(series.includes("KXWCGAME") && series.includes("KXWCADVANCE")).toBe(false);
    for (const leg of sel.legs) {
      const p = legProbV3(leg, lattice, ET, PLAYERS);
      expect(p).toBeGreaterThanOrEqual(0.5);
      expect(p).toBeLessThanOrEqual(0.9);
    }
    expect(sel.jointProb).toBeGreaterThanOrEqual(0.3);
    expect(sel.jointProb).toBeLessThanOrEqual(0.6);
    expect(sel.edge).toBeGreaterThanOrEqual(0.03);
    expect(sel.comboImpliedProb).toBeCloseTo(comboImpliedV3(sel.legs)!, 12);
  });

  it("never pairs regulation ML with To-Advance even when both are eligible", () => {
    const two = candidateLegsV3([
      mk("KXWCGAME-26JUL09FRAMAR-FRA", 0.30),
      mk("KXWCADVANCE-26JUL09FRAMAR-FRA", 0.40),
      mk("KXWCTOTAL-26JUL09FRAMAR-2", 0.55),
    ], "FRA", "MAR", pm);
    const sel = selectSlipV3(two, lattice, ET, PLAYERS, V3_CONSTRAINTS);
    if (sel.verdict !== "slip") throw new Error("expected slip");
    const series = sel.legs.map((l) => seriesOf(l.market.ticker));
    expect(series.includes("KXWCGAME") && series.includes("KXWCADVANCE")).toBe(false);
  });

  it("positively correlated legs create edge against the multiplicative combo price", () => {
    // Kalshi combos price near the product of leg mids; the model joint of
    // correlated legs exceeds that product — the registered value mechanism.
    const fair = MARKETS.map((m) => {
      const parsed = parseMarketV3(m, "FRA", "MAR")!;
      const p = legProbV3({ market: parsed, side: "yes" }, lattice, ET, PLAYERS);
      return { ...m, yesMid: p };
    });
    const sel = selectSlipV3(candidateLegsV3(fair, "FRA", "MAR", pm), lattice, ET, PLAYERS, V3_CONSTRAINTS);
    expect(sel.verdict).toBe("slip"); // every leg fairly priced, edge is pure correlation
    if (sel.verdict === "slip") expect(sel.edge).toBeGreaterThan(0.03);
  });

  it("no-slip when the combo price already reflects the joint (no edge left)", () => {
    // Two YES-only legs → exactly one candidate subset. Price it AT the model
    // joint so edge ≈ 0 < minEdge.
    const gameYes: CandidateLegV3 = { market: parseMarketV3(mk("KXWCGAME-26JUL09FRAMAR-FRA"), "FRA", "MAR")!, side: "yes" };
    const scorerYes: CandidateLegV3 = { market: parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1"), "FRA", "MAR")!, side: "yes" };
    const joint = jointProbV3([gameYes, scorerYes], lattice, ET, PLAYERS);
    const two = candidateLegsV3([
      mk("KXWCGAME-26JUL09FRAMAR-FRA", 0.9),
      mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1", joint / 0.9),
    ], "FRA", "MAR", pm);
    const sel = selectSlipV3(two, lattice, ET, PLAYERS, V3_CONSTRAINTS);
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-4 leg subset ≥ v3 constraints" });
  });
});

describe("legReasoningV3", () => {
  it("scorer reasoning is deterministic and names share + player", () => {
    const leg: CandidateLegV3 = {
      market: parseMarketV3(mk("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1"), "FRA", "MAR")!, side: "yes",
    };
    const ctx = { eloDiff: 187, homeAbbr: "FRA", awayAbbr: "MAR" };
    const r1 = legReasoningV3(leg, lattice, ET, PLAYERS, ctx);
    expect(r1).toBe(legReasoningV3(leg, lattice, ET, PLAYERS, ctx));
    expect(r1).toContain("Kylian Mbappé");
    expect(r1).toContain("60.0%"); // share
    expect(r1).toContain("Binomial thinning");
  });
});
