// tests/settle-parlays.test.ts
import { describe, expect, it } from "vitest";
import { gradeLeg } from "../scripts/settle-parlays.mts";

const ctx90 = { h90: 0, a90: 0, advancedHome: true, homeAbbr: "SUI", awayAbbr: "COL" };

describe("gradeLeg", () => {
  it("grades reg-time legs on the 90' score (pens match: draw)", () => {
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-TIE", side: "yes" }, ctx90)).toBe(true);
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-COL", side: "yes" }, ctx90)).toBe(false);
    expect(gradeLeg({ ticker: "KXWCTOTAL-26JUL07SUICOL-1", side: "no" }, ctx90)).toBe(true); // under 0.5
  });

  it("grades ADVANCE from the advancement outcome, not the 90' score", () => {
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-SUI", side: "yes" }, ctx90)).toBe(true);
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-COL", side: "yes" }, ctx90)).toBe(false);
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-SUI", side: "yes" }, { ...ctx90, advancedHome: null })).toBeNull();
  });

  it("NO side is the negation", () => {
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-TIE", side: "no" }, ctx90)).toBe(false);
  });
});
