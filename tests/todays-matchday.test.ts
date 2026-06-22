import { describe, it, expect } from "vitest";
import { matchdayRead, tagPhrase } from "@/lib/todays-matchday";

describe("matchdayRead", () => {
  it("flags a strong home favourite", () => {
    expect(matchdayRead({ home: 88, draw: 9, away: 3 })).toEqual({
      favorite: "home",
      conf: 88,
      tag: "STRONG",
    });
  });

  it("flags an away edge when the underdog line is highest", () => {
    expect(matchdayRead({ home: 21, draw: 27, away: 52 })).toEqual({
      favorite: "away",
      conf: 52,
      tag: "EDGE",
    });
  });

  it("flags a tight game as a coin-flip", () => {
    const r = matchdayRead({ home: 34, draw: 33, away: 33 });
    expect(r.favorite).toBe("home");
    expect(r.tag).toBe("TIGHT");
  });

  it("treats a dominant draw line as the favourite", () => {
    expect(matchdayRead({ home: 20, draw: 60, away: 20 }).favorite).toBe("draw");
  });

  it("maps tags to plain phrases", () => {
    expect(tagPhrase("STRONG")).toBe("strong favourite");
    expect(tagPhrase("EDGE")).toBe("slight edge");
    expect(tagPhrase("TIGHT")).toBe("too close to call");
  });
});
