import { describe, it, expect } from "vitest";
import fixtures from "@/data/fixtures.json";
import clubs from "@/data/clubs.json";
import groupsFile from "@/data/groups.json";
import bracket from "@/data/bracket.json";
import { resolveTeamName } from "@/lib/predict";

const groupFixtures = fixtures.filter((f) => f.stage === "group");
const r16Fixtures = fixtures.filter((f) => f.stage === "round-of-16");

describe("schedule invariants", () => {
  it("72 group fixtures, 48 teams, 12 groups of 4", () => {
    expect(groupFixtures.length).toBe(72);
    expect(clubs.length).toBe(48);
    expect(Object.keys(groupsFile.groups).length).toBe(12);
    for (const teams of Object.values(groupsFile.groups)) {
      expect(teams.length).toBe(4);
    }
  });

  it("every group fixture references known teams in the same group", () => {
    const byId = new Map(clubs.map((c) => [c.id, c]));
    for (const f of groupFixtures) {
      const home = byId.get(f.homeId)!;
      const away = byId.get(f.awayId)!;
      expect(home, f.slug).toBeDefined();
      expect(away, f.slug).toBeDefined();
      expect(home.group).toBe(f.group);
      expect(away.group).toBe(f.group);
    }
  });

  it("each group plays exactly 6 matches and each team exactly 3", () => {
    const perGroup = new Map<string, number>();
    const perTeam = new Map<string, number>();
    for (const f of groupFixtures) {
      perGroup.set(f.group!, (perGroup.get(f.group!) ?? 0) + 1);
      for (const id of [f.homeId, f.awayId]) {
        perTeam.set(id, (perTeam.get(id) ?? 0) + 1);
      }
    }
    expect([...perGroup.values()]).toEqual(Array(12).fill(6));
    expect([...perTeam.values()]).toEqual(Array(48).fill(3));
  });

  it("every team resolves in the trained model", () => {
    for (const c of clubs) {
      expect(() => resolveTeamName(c.datasetName ?? c.name)).not.toThrow();
    }
  });

  it("slugs are unique; played fixtures carry scores", () => {
    const slugs = new Set(fixtures.map((f) => f.slug));
    expect(slugs.size).toBe(fixtures.length);
    const played = fixtures.filter((f) => f.homeScore !== undefined);
    expect(played.length).toBeGreaterThanOrEqual(2);
    for (const f of played) expect(f.awayScore).toBeDefined();
  });

  it("round of 16: exactly 8 fixtures, known teams, kickoffs Jul 4–7, no group field", () => {
    const byId = new Map(clubs.map((c) => [c.id, c]));
    expect(r16Fixtures.length).toBe(8);
    for (const f of r16Fixtures) {
      expect(byId.get(f.homeId), f.slug).toBeDefined();
      expect(byId.get(f.awayId), f.slug).toBeDefined();
      expect(f.group).toBeUndefined();
      const ko = new Date(f.kickoffISO).getTime();
      expect(ko).toBeGreaterThanOrEqual(Date.parse("2026-07-04T00:00:00Z"));
      expect(ko).toBeLessThan(Date.parse("2026-07-08T00:00:00Z"));
    }
  });

  it("bracket: 16 R32 slots, every group used as winner+runnerup exactly once, 8 third slots", () => {
    const winners = bracket.roundOf32.filter((m) =>
      [m.home, m.away].some((q) => q.type === "winner"),
    );
    const thirds = bracket.roundOf32.flatMap((m) =>
      [m.home, m.away].filter((q) => q.type === "third"),
    );
    expect(bracket.roundOf32.length).toBe(16);
    expect(thirds.length).toBe(8);
    const winnerGroups = bracket.roundOf32
      .flatMap((m) => [m.home, m.away])
      .filter((q) => q.type === "winner")
      .map((q) => q.group)
      .sort();
    const runnerupGroups = bracket.roundOf32
      .flatMap((m) => [m.home, m.away])
      .filter((q) => q.type === "runnerup")
      .map((q) => q.group)
      .sort();
    expect(winnerGroups).toEqual("ABCDEFGHIJKL".split(""));
    expect(runnerupGroups).toEqual("ABCDEFGHIJKL".split(""));
    expect(winners.length).toBe(12);
    // R16 references every R32 match exactly once
    const refs = bracket.roundOf16.flatMap((m) => [m.home, m.away]).sort((a, b) => a - b);
    expect(refs).toEqual(Array.from({ length: 16 }, (_, i) => 73 + i));
  });
});
