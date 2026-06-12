import { describe, it, expect } from "vitest";
import { expectedScore, kFactor, marginMultiplier, updateElo } from "@/lib/elo";

describe("expectedScore", () => {
  it("is 0.5 for equal ratings", () => {
    expect(expectedScore(1500, 1500)).toBeCloseTo(0.5, 10);
  });
  it("is ~0.76 for +200 rating edge (standard Elo logistic)", () => {
    expect(expectedScore(1700, 1500)).toBeCloseTo(0.7597, 3);
  });
  it("is symmetric", () => {
    expect(expectedScore(1500, 1700) + expectedScore(1700, 1500)).toBeCloseTo(1, 10);
  });
});

describe("kFactor (eloratings.net convention)", () => {
  it("World Cup finals = 60", () => {
    expect(kFactor("FIFA World Cup")).toBe(60);
  });
  it("qualifiers and continental finals = 40", () => {
    expect(kFactor("FIFA World Cup qualification")).toBe(40);
    expect(kFactor("UEFA Euro")).toBe(40);
    expect(kFactor("Copa América")).toBe(40);
  });
  it("friendlies = 20", () => {
    expect(kFactor("Friendly")).toBe(20);
  });
  it("unknown tournaments default to 30", () => {
    expect(kFactor("King's Cup")).toBe(30);
  });
});

describe("marginMultiplier", () => {
  it("1 for wins by 0 or 1", () => {
    expect(marginMultiplier(0)).toBe(1);
    expect(marginMultiplier(1)).toBe(1);
  });
  it("1.5 for two-goal wins, scales up beyond", () => {
    expect(marginMultiplier(2)).toBeCloseTo(1.5, 10);
    expect(marginMultiplier(3)).toBeCloseTo(1.75, 10);
    expect(marginMultiplier(5)).toBeGreaterThan(1.75);
  });
});

describe("updateElo", () => {
  it("zero-sum: winner gains what loser drops", () => {
    const { home, away } = updateElo({
      home: 1600,
      away: 1600,
      homeScore: 2,
      awayScore: 0,
      tournament: "Friendly",
      neutral: true,
    });
    expect(home - 1600).toBeCloseTo(1600 - away, 10);
    expect(home).toBeGreaterThan(1600);
  });
  it("home advantage: a home draw against an equal side loses rating", () => {
    const { home } = updateElo({
      home: 1600,
      away: 1600,
      homeScore: 1,
      awayScore: 1,
      tournament: "Friendly",
      neutral: false,
    });
    expect(home).toBeLessThan(1600);
  });
  it("upset at a World Cup moves ratings more than a friendly upset", () => {
    const wc = updateElo({
      home: 1500, away: 1800, homeScore: 1, awayScore: 0,
      tournament: "FIFA World Cup", neutral: true,
    });
    const fr = updateElo({
      home: 1500, away: 1800, homeScore: 1, awayScore: 0,
      tournament: "Friendly", neutral: true,
    });
    expect(wc.home - 1500).toBeGreaterThan(fr.home - 1500);
  });
});
