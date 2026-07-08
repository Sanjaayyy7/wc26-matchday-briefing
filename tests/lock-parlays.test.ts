// tests/lock-parlays.test.ts
import { describe, expect, it } from "vitest";
import { marketMid, PARLAY_SERIES } from "../scripts/lock-parlays.mts";
import { kalshiEventCode, kalshiEventTicker } from "../scripts/shared.mts";

describe("marketMid", () => {
  it("uses bid/ask mid when both present", () => {
    expect(marketMid({ yes_bid_dollars: "0.71", yes_ask_dollars: "0.72" })).toBeCloseTo(0.715, 10);
  });
  it("falls back to last price, then null", () => {
    expect(marketMid({ last_price_dollars: "0.55" })).toBeCloseTo(0.55, 10);
    expect(marketMid({})).toBeNull();
  });
});

describe("kalshiEventCode", () => {
  const f = { homeId: "fra", awayId: "mar", kickoffISO: "2026-07-09T20:00:00Z", tzOffsetMinutes: -240 } as never;
  it("builds venue-local date code and ticker stays backwards-compatible", () => {
    expect(kalshiEventCode(f)).toBe("26JUL09FRAMAR");
    expect(kalshiEventTicker(f)).toBe("KXWCGAME-26JUL09FRAMAR");
  });
});

describe("PARLAY_SERIES", () => {
  it("is exactly the 7 priceable series", () => {
    expect(PARLAY_SERIES).toEqual(["KXWCGAME","KXWCADVANCE","KXWCSPREAD","KXWCTOTAL","KXWCTEAMTOTAL","KXWCBTTS","KXWCSCORE"]);
  });
});
