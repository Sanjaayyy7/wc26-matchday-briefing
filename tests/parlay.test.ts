import { describe, expect, it } from "vitest";
import { parseMarket, type KalshiMarket } from "../lib/parlay";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarket(mk(t), "FRA", "MAR");

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
