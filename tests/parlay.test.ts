import { describe, expect, it } from "vitest";
import { parseMarket, type KalshiMarket, jointProb, legProb, type CandidateLeg, JOINT_FLOOR, LEG_FLOOR, MAX_LEGS, REDUNDANCY_CAP, selectSlip, legReasoning, REASONING_GRAMMAR } from "../lib/parlay";
import { scoreGrid } from "../lib/poisson-model";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarket(mk(t), "FRA", "MAR");

const grid = scoreGrid(1.4, 0.9, -0.05);
const yes = (m: ReturnType<typeof parseMarket>): CandidateLeg => ({ market: m!, side: "yes" });
const no = (m: ReturnType<typeof parseMarket>): CandidateLeg => ({ market: m!, side: "no" });
const ET = 0.62;

const bruteJoint = (legs: CandidateLeg[]): number => {
  let p = 0;
  for (let h = 0; h < grid.length; h++)
    for (let a = 0; a < grid.length; a++) {
      let cell = grid[h][a];
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          const pass = leg.market.pred(h, a) === (leg.side === "yes");
          if (!pass) { cell = 0; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (h > a) { if (!wantsHome) { cell = 0; break; } }
          else if (h < a) { if (wantsHome) { cell = 0; break; } }
          else {
            const f = wantsHome ? ET : 1 - ET;
            if (advFactor === null) advFactor = f;
            else if (advFactor !== f) { cell = 0; break; } // contradictory demands
          }
        }
      }
      p += cell * (advFactor ?? 1);
    }
  return p;
};

describe("parseMarket", () => {
  it("GAME: home / away / tie", () => {
    const h = P("KXWCGAME-26JUL09FRAMAR-FRA");
    const a = P("KXWCGAME-26JUL09FRAMAR-MAR");
    const t = P("KXWCGAME-26JUL09FRAMAR-TIE");
    expect(h!.kind).toBe("reg");
    if (h!.kind === "reg") { expect(h!.pred(2, 1)).toBe(true); expect(h!.pred(1, 1)).toBe(false); }
    if (a!.kind === "reg") { expect(a!.pred(0, 1)).toBe(true); expect(a!.pred(1, 0)).toBe(false); }
    if (t!.kind === "reg") { expect(t!.pred(2, 2)).toBe(true); expect(t!.pred(2, 1)).toBe(false); }
  });

  it("SPREAD: team wins by >= digit", () => {
    const s = P("KXWCSPREAD-26JUL09FRAMAR-FRA2");
    if (s!.kind === "reg") {
      expect(s!.pred(2, 0)).toBe(true);
      expect(s!.pred(3, 2)).toBe(false);
      expect(s!.pred(0, 3)).toBe(false);
    }
    const m = P("KXWCSPREAD-26JUL09FRAMAR-MAR2");
    if (m!.kind === "reg") expect(m!.pred(0, 2)).toBe(true);
  });

  it("TOTAL: combined goals >= digit", () => {
    const t = P("KXWCTOTAL-26JUL09FRAMAR-3");
    if (t!.kind === "reg") { expect(t!.pred(2, 1)).toBe(true); expect(t!.pred(2, 0)).toBe(false); }
  });

  it("TEAMTOTAL: team goals >= digit", () => {
    const f = P("KXWCTEAMTOTAL-26JUL09FRAMAR-FRA2");
    if (f!.kind === "reg") { expect(f!.pred(2, 5)).toBe(true); expect(f!.pred(1, 5)).toBe(false); }
    const m = P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR1");
    if (m!.kind === "reg") expect(m!.pred(0, 1)).toBe(true);
  });

  it("BTTS", () => {
    const b = P("KXWCBTTS-26JUL09FRAMAR-BTTS");
    if (b!.kind === "reg") { expect(b!.pred(1, 1)).toBe(true); expect(b!.pred(2, 0)).toBe(false); }
  });

  it("SCORE: exact cell, oriented by abbr", () => {
    const s = P("KXWCSCORE-26JUL09FRAMAR-FRA3MAR0");
    if (s!.kind === "reg") { expect(s!.pred(3, 0)).toBe(true); expect(s!.pred(0, 3)).toBe(false); }
    const r = P("KXWCSCORE-26JUL09FRAMAR-MAR2FRA1"); // away listed first
    if (r!.kind === "reg") { expect(r!.pred(1, 2)).toBe(true); expect(r!.pred(2, 1)).toBe(false); }
    const d = P("KXWCSCORE-26JUL09FRAMAR-TIE1");
    if (d!.kind === "reg") { expect(d!.pred(1, 1)).toBe(true); expect(d!.pred(0, 0)).toBe(false); }
  });

  it("ADVANCE: kind advance with side", () => {
    const h = P("KXWCADVANCE-26JUL09FRAMAR-FRA");
    expect(h).toEqual(expect.objectContaining({ kind: "advance", advanceSide: "home" }));
    const a = P("KXWCADVANCE-26JUL09FRAMAR-MAR");
    expect(a).toEqual(expect.objectContaining({ kind: "advance", advanceSide: "away" }));
  });

  it("returns null for unpriceable series (player props, corners, unknown)", () => {
    expect(P("KXWCGOALSCORER-26JUL09FRAMAR-MBAPPE1")).toBeNull();
    expect(P("KXWCCORNERS-26JUL09FRAMAR-10")).toBeNull();
    expect(P("KXWCSCORE-26JUL09FRAMAR-WEIRDFORMAT")).toBeNull();
  });
});

