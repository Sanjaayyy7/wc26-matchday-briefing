import { describe, expect, it } from "vitest";
import {
  newFeatureState,
  matchFeatures,
  pushMatch,
} from "@/lib/feature-signals";

describe("matchFeatures", () => {
  it("cold start: both unseen teams are fully rested with zero form", () => {
    const s = newFeatureState();
    expect(matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" })).toEqual({
      restF: 0,
      formF: 0,
    });
  });

  it("rest diff: 4 days vs 14+ days, clamped and scaled", () => {
    const s = newFeatureState();
    pushMatch(s, { date: "2026-07-05", home: "fra", away: "x1", hs: 1, as: 0 });
    pushMatch(s, { date: "2026-06-01", home: "mar", away: "x2", hs: 1, as: 0 });
    // fra rested 4 days (clamp 4), mar 38 days (clamp 14) → (4 − 14)/11
    const f = matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" });
    expect(f.restF).toBeCloseTo((4 - 14) / 11, 10);
  });

  it("rest clamps at 3 days minimum", () => {
    const s = newFeatureState();
    pushMatch(s, { date: "2026-07-08", home: "fra", away: "x1", hs: 0, as: 0 });
    pushMatch(s, { date: "2026-07-08", home: "mar", away: "x2", hs: 0, as: 0 });
    // both 1 day → both clamp to 3 → 0
    expect(matchFeatures(s, { date: "2026-07-09", home: "fra", away: "mar" }).restF).toBe(0);
  });

  it("form needs at least 3 matches, uses last-5 mean goal diff", () => {
    const s = newFeatureState();
    // fra: 6 matches, gds +1,+1,+1,+2,+2,+3 → last 5 = +1,+1,+2,+2,+3 → mean 1.8
    const gds: Array<[number, number]> = [[1, 0], [2, 1], [3, 2], [2, 0], [4, 2], [3, 0]];
    gds.forEach(([hs, as], i) =>
      pushMatch(s, { date: `2026-06-0${i + 1}`, home: "fra", away: `y${i}`, hs, as }),
    );
    // mar: only 2 matches → form 0
    pushMatch(s, { date: "2026-06-01", home: "mar", away: "z1", hs: 0, as: 4 });
    pushMatch(s, { date: "2026-06-05", home: "mar", away: "z2", hs: 0, as: 4 });
    const f = matchFeatures(s, { date: "2026-06-20", home: "fra", away: "mar" });
    expect(f.formF).toBeCloseTo(Math.min((1.8 - 0) / 3, 1), 10);
  });

  it("away perspective: goal diff is signed from the team's side", () => {
    const s = newFeatureState();
    // mar loses 0-4 three times AS AWAY team → gd −4 each → form −4
    for (let i = 1; i <= 3; i++)
      pushMatch(s, { date: `2026-06-0${i}`, home: `w${i}`, away: "mar", hs: 4, as: 0 });
    for (let i = 1; i <= 3; i++)
      pushMatch(s, { date: `2026-06-0${i}`, home: "fra", away: `v${i}`, hs: 0, as: 0 });
    const f = matchFeatures(s, { date: "2026-06-20", home: "fra", away: "mar" });
    // (0 − (−4))/3 = 1.333 → clamped to 1
    expect(f.formF).toBe(1);
  });
});
