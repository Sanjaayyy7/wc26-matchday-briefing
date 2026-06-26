import { describe, it, expect } from "vitest";
import { groupByMatchday, defaultSelectedIndex } from "@/lib/match-day-groups";
import type { MatchView } from "@/lib/match-view";

// Minimal stub — groupByMatchday only reads fixture.kickoffISO.
const v = (iso: string) =>
  ({ fixture: { kickoffISO: iso, slug: iso } }) as unknown as MatchView;

describe("groupByMatchday", () => {
  it("buckets views by ET calendar date, ascending", () => {
    const g = groupByMatchday([v("2026-06-24T20:00:00Z"), v("2026-06-23T18:00:00Z"), v("2026-06-24T23:00:00Z")]);
    expect(g.map((b) => b.views.length)).toEqual([1, 2]);
    expect(g[0].dateISO < g[1].dateISO).toBe(true);
  });
  it("defaultSelectedIndex picks today when present", () => {
    const g = groupByMatchday([v("2026-06-25T18:00:00Z"), v("2026-06-26T18:00:00Z")]);
    expect(defaultSelectedIndex(g, new Date("2026-06-25T12:00:00Z"))).toBe(0);
  });
  it("defaultSelectedIndex picks nearest upcoming when no today", () => {
    const g = groupByMatchday([v("2026-06-20T18:00:00Z"), v("2026-06-28T18:00:00Z")]);
    expect(defaultSelectedIndex(g, new Date("2026-06-25T12:00:00Z"))).toBe(1);
  });
});
