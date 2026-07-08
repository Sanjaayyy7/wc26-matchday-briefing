// tests/parlay-view.test.ts
import { describe, expect, it } from "vitest";
import { buildParlayViews, parlayRecord, type ParlayLegRow, type ParlaySlipRow } from "../lib/parlay-view";

const leg = (ticker: string, modelProb = 0.9): ParlayLegRow => ({
  ticker, side: "no", title: `t-${ticker}`, modelProb, kalshiMid: 0.95, reasoning: `r-${ticker}`,
});

const rows: ParlaySlipRow[] = [
  { slug: "france-vs-morocco", lockedAt: "2026-07-08T17:00:00Z", legs: [leg("A"), leg("B")], jointProb: 0.86 },
  {
    slug: "spain-vs-belgium", lockedAt: "2026-07-08T17:00:00Z",
    legs: [leg("C"), leg("D"), leg("E")], jointProb: 0.55,
    result: { legs: [{ ticker: "C", hit: true }, { ticker: "D", hit: false }, { ticker: "E", hit: true }], slipHit: false, gradedAt: "2026-07-10T22:00:00Z" },
  },
  {
    slug: "norway-vs-england", lockedAt: "2026-07-08T17:00:00Z",
    legs: [leg("F"), leg("G")], jointProb: 0.84,
    result: { legs: [{ ticker: "F", hit: true }, { ticker: "G", hit: true }], slipHit: true, gradedAt: "2026-07-11T23:00:00Z" },
  },
  { slug: "argentina-vs-switzerland", lockedAt: "2026-07-08T17:00:00Z", verdict: "no-slip", reason: "no 2-leg combo ≥ floors" },
];

const fixtures = [
  { slug: "france-vs-morocco", homeId: "fra", awayId: "mar", kickoffISO: "2026-07-09T20:00:00Z", stage: "quarter-final" },
  { slug: "spain-vs-belgium", homeId: "esp", awayId: "bel", kickoffISO: "2026-07-10T19:00:00Z", stage: "quarter-final" },
  { slug: "norway-vs-england", homeId: "nor", awayId: "eng", kickoffISO: "2026-07-11T21:00:00Z", stage: "quarter-final" },
  { slug: "argentina-vs-switzerland", homeId: "arg", awayId: "sui", kickoffISO: "2026-07-12T01:00:00Z", stage: "quarter-final" },
];
const clubName = (id: string) => ({ fra: "France", mar: "Morocco", esp: "Spain", bel: "Belgium", nor: "Norway", eng: "England", arg: "Argentina", sui: "Switzerland" })[id] ?? id;

describe("buildParlayViews", () => {
  const views = buildParlayViews(rows, fixtures, clubName);

  it("maps status: open / miss / hit / no-slip", () => {
    const bySlug = new Map(views.map((v) => [v.slug, v]));
    expect(bySlug.get("france-vs-morocco")?.status).toBe("open");
    expect(bySlug.get("spain-vs-belgium")?.status).toBe("miss");
    expect(bySlug.get("norway-vs-england")?.status).toBe("hit");
    expect(bySlug.get("argentina-vs-switzerland")?.status).toBe("no-slip");
  });

  it("joins matchup and stage from fixtures", () => {
    const v = views.find((x) => x.slug === "france-vs-morocco");
    expect(v?.matchup).toBe("France vs Morocco");
    expect(v?.stage).toBe("quarter-final");
    expect(v?.kickoffISO).toBe("2026-07-09T20:00:00Z");
  });

  it("maps per-leg hit by ticker (null when ungraded)", () => {
    const graded = views.find((x) => x.slug === "spain-vs-belgium");
    expect(graded?.legs.map((l) => l.hit)).toEqual([true, false, true]);
    const open = views.find((x) => x.slug === "france-vs-morocco");
    expect(open?.legs.map((l) => l.hit)).toEqual([null, null]);
  });

  it("keeps a no-slip record with its reason and zero legs", () => {
    const ns = views.find((x) => x.slug === "argentina-vs-switzerland");
    expect(ns?.reason).toBe("no 2-leg combo ≥ floors");
    expect(ns?.legs).toEqual([]);
  });

  it("sorts by kickoff ascending", () => {
    expect(views.map((v) => v.slug)).toEqual([
      "france-vs-morocco", "spain-vs-belgium", "norway-vs-england", "argentina-vs-switzerland",
    ]);
  });
});

describe("parlayRecord", () => {
  it("computes running slip/leg hit rates and locked-joint mean over graded slips", () => {
    const r = parlayRecord(rows);
    expect(r.slips).toBe(3);
    expect(r.noSlips).toBe(1);
    expect(r.graded).toBe(2);
    expect(r.slipHits).toBe(1);
    expect(r.slipHitRate).toBeCloseTo(0.5, 10);
    expect(r.legs).toBe(5);
    expect(r.legHits).toBe(4);
    expect(r.legHitRate).toBeCloseTo(0.8, 10);
    expect(r.meanLockedJoint).toBeCloseTo((0.55 + 0.84) / 2, 10);
  });

  it("returns null rates when nothing graded", () => {
    const r = parlayRecord([rows[0], rows[3]]);
    expect(r.graded).toBe(0);
    expect(r.slipHitRate).toBeNull();
    expect(r.legHitRate).toBeNull();
    expect(r.meanLockedJoint).toBeNull();
  });
});
