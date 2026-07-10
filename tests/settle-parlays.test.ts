// tests/settle-parlays.test.ts
import { describe, expect, it } from "vitest";
import { gradeLeg, gradeLegV2, gradeScorerLeg } from "../scripts/settle-parlays.mts";
import { ENGINE_VERSION_V2, ENGINE_VERSION_V2_1 } from "../lib/parlay-v2";

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

describe("gradeLegV2", () => {
  const base = { h90: 2, a90: 1, h1: 1, a1: 0, advancedHome: true, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("1H legs grade on the half-time score", () => {
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-1", side: "yes" }, base)).toBe(true); // 1 1H goal ≥ 1
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-2", side: "no" }, base)).toBe(true); // under 1.5 1H
    expect(gradeLegV2({ ticker: "KXWC1H-26JUL09FRAMAR-FRA", side: "yes" }, base)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWC1HBTTS-26JUL09FRAMAR-BTTS", side: "no" }, base)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWC1HSPREAD-26JUL09FRAMAR-FRA2", side: "yes" }, base)).toBe(false);
  });

  it("missing HT makes 1H legs ungradable but not 90-minute legs", () => {
    const noHt = { ...base, h1: null, a1: null };
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-1", side: "yes" }, noHt)).toBeNull();
    expect(gradeLegV2({ ticker: "KXWCTOTAL-26JUL09FRAMAR-3", side: "yes" }, noHt)).toBe(true); // 3 FT goals ≥ 3
  });

  it("90-minute + advance legs grade exactly like v1 (pens-draw case)", () => {
    const pens = { h90: 1, a90: 1, h1: 0, a1: 1, advancedHome: false, homeAbbr: "ARG", awayAbbr: "SUI" };
    expect(gradeLegV2({ ticker: "KXWCGAME-26JUL12ARGSUI-TIE", side: "yes" }, pens)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWCADVANCE-26JUL12ARGSUI-ARG", side: "yes" }, pens)).toBe(false);
    expect(gradeLegV2({ ticker: "KXWCADVANCE-26JUL12ARGSUI-ARG", side: "no" }, pens)).toBe(true);
  });

  it("combo-ineligible ticker is ungradable", () => {
    expect(gradeLegV2({ ticker: "KXWCSCORE-26JUL09FRAMAR-FRA2MAR0", side: "no" }, base)).toBeNull();
  });
});

describe("v2.1 grading (same path as v2-combo)", () => {
  // Mirrors the `isV2` routing expression in settle-parlays.mts main(): both
  // engine versions dispatch to gradeLegV2, never the v1 gradeLeg.
  const isV2 = (engineVersion: string): boolean =>
    engineVersion === ENGINE_VERSION_V2 || engineVersion === ENGINE_VERSION_V2_1;

  it("v2.1-combo and v2-combo both route through gradeLegV2; v1 does not", () => {
    expect(isV2(ENGINE_VERSION_V2_1)).toBe(true);
    expect(isV2(ENGINE_VERSION_V2)).toBe(true);
    expect(isV2("v1")).toBe(false);
  });

  it("1H legs grade on the half-time score (v2.1-combo record) — same as the v2-combo case", () => {
    const base = { h90: 2, a90: 1, h1: 1, a1: 0, advancedHome: true, homeAbbr: "FRA", awayAbbr: "MAR" };
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-1", side: "yes" }, base)).toBe(true); // 1 1H goal ≥ 1
    expect(gradeLegV2({ ticker: "KXWC1H-26JUL09FRAMAR-FRA", side: "yes" }, base)).toBe(true);
  });
});

describe("gradeScorerLeg (v3)", () => {
  const goals = [
    { side: "home" as const, player: "Kylian Mbappé", count: 1 },
    { side: "home" as const, player: "Ousmane Dembélé", count: 1 },
  ];
  const leg = (ticker: string, title: string) => ({ ticker, side: "yes" as const, title });

  it("grades strikes against the row's scorer counts (diacritics-insensitive)", () => {
    expect(gradeScorerLeg(leg("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1", "Kylian Mbappe: 1+ goals"), goals)).toBe(true);
    expect(gradeScorerLeg(leg("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-2", "Kylian Mbappe: 2+ goals"), goals)).toBe(false);
  });

  it("a listed match with no entry for the player grades as 0 goals", () => {
    expect(gradeScorerLeg(leg("KXWCGOAL-26JUL09FRAMAR-FRAAGRIE7-1", "Antoine Griezmann: 1+ goals"), goals)).toBe(false);
  });

  it("missing goals data leaves the leg pending; malformed legs are ungradable", () => {
    expect(gradeScorerLeg(leg("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1", "Kylian Mbappe: 1+ goals"), undefined)).toBeNull();
    expect(gradeScorerLeg({ ticker: "KXWCGOAL-26JUL09FRAMAR-BAD", side: "yes" }, goals)).toBeNull();
  });
});
