import { describe, it, expect } from "vitest";
import { rankGroup, assignThirds, simulateTournament, type SimFixture } from "@/lib/simulate";
import { mulberry32 } from "@/lib/rng";
import { DEFAULT_PARAMS } from "@/lib/poisson-model";
import groupsFile from "@/data/groups.json";
import bracket from "@/data/bracket.json";
import fixturesJson from "@/data/fixtures.json";
import clubsJson from "@/data/clubs.json";
import model from "@/data/model.json";

const rnd = mulberry32(7);

describe("rankGroup", () => {
  it("orders by points, then goal difference, then goals for", () => {
    const rows = [
      { team: "A", pts: 6, gf: 5, ga: 4 },
      { team: "B", pts: 6, gf: 6, ga: 4 },
      { team: "C", pts: 7, gf: 2, ga: 2 },
    ];
    const ranked = rankGroup(rows, new Map(), rnd);
    expect(ranked.map((r) => r.team)).toEqual(["C", "B", "A"]);
  });
  it("breaks full ties by head-to-head result", () => {
    const rows = [
      { team: "X", pts: 4, gf: 3, ga: 3 },
      { team: "Y", pts: 4, gf: 3, ga: 3 },
    ];
    const results = new Map<string, [number, number]>([["Y|X", [1, 0]]]);
    const ranked = rankGroup(rows, results, rnd);
    expect(ranked[0].team).toBe("Y");
  });
});

describe("assignThirds", () => {
  it("respects allowed-group constraints", () => {
    const thirds = ["A", "B", "C", "D", "E", "F", "G", "H"].map((g, i) => ({
      team: `T${g}`,
      group: g,
      pts: 9 - i,
      gf: 5,
      ga: 1,
    }));
    const slots = [
      { match: 1, allowed: ["A"] },
      { match: 2, allowed: ["B", "A"] },
      { match: 3, allowed: ["C", "D", "E", "F", "G", "H"] },
    ];
    const assign = assignThirds(thirds, slots, rnd);
    expect(assign.get(1)).toBe("TA");
    expect(assign.get(2)).toBe("TB");
    expect(["TC", "TD", "TE", "TF", "TG", "TH"]).toContain(assign.get(3));
  });
});

describe("simulateTournament (real data, seeded, small N)", () => {
  const byId = new Map(
    (clubsJson as Array<{ id: string; datasetName?: string; name: string }>).map(
      (c) => [c.id, c.datasetName ?? c.name],
    ),
  );
  const simFixtures: SimFixture[] = (fixturesJson as Array<{
    homeId: string;
    awayId: string;
    group?: string;
    neutral?: boolean;
    homeScore?: number;
    awayScore?: number;
  }>).map((f) => ({
    home: byId.get(f.homeId)!,
    away: byId.get(f.awayId)!,
    group: f.group!,
    neutral: f.neutral ?? true,
    homeScore: f.homeScore,
    awayScore: f.awayScore,
  }));
  const input = {
    groups: groupsFile.groups,
    fixtures: simFixtures,
    bracket: bracket as never,
    ratings: model.ratings as Record<string, number>,
    params: DEFAULT_PARAMS,
  };

  it("probability mass conserved: champions sum to 1, group advancers to 32", () => {
    const out = simulateTournament(input, 400, 42);
    const champSum = Object.values(out.teams).reduce((a, t) => a + t.champion, 0);
    expect(champSum).toBeCloseTo(1, 6);
    const advSum = Object.values(out.teams).reduce((a, t) => a + t.advanceGroup, 0);
    expect(advSum).toBeCloseTo(32, 6); // 12 winners + 12 runners-up + 8 thirds
    const r16Sum = Object.values(out.teams).reduce((a, t) => a + t.reachR16, 0);
    expect(r16Sum).toBeCloseTo(16, 6);
  });

  it("is deterministic for a fixed seed", () => {
    const a = simulateTournament(input, 200, 42);
    const b = simulateTournament(input, 200, 42);
    expect(a.teams["Spain"].champion).toBe(b.teams["Spain"].champion);
  });

  it("rating sanity: Spain's champion odds dominate the weakest side's", () => {
    const out = simulateTournament(input, 400, 42);
    const ratings = model.ratings as Record<string, number>;
    const field = Object.values(groupsFile.groups).flat();
    const weakest = field.reduce((a, b) => (ratings[a] < ratings[b] ? a : b));
    expect(out.teams["Spain"].champion).toBeGreaterThan(out.teams[weakest].champion);
  });

  it("locked result honored: Mexico's real wins are in every run's standings (advance prob reflects it)", () => {
    const out = simulateTournament(input, 400, 42);
    // Mexico banked real locked wins (incl. 2-0 over South Africa, 3-0 over Czech
    // Republic) and clinched Group A; Czech Republic were eliminated on locked
    // results. Mexico's group-advance probability must comfortably exceed theirs.
    expect(out.teams["Mexico"].advanceGroup).toBeGreaterThan(
      out.teams["Czech Republic"].advanceGroup,
    );
  });
});
