import { describe, it, expect } from "vitest";
import { groupStandings } from "@/lib/standings";
import type { Fixture } from "@/lib/data";

const fx = (homeId: string, awayId: string, hs?: number, as?: number): Fixture =>
  ({
    id: `${homeId}-${awayId}`,
    slug: `${homeId}-vs-${awayId}`,
    homeId,
    awayId,
    kickoffISO: "2026-06-20T00:00:00Z",
    venue: "x",
    competition: "x",
    stakes: "x",
    privateNotes: null,
    homeScore: hs,
    awayScore: as,
  }) as Fixture;

describe("groupStandings", () => {
  it("computes W/D/L, goals, points and ranks by FIFA order", () => {
    const rows = groupStandings(
      ["mex", "rsa", "kor", "cze"],
      [
        fx("mex", "rsa", 2, 0),
        fx("kor", "cze", 2, 1),
        fx("mex", "kor"), // unplayed — ignored
      ],
    );
    expect(rows[0].teamId).toBe("mex"); // +2 GD beats +1 GD
    expect(rows[0]).toMatchObject({ played: 1, won: 1, pts: 3, gf: 2, ga: 0 });
    expect(rows[1].teamId).toBe("kor");
    expect(rows[3]).toMatchObject({ teamId: "rsa", lost: 1, pts: 0 });
  });

  it("all-zero table keeps every team with 0 played", () => {
    const rows = groupStandings(["a", "b", "c", "d"], []);
    expect(rows).toHaveLength(4);
    expect(rows.every((r) => r.played === 0 && r.pts === 0)).toBe(true);
  });
});