describe("jointProb", () => {
  const home = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
  const o15 = yes(P("KXWCTOTAL-26JUL09FRAMAR-2"));
  const noMar1 = no(P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR1"));
  const adv = yes(P("KXWCADVANCE-26JUL09FRAMAR-FRA"));

  it("empty slip has probability 1", () => {
    expect(jointProb([], grid, ET)).toBeCloseTo(1, 6);
  });

  it("single reg leg equals legProb equals brute force", () => {
    expect(jointProb([home], grid, ET)).toBeCloseTo(bruteJoint([home]), 12);
    expect(legProb(home, grid, ET)).toBeCloseTo(bruteJoint([home]), 12);
  });

  it("correlated legs: joint != product of marginals, == brute force", () => {
    const legs = [home, o15, noMar1];
    const j = jointProb(legs, grid, ET);
    expect(j).toBeCloseTo(bruteJoint(legs), 12);
    const naive = legs.reduce((p, l) => p * legProb(l, grid, ET), 1);
    expect(Math.abs(j - naive)).toBeGreaterThan(0.01);
  });

  it("advance leg mixes win cells + ET share of draw cells", () => {
    expect(jointProb([adv], grid, ET)).toBeCloseTo(bruteJoint([adv]), 12);
    expect(jointProb([adv, home], grid, ET)).toBeCloseTo(bruteJoint([adv, home]), 12);
  });

  it("contradictory advance demands give 0 on draw branch", () => {
    const advAwayNo = no(P("KXWCADVANCE-26JUL09FRAMAR-MAR")); // == home advances
    const advHomeNo = no(P("KXWCADVANCE-26JUL09FRAMAR-FRA")); // == away advances
    expect(jointProb([advAwayNo, advHomeNo], grid, ET)).toBeCloseTo(bruteJoint([advAwayNo, advHomeNo]), 12);
  });
});

describe("selectSlip", () => {
  const home = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
  const adv = yes(P("KXWCADVANCE-26JUL09FRAMAR-FRA"));
  const o05 = yes(P("KXWCTOTAL-26JUL09FRAMAR-1"));
  const noMar2 = no(P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR2"));
  const noSpread = no(P("KXWCSPREAD-26JUL09FRAMAR-MAR2"));

  it("emits a deterministic multi-leg slip meeting every floor", () => {
    const sel = selectSlip([home, adv, o05, noMar2, noSpread], grid, ET);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict === "slip") {
      expect(sel.legs.length).toBeGreaterThanOrEqual(2);
      expect(sel.legs.length).toBeLessThanOrEqual(MAX_LEGS);
      expect(sel.jointProb).toBeGreaterThanOrEqual(JOINT_FLOOR);
      for (const l of sel.legs) expect(legProb(l, grid, ET)).toBeGreaterThanOrEqual(LEG_FLOOR);
      // determinism: same inputs, same output
      expect(selectSlip([home, adv, o05, noMar2, noSpread], grid, ET)).toEqual(sel);
    }
  });

  it("rejects redundant legs (conditional above cap)", () => {
    // "FRA advances" is near-implied by "FRA wins reg time" — conditional ≈ 1.
    const sel = selectSlip([home, adv], grid, ET);
    if (sel.verdict === "slip") {
      const conditional = jointProb(sel.legs, grid, ET) / jointProb([sel.legs[0]], grid, ET);
      expect(conditional).toBeLessThanOrEqual(REDUNDANCY_CAP + 1e-9);
    }
  });

  it("returns no-slip when fewer than 2 candidates clear the leg floor", () => {
    const longshot = yes(P("KXWCSCORE-26JUL09FRAMAR-FRA3MAR0"));
    const sel = selectSlip([longshot], grid, ET);
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-leg combo ≥ floors" });
  });
});

describe("legReasoning", () => {
  const ctx = { eloDiff: 181, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("emits grammar-conforming string with recomputable numbers", () => {
    const leg = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
    const r = legReasoning(leg, grid, ET, ctx);
    expect(r).toMatch(REASONING_GRAMMAR);
    expect(r).toContain(`model ${(legProb(leg, grid, ET) * 100).toFixed(1)}%`);
    expect(r).toContain("Elo +181");
  });

  it("handles null kalshiMid as 'Kalshi n/a'", () => {
    const m = parseMarket({ ticker: "KXWCBTTS-26JUL09FRAMAR-BTTS", title: "Both teams score?", yesMid: null }, "FRA", "MAR");
    const r = legReasoning({ market: m!, side: "no" }, grid, ET, ctx);
    expect(r).toMatch(REASONING_GRAMMAR);
    expect(r).toContain("Kalshi n/a");
  });
});
