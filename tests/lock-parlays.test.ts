// tests/lock-parlays.test.ts
import { describe, expect, it } from "vitest";
import { marketMid, PARLAY_SERIES_V2, haveV2Slugs, snapshotFileV2 } from "../scripts/lock-parlays.mts";
import { kalshiEventCode, kalshiEventTicker } from "../scripts/shared.mts";
import { COMBO_SERIES } from "../lib/parlay-v2";

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

describe("v2 lock plumbing", () => {
  it("locks exactly the combo-eligible series", () => {
    expect(PARLAY_SERIES_V2).toEqual(COMBO_SERIES);
  });

  it("haveV2Slugs keys idempotence on (slug, v2) — v1 entries never block a v2 relock", () => {
    const have = haveV2Slugs([
      { slug: "france-vs-morocco" },
      { slug: "spain-vs-belgium", engineVersion: "v2-combo" },
      { slug: "norway-vs-england", engineVersion: "v1" },
    ]);
    expect(have.has("france-vs-morocco")).toBe(false);
    expect(have.has("spain-vs-belgium")).toBe(true);
    expect(have.has("norway-vs-england")).toBe(false);
  });

  it("v2 snapshots live beside v1 with a -v2 suffix", () => {
    expect(snapshotFileV2("france-vs-morocco")).toBe("france-vs-morocco-v2.json");
  });
});
