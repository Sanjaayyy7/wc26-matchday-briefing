import { describe, expect, it } from "vitest";
import {
  COMBO_SERIES, ENGINE_VERSION_V2, ENGINE_VERSION_V2_1, MAX_LEGS_PER_SERIES,
  Q_FIRST_HALF, V2_FLOORS, YES_ONLY_SERIES,
  binomRow, candidateLegsV2, comboImpliedProb, halfLattice, jointProbV2, legProbV2,
  legReasoningV2, parseMarketV2, selectSlipV2, seriesOf,
  type CandidateLegV2,
} from "../lib/parlay-v2";
import {
  REASONING_GRAMMAR, jointProb, legProb, legReasoning, parseMarket,
  type CandidateLeg, type KalshiMarket,
} from "../lib/parlay";
import { scoreGrid } from "../lib/poisson-model";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarketV2(mk(t), "FRA", "MAR");

const grid = scoreGrid(1.4, 0.9, -0.05);
const lattice = halfLattice(grid, 0.45);
const ET = 0.62;
const yes2 = (t: string): CandidateLegV2 => ({ market: parseMarketV2(mk(t), "FRA", "MAR")!, side: "yes" });
const no2 = (t: string): CandidateLegV2 => ({ market: parseMarketV2(mk(t), "FRA", "MAR")!, side: "no" });

describe("v2 registry", () => {
  it("pre-registered constants", () => {
    expect(ENGINE_VERSION_V2).toBe("v2-combo");
    expect(Q_FIRST_HALF).toBe(0.45);
    expect(V2_FLOORS).toEqual({ leg: 0.75, joint: 0.6, maxLegs: 4 });
    expect(COMBO_SERIES).toEqual([
      "KXWCGAME","KXWCSPREAD","KXWCTOTAL","KXWCBTTS",
      "KXWC1H","KXWC1HSPREAD","KXWC1HTOTAL","KXWC1HBTTS","KXWCADVANCE",
    ]);
    expect([...YES_ONLY_SERIES].sort()).toEqual(["KXWC1H", "KXWCGAME"]);
  });
});

describe("parseMarketV2", () => {
  it("90-minute series carry window '90' and read (h, a)", () => {
    const g = P("KXWCGAME-26JUL09FRAMAR-FRA");
    expect(g!.kind).toBe("reg");
    if (g!.kind === "reg") {
      expect(g!.window).toBe("90");
      expect(g!.pred({ h1: 0, a1: 0, h: 2, a: 1 })).toBe(true);
      expect(g!.pred({ h1: 2, a1: 0, h: 1, a: 1 })).toBe(false); // h1 must not matter
    }
    const s = P("KXWCSPREAD-26JUL09FRAMAR-MAR2");
    if (s!.kind === "reg") expect(s!.pred({ h1: 0, a1: 0, h: 0, a: 2 })).toBe(true);
    const t = P("KXWCTOTAL-26JUL09FRAMAR-3");
    if (t!.kind === "reg") {
      expect(t!.pred({ h1: 0, a1: 0, h: 2, a: 1 })).toBe(true);
      expect(t!.pred({ h1: 0, a1: 0, h: 1, a: 1 })).toBe(false);
    }
    const b = P("KXWCBTTS-26JUL09FRAMAR-BTTS");
    if (b!.kind === "reg") expect(b!.pred({ h1: 0, a1: 0, h: 1, a: 1 })).toBe(true);
  });

  it("1H series carry window '1h' and read (h1, a1)", () => {
    const g = P("KXWC1H-26JUL09FRAMAR-TIE");
    if (g!.kind === "reg") {
      expect(g!.window).toBe("1h");
      expect(g!.pred({ h1: 1, a1: 1, h: 3, a: 1 })).toBe(true);
      expect(g!.pred({ h1: 1, a1: 0, h: 1, a: 1 })).toBe(false); // FT must not matter
    }
    const sp = P("KXWC1HSPREAD-26JUL09FRAMAR-FRA2");
    if (sp!.kind === "reg") {
      expect(sp!.pred({ h1: 2, a1: 0, h: 2, a: 2 })).toBe(true);
      expect(sp!.pred({ h1: 1, a1: 0, h: 4, a: 0 })).toBe(false);
    }
    const tot = P("KXWC1HTOTAL-26JUL09FRAMAR-2");
    if (tot!.kind === "reg") {
      expect(tot!.pred({ h1: 1, a1: 1, h: 1, a: 1 })).toBe(true);
      expect(tot!.pred({ h1: 1, a1: 0, h: 5, a: 4 })).toBe(false);
    }
    const bt = P("KXWC1HBTTS-26JUL09FRAMAR-BTTS");
    if (bt!.kind === "reg") {
      expect(bt!.pred({ h1: 1, a1: 1, h: 1, a: 1 })).toBe(true);
      expect(bt!.pred({ h1: 0, a1: 1, h: 2, a: 1 })).toBe(false);
    }
  });

  it("ADVANCE parses; combo-ineligible + unknown series return null", () => {
    const adv = P("KXWCADVANCE-26JUL09FRAMAR-FRA");
    expect(adv!.kind).toBe("advance");
    if (adv!.kind === "advance") { expect(adv!.window).toBe("advance"); expect(adv!.advanceSide).toBe("home"); }
    expect(P("KXWCSCORE-26JUL09FRAMAR-FRA2MAR0")).toBeNull();
    expect(P("KXWCTEAMTOTAL-26JUL09FRAMAR-FRA2")).toBeNull();
    expect(P("KXWCGOAL-26JUL09FRAMAR-FRAKMBAPP10-1")).toBeNull();
    expect(P("KXWCCORNERS-26JUL09FRAMAR-9")).toBeNull();
    expect(P("KXWCTCORNERS-26JUL09FRAMAR-FRA6")).toBeNull();
  });
});

