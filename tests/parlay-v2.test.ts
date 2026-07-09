import { describe, expect, it } from "vitest";
import {
  COMBO_SERIES, ENGINE_VERSION_V2, Q_FIRST_HALF, V2_FLOORS, YES_ONLY_SERIES,
  candidateLegsV2, parseMarketV2, seriesOf, type CandidateLegV2,
} from "../lib/parlay-v2";
import type { KalshiMarket } from "../lib/parlay";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarketV2(mk(t), "FRA", "MAR");

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
