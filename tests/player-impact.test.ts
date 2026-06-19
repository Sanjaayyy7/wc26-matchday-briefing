import { describe, it, expect } from "vitest";
import { impactPer90, rankPlayers } from "@/lib/player-impact";
import type { PlayerStat } from "@/lib/player-impact";

const makeStat = (overrides: Partial<PlayerStat> & { id: string }): PlayerStat => ({
  id: overrides.id,
  name: overrides.name ?? overrides.id,
  teamId: overrides.teamId ?? "team",
  position: overrides.position ?? "MF",
  goals: overrides.goals ?? 0,
  assists: overrides.assists ?? 0,
  shots: overrides.shots ?? 0,
  keyPasses: overrides.keyPasses ?? 0,
  minutes: overrides.minutes ?? 90,
  appearances: overrides.appearances ?? 1,
});

describe("impactPer90", () => {
  it("is monotonically higher for more goals (same minutes)", () => {
    const p1 = makeStat({ id: "a", goals: 1, minutes: 90 });
    const p2 = makeStat({ id: "b", goals: 2, minutes: 90 });
    const p3 = makeStat({ id: "c", goals: 3, minutes: 90 });
    expect(impactPer90(p2)).toBeGreaterThan(impactPer90(p1));
    expect(impactPer90(p3)).toBeGreaterThan(impactPer90(p2));
  });

  it("per-90 normalizes: same goals per 90 → same raw before shrinkage (full match)", () => {
    // Two players with exactly 1 goal in exactly 90 min
    const p1 = makeStat({ id: "a", goals: 1, minutes: 90 });
    const p2 = makeStat({ id: "b", goals: 1, minutes: 90 });
    expect(impactPer90(p1)).toBeCloseTo(impactPer90(p2), 5);
  });

  it("shrinks outlier low-minutes hat-trick below an average full tournament scorer", () => {
    // 10-min hat trick — 3 goals but massive small-sample variance
    const outlier = makeStat({ id: "outlier", goals: 3, minutes: 10, appearances: 1 });
    // solid 3-match scorer with 2 goals in 270 minutes (~0.67 per 90) — well established
    const solid = makeStat({ id: "solid", goals: 2, minutes: 270, appearances: 3 });
    // After shrinkage the outlier should NOT rank above the solid scorer
    expect(impactPer90(outlier)).toBeLessThan(impactPer90(solid));
  });

  it("returns a finite non-negative number for a player with zero stats", () => {
    const p = makeStat({ id: "zero" });
    const score = impactPer90(p);
    expect(isFinite(score)).toBe(true);
    expect(score).toBeGreaterThanOrEqual(0);
  });
});

describe("rankPlayers", () => {
  it("orders by goals descending", () => {
    const players = [
      makeStat({ id: "a", goals: 1 }),
      makeStat({ id: "b", goals: 3 }),
      makeStat({ id: "c", goals: 2 }),
    ];
    const ranked = rankPlayers(players, "goals");
    expect(ranked[0].id).toBe("b");
    expect(ranked[1].id).toBe("c");
    expect(ranked[2].id).toBe("a");
  });

  it("orders by assists descending", () => {
    const players = [
      makeStat({ id: "a", assists: 0 }),
      makeStat({ id: "b", assists: 2 }),
      makeStat({ id: "c", assists: 1 }),
    ];
    const ranked = rankPlayers(players, "assists");
    expect(ranked[0].id).toBe("b");
  });

  it("orders by impact descending", () => {
    const players = [
      makeStat({ id: "low", goals: 0, assists: 0, minutes: 90 }),
      makeStat({ id: "high", goals: 2, assists: 1, minutes: 90 }),
    ];
    const ranked = rankPlayers(players, "impact");
    expect(ranked[0].id).toBe("high");
  });
});