describe("candidateLegsV2", () => {
  it("YES-only on 3-way moneylines, YES+NO elsewhere, nulls skipped", () => {
    const markets = [
      mk("KXWCGAME-26JUL09FRAMAR-FRA"),
      mk("KXWC1H-26JUL09FRAMAR-TIE"),
      mk("KXWCTOTAL-26JUL09FRAMAR-4"),
      mk("KXWCSCORE-26JUL09FRAMAR-TIE2"), // ineligible → skipped
    ];
    const legs = candidateLegsV2(markets, "FRA", "MAR");
    const bySide = (t: string) => legs.filter((l: CandidateLegV2) => l.market.ticker === t).map((l) => l.side);
    expect(bySide("KXWCGAME-26JUL09FRAMAR-FRA")).toEqual(["yes"]);
    expect(bySide("KXWC1H-26JUL09FRAMAR-TIE")).toEqual(["yes"]);
    expect(bySide("KXWCTOTAL-26JUL09FRAMAR-4").sort()).toEqual(["no", "yes"]);
    expect(legs).toHaveLength(4);
    expect(seriesOf("KXWC1HTOTAL-26JUL09FRAMAR-2")).toBe("KXWC1HTOTAL");
  });
});

describe("halfLattice", () => {
  it("binomRow: Pascal weights, q edge cases exact", () => {
    expect(binomRow(2, 0.5)).toEqual([0.25, 0.5, 0.25]);
    expect(binomRow(3, 0)).toEqual([1, 0, 0, 0]);
    expect(binomRow(3, 1)).toEqual([0, 0, 0, 1]);
  });

  it("total lattice mass equals total grid mass", () => {
    const latticeMass = lattice.reduce((s, c) => s + c.mass, 0);
    const gridMass = grid.flat().reduce((s, m) => s + m, 0);
    expect(Math.abs(latticeMass - gridMass)).toBeLessThan(1e-12);
  });

  it("marginal over (h1, a1) reproduces each grid cell", () => {
    const marg = new Map<string, number>();
    for (const c of lattice) marg.set(`${c.h}-${c.a}`, (marg.get(`${c.h}-${c.a}`) ?? 0) + c.mass);
    for (let h = 0; h < grid.length; h++)
      for (let a = 0; a < grid.length; a++)
        if (grid[h][a] > 0) expect(Math.abs((marg.get(`${h}-${a}`) ?? 0) - grid[h][a])).toBeLessThan(1e-12);
  });

  it("q=0 puts all 1H mass on 0-0; q=1 makes 1H ≡ FT", () => {
    for (const c of halfLattice(grid, 0)) if (c.mass > 0) { expect(c.h1).toBe(0); expect(c.a1).toBe(0); }
    for (const c of halfLattice(grid, 1)) if (c.mass > 0) { expect(c.h1).toBe(c.h); expect(c.a1).toBe(c.a); }
  });
});

