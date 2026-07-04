import { describe, it, expect } from "vitest";
import { applyKnockoutScores90, type KnockoutResultRow } from "@/lib/knockout-grading";

const row = (over: Partial<KnockoutResultRow>): KnockoutResultRow => ({
  match: 90,
  homeId: "bel",
  awayId: "sen",
  homeScore: 3,
  awayScore: 2,
  winnerId: "bel",
  ...over,
});
const fixture = (over: Record<string, unknown> = {}) => ({
  slug: "belgium-vs-senegal",
  homeId: "bel",
  awayId: "sen",
  homeScore: 3,
  awayScore: 2,
  ...over,
});

describe("applyKnockoutScores90", () => {
  it("passes group fixtures through untouched (no gate)", () => {
    const f = fixture({ group: "A", homeScore: 1, awayScore: 1 });
    expect(applyKnockoutScores90([f], [])).toEqual([f]);
  });

  it("passes unplayed knockout fixtures through (no scores yet)", () => {
    const f = fixture({ homeScore: undefined, awayScore: undefined });
    expect(applyKnockoutScores90([f], [])).toEqual([f]);
  });

  it("THROWS for a scored knockout fixture with no knockout-results row", () => {
    expect(() => applyKnockoutScores90([fixture()], [])).toThrow(/belgium-vs-senegal/);
  });

  it("THROWS when the row exists but lacks an explicit `after`", () => {
    expect(() => applyKnockoutScores90([fixture()], [row({})])).toThrow(/after/);
  });

  it("after=90: passes through, no 90' fields added", () => {
    const out = applyKnockoutScores90([fixture()], [row({ after: "90" })]);
    expect(out[0].homeScore90).toBeUndefined();
    expect(out[0].decidedBy).toBeUndefined();
  });

  it("after=90: throws when the score is level (a drawn knockout can't end at 90)", () => {
    const f = fixture({ homeScore: 1, awayScore: 1 });
    expect(() =>
      applyKnockoutScores90([f], [row({ after: "90", homeScore: 1, awayScore: 1 })]),
    ).toThrow(/level|draw/i);
  });

  it("after=et: applies the 90-minute draw score and decidedBy", () => {
    const out = applyKnockoutScores90(
      [fixture()],
      [row({ after: "et", homeScore90: 2, awayScore90: 2 })],
    );
    expect(out[0]).toMatchObject({ homeScore90: 2, awayScore90: 2, decidedBy: "et" });
    expect(out[0].homeScore).toBe(3); // AET score untouched
  });

  it("after=et/pens: throws when homeScore90/awayScore90 missing", () => {
    expect(() => applyKnockoutScores90([fixture()], [row({ after: "et" })])).toThrow(
      /homeScore90/,
    );
  });

  it("after=et/pens: throws when the 90' score is not level", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "et", homeScore90: 2, awayScore90: 1 })]),
    ).toThrow(/level/i);
  });

  it("after=pens: requires the AET score itself to be level", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "pens", homeScore90: 1, awayScore90: 1 })]),
    ).toThrow(/pens/);
  });

  it("throws when fixture score disagrees with the knockout-results score", () => {
    expect(() =>
      applyKnockoutScores90([fixture({ homeScore: 2, awayScore: 2 })], [row({ after: "90" })]),
    ).toThrow(/disagrees/);
  });

  it("throws when winnerId contradicts the AET score (non-pens)", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "90", winnerId: "sen" })]),
    ).toThrow(/winner/i);
  });

  it("handles reversed home/away orientation", () => {
    const f = fixture({ homeId: "sen", awayId: "bel", homeScore: 2, awayScore: 3 });
    const out = applyKnockoutScores90([f], [row({ after: "et", homeScore90: 2, awayScore90: 2 })]);
    expect(out[0]).toMatchObject({ homeScore90: 2, awayScore90: 2, decidedBy: "et" });
  });

  it("does not mutate its inputs", () => {
    const f = fixture();
    applyKnockoutScores90([f], [row({ after: "et", homeScore90: 2, awayScore90: 2 })]);
    expect(f).toEqual(fixture());
  });
});
