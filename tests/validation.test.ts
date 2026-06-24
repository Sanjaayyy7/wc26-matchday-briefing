import { describe, it, expect } from "vitest";
import {
  FINALS_TOURNAMENTS,
  isFinalsTournament,
  pairedDeltaBrierCI,
  promotionVerdict,
} from "@/lib/validation";

// ---------------------------------------------------------------------------
// isFinalsTournament — exact-set membership, no substring leakage
// ---------------------------------------------------------------------------

describe("isFinalsTournament", () => {
  it("includes the five finals tournaments", () => {
    for (const t of [
      "FIFA World Cup",
      "UEFA Euro",
      "Copa América",
      "African Cup of Nations",
      "AFC Asian Cup",
    ]) {
      expect(isFinalsTournament(t)).toBe(true);
    }
    expect(FINALS_TOURNAMENTS.size).toBe(5);
  });

  it("excludes qualification variants (no substring matching)", () => {
    for (const t of [
      "FIFA World Cup qualification",
      "UEFA Euro qualification",
      "African Cup of Nations qualification",
      "AFC Asian Cup qualification",
    ]) {
      expect(isFinalsTournament(t)).toBe(false);
    }
  });

  it("excludes non-holdout competitions and friendlies", () => {
    for (const t of [
      "Confederations Cup",
      "UEFA Nations League",
      "CONCACAF Nations League",
      "Friendly",
    ]) {
      expect(isFinalsTournament(t)).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------
// pairedDeltaBrierCI — bootstrap of per-match (incumbent - challenger)
// positive ⇒ challenger has lower Brier ⇒ better
// ---------------------------------------------------------------------------

describe("pairedDeltaBrierCI", () => {
  it("reports a positive interval when the challenger is uniformly better", () => {
    const incumbent = [0.6, 0.6, 0.6, 0.6, 0.6];
    const challenger = [0.5, 0.5, 0.5, 0.5, 0.5];
    const ci = pairedDeltaBrierCI(incumbent, challenger);
    expect(ci.mean).toBeCloseTo(0.1, 10);
    expect(ci.lo).toBeGreaterThan(0);
    expect(ci.hi).toBeGreaterThanOrEqual(ci.lo);
  });

  it("brackets zero when the two are identical", () => {
    const a = [0.4, 0.55, 0.6, 0.3, 0.7];
    const ci = pairedDeltaBrierCI(a, a);
    expect(ci.mean).toBeCloseTo(0, 10);
    expect(ci.lo).toBe(0);
    expect(ci.hi).toBe(0);
  });

  it("straddles zero when the per-match difference is noisy around zero", () => {
    const incumbent = [0.9, 0.1, 0.8, 0.2, 0.85, 0.15];
    const challenger = [0.4, 0.6, 0.3, 0.7, 0.35, 0.65];
    // diffs: +0.5, -0.5, +0.5, -0.5, +0.5, -0.5 → mean 0, wide spread
    const ci = pairedDeltaBrierCI(incumbent, challenger);
    expect(ci.mean).toBeCloseTo(0, 10);
    expect(ci.lo).toBeLessThan(0);
    expect(ci.hi).toBeGreaterThan(0);
  });

  it("is deterministic for a fixed seed", () => {
    const inc = [0.6, 0.5, 0.7, 0.4, 0.55];
    const ch = [0.55, 0.52, 0.6, 0.45, 0.5];
    expect(pairedDeltaBrierCI(inc, ch, 1000, 7)).toEqual(
      pairedDeltaBrierCI(inc, ch, 1000, 7),
    );
  });

  it("throws on length mismatch (paired data required)", () => {
    expect(() => pairedDeltaBrierCI([0.5, 0.5], [0.5])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// promotionVerdict — ship iff ΔBrier 95% CI fully > 0 AND ECE < 0.03
// ---------------------------------------------------------------------------

describe("promotionVerdict", () => {
  const better = [0.6, 0.6, 0.6, 0.6, 0.6];
  const worse = [0.5, 0.5, 0.5, 0.5, 0.5]; // challenger lower Brier ⇒ better

  it("ships a significant, well-calibrated improvement", () => {
    const v = promotionVerdict(better, worse, 0.02);
    expect(v.ship).toBe(true);
    expect(v.eceOk).toBe(true);
    expect(v.deltaBrierCI.lo).toBeGreaterThan(0);
  });

  it("holds when the improvement is significant but ECE breaches the ceiling", () => {
    const v = promotionVerdict(better, worse, 0.05);
    expect(v.ship).toBe(false);
    expect(v.eceOk).toBe(false);
  });

  it("holds when the interval straddles zero (not significant)", () => {
    const incumbent = [0.9, 0.1, 0.8, 0.2, 0.85, 0.15];
    const challenger = [0.4, 0.6, 0.3, 0.7, 0.35, 0.65];
    const v = promotionVerdict(incumbent, challenger, 0.01);
    expect(v.ship).toBe(false);
    expect(v.deltaBrierCI.lo).toBeLessThanOrEqual(0);
  });

  it("holds when the challenger is identical to the incumbent", () => {
    const a = [0.4, 0.55, 0.6, 0.3, 0.7];
    const v = promotionVerdict(a, a, 0.01);
    expect(v.ship).toBe(false);
  });
});