describe("jointProbV2", () => {
  it("90-minute legs price identically to the v1 engine", () => {
    const tickers = ["KXWCGAME-26JUL09FRAMAR-FRA", "KXWCTOTAL-26JUL09FRAMAR-4", "KXWCSPREAD-26JUL09FRAMAR-FRA2", "KXWCBTTS-26JUL09FRAMAR-BTTS"];
    for (const t of tickers) {
      const v1: CandidateLeg = { market: parseMarket(mk(t), "FRA", "MAR")!, side: "no" };
      expect(Math.abs(legProbV2(no2(t), lattice, ET) - legProb(v1, grid, ET))).toBeLessThan(1e-12);
    }
    const v1Joint = jointProb(
      [{ market: parseMarket(mk(tickers[0]), "FRA", "MAR")!, side: "yes" },
       { market: parseMarket(mk(tickers[1]), "FRA", "MAR")!, side: "no" }],
      grid, ET);
    expect(Math.abs(jointProbV2([yes2(tickers[0]), no2(tickers[1])], lattice, ET) - v1Joint)).toBeLessThan(1e-12);
  });

  it("matches brute-force enumeration over the lattice (mixed 1H + FT + ADVANCE)", () => {
    const legs = [yes2("KXWCADVANCE-26JUL09FRAMAR-FRA"), no2("KXWC1HTOTAL-26JUL09FRAMAR-3"), no2("KXWCTOTAL-26JUL09FRAMAR-5")];
    let p = 0;
    for (const c of lattice) {
      let cell = c.mass;
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          if (leg.market.pred(c) !== (leg.side === "yes")) { cell = 0; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (c.h > c.a) { if (!wantsHome) { cell = 0; break; } }
          else if (c.h < c.a) { if (wantsHome) { cell = 0; break; } }
          else { advFactor = wantsHome ? ET : 1 - ET; }
        }
      }
      p += cell * (advFactor !== null && cell > 0 ? advFactor : cell > 0 ? 1 : 0);
    }
    expect(Math.abs(jointProbV2(legs, lattice, ET) - p)).toBeLessThan(1e-12);
  });

  it("hand case: 1H-TIE ∧ FT France on a two-cell grid", () => {
    // grid: P(1,0)=0.6, P(2,0)=0.4 with q=0.5:
    // (1,0): 1H tie needs h1=0 → 0.5; FT France always true → 0.6·0.5 = 0.30
    // (2,0): 1H tie needs h1=0 → 0.25;                       → 0.4·0.25 = 0.10
    const tiny: number[][] = [[0, 0, 0], [0.6, 0, 0], [0.4, 0, 0]];
    const lat = halfLattice(tiny, 0.5);
    const p = jointProbV2([yes2("KXWC1H-26JUL09FRAMAR-TIE"), yes2("KXWCGAME-26JUL09FRAMAR-FRA")], lat, 0.5);
    expect(Math.abs(p - 0.4)).toBeLessThan(1e-12);
  });

  it("cross-half correlation is real: joint ≠ product of marginals", () => {
    const a = yes2("KXWC1HTOTAL-26JUL09FRAMAR-1"); // over 0.5 1H goals
    const b = no2("KXWCTOTAL-26JUL09FRAMAR-3");    // under 2.5 FT goals
    const joint = jointProbV2([a, b], lattice, ET);
    const prod = legProbV2(a, lattice, ET) * legProbV2(b, lattice, ET);
    expect(Math.abs(joint - prod)).toBeGreaterThan(1e-4);
  });
});

describe("selectSlipV2", () => {
  const floors = { leg: 0.75, joint: 0.6, maxLegs: 4 };
  const pool = candidateLegsV2(
    ["KXWCGAME-26JUL09FRAMAR-FRA", "KXWCGAME-26JUL09FRAMAR-TIE",
     "KXWCTOTAL-26JUL09FRAMAR-4", "KXWCTOTAL-26JUL09FRAMAR-5", "KXWCTOTAL-26JUL09FRAMAR-6",
     "KXWCSPREAD-26JUL09FRAMAR-MAR2", "KXWC1HTOTAL-26JUL09FRAMAR-3", "KXWC1HSPREAD-26JUL09FRAMAR-MAR2",
     "KXWC1H-26JUL09FRAMAR-FRA", "KXWCADVANCE-26JUL09FRAMAR-FRA"].map((t) => mk(t)),
    "FRA", "MAR");

  it("emits a deterministic 2-4 leg slip meeting every floor", () => {
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    expect(sel.legs.length).toBeGreaterThanOrEqual(2);
    expect(sel.legs.length).toBeLessThanOrEqual(4);
    expect(sel.jointProb).toBeGreaterThanOrEqual(0.6);
    for (const leg of sel.legs) expect(legProbV2(leg, lattice, ET)).toBeGreaterThanOrEqual(0.75);
    const again = selectSlipV2(pool, lattice, ET, floors);
    expect(again).toEqual(sel); // determinism
  });

  it("respects maxLegs from floors", () => {
    const sel = selectSlipV2(pool, lattice, ET, { ...floors, maxLegs: 2 });
    if (sel.verdict === "slip") expect(sel.legs.length).toBe(2);
  });

  it("no-slip when floors unreachable, with the registered v2 reason", () => {
    const sel = selectSlipV2(pool, lattice, ET, { leg: 0.999, joint: 0.99, maxLegs: 4 });
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" });
  });

  it("never selects a NO side of a YES-only series (enforced upstream)", () => {
    const sel = selectSlipV2(pool, lattice, ET, floors);
    if (sel.verdict !== "slip") return;
    for (const leg of sel.legs) {
      if (YES_ONLY_SERIES.has(seriesOf(leg.market.ticker))) expect(leg.side).toBe("yes");
    }
  });

  it("redundancy cap rejects an implied leg", () => {
    // Synthetic deep-tail CROSS-series pair (same-series pairs are excluded by
    // the v2.1 uniqueness rule before the cap is consulted): NO 'FT over 8.5'
    // (-9) is near-certain given the seed NO '1H over 7.5' (-8) — conditional
    // P(total≤8 | 1H total≤7) ≈ 0.9998 > 0.97. (Kalshi lists totals only up to
    // -6, but the parser accepts any digit; this is a pure-engine test.)
    const tight = candidateLegsV2(
      ["KXWC1HTOTAL-26JUL09FRAMAR-8", "KXWCTOTAL-26JUL09FRAMAR-9"].map((t) => mk(t)), "FRA", "MAR");
    const sel = selectSlipV2(tight, lattice, ET, { leg: 0.5, joint: 0.3, maxLegs: 4 });
    // both NO legs clear the leg floor, but the second is implied → single leg → no-slip
    expect(sel.verdict).toBe("no-slip");
  });
});

describe("series uniqueness (v2.1)", () => {
  const floors = { leg: 0.75, joint: 0.6, maxLegs: 4 };

  it("pre-registered v2.1 constants", () => {
    expect(ENGINE_VERSION_V2_1).toBe("v2.1-combo");
    expect(MAX_LEGS_PER_SERIES).toBe(1);
  });

  it("never selects two legs from the same series", () => {
    // Kalshi combo rule: per-event size_max=1 (collections API, 2026-07-09).
    const pool = candidateLegsV2(
      ["KXWCGAME-26JUL09FRAMAR-FRA", "KXWCGAME-26JUL09FRAMAR-TIE",
       "KXWCTOTAL-26JUL09FRAMAR-4", "KXWCTOTAL-26JUL09FRAMAR-5", "KXWCTOTAL-26JUL09FRAMAR-6",
       "KXWCSPREAD-26JUL09FRAMAR-MAR2", "KXWC1HTOTAL-26JUL09FRAMAR-3", "KXWC1HSPREAD-26JUL09FRAMAR-MAR2",
       "KXWC1H-26JUL09FRAMAR-FRA", "KXWCADVANCE-26JUL09FRAMAR-FRA"].map((t) => mk(t)),
      "FRA", "MAR");
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    const series = sel.legs.map((l) => seriesOf(l.market.ticker));
    expect(new Set(series).size).toBe(series.length);
  });

  it("picks the next-best cross-series leg over a higher-conditional same-series leg", () => {
    const pool = candidateLegsV2(
      ["KXWCTOTAL-26JUL09FRAMAR-5", "KXWCTOTAL-26JUL09FRAMAR-6",
       "KXWCSPREAD-26JUL09FRAMAR-MAR2"].map((t) => mk(t)), "FRA", "MAR");
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    const series = sel.legs.map((l) => seriesOf(l.market.ticker));
    expect(series.filter((s) => s === "KXWCTOTAL").length).toBe(1);
    expect(series).toContain("KXWCSPREAD");
  });

  it("allows FT total and 1H total together — separate series per Kalshi", () => {
    const pool = candidateLegsV2(
      ["KXWCTOTAL-26JUL09FRAMAR-5", "KXWC1HTOTAL-26JUL09FRAMAR-3"].map((t) => mk(t)), "FRA", "MAR");
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    expect(sel.legs.map((l) => seriesOf(l.market.ticker)).sort())
      .toEqual(["KXWC1HTOTAL", "KXWCTOTAL"]);
  });

  it("no-slip when only one series clears the leg floor", () => {
    // Two totals both clear 0.75 and would satisfy the old cap (conditional
    // ≈ 0.94 < 0.97) — uniqueness leaves a single leg → no slip.
    const pool = candidateLegsV2(
      ["KXWCTOTAL-26JUL09FRAMAR-5", "KXWCTOTAL-26JUL09FRAMAR-6"].map((t) => mk(t)), "FRA", "MAR");
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" });
  });
});

describe("legReasoningV2", () => {
  const ctx = { eloDiff: 187, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("matches the v1 grammar for 1H, FT and ADVANCE legs", () => {
    for (const leg of [no2("KXWC1HTOTAL-26JUL09FRAMAR-3"), yes2("KXWCGAME-26JUL09FRAMAR-FRA"), yes2("KXWCADVANCE-26JUL09FRAMAR-FRA")]) {
      expect(legReasoningV2(leg, lattice, ET, ctx)).toMatch(REASONING_GRAMMAR);
    }
  });

  it("byte-identical to v1 reasoning for a pure 90-minute leg", () => {
    const t = "KXWCTOTAL-26JUL09FRAMAR-5";
    const v1 = legReasoning({ market: parseMarket(mk(t), "FRA", "MAR")!, side: "no" }, grid, ET, ctx);
    expect(legReasoningV2(no2(t), lattice, ET, ctx)).toBe(v1);
  });

  it("null mid renders 'Kalshi n/a'", () => {
    const m: KalshiMarket = { ticker: "KXWC1HBTTS-26JUL09FRAMAR-BTTS", title: "t", yesMid: null };
    const leg: CandidateLegV2 = { market: parseMarketV2(m, "FRA", "MAR")!, side: "no" };
    expect(legReasoningV2(leg, lattice, ET, ctx)).toContain("Kalshi n/a.");
  });
});

describe("comboImpliedProb", () => {
  it("product of mids; null-propagating", () => {
    expect(comboImpliedProb([0.5, 0.8])).toBeCloseTo(0.4, 12);
    expect(comboImpliedProb([0.5, null, 0.8])).toBeNull();
  });
});
