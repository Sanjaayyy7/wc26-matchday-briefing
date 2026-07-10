import { describe, expect, it } from "vitest";
import {
  MIN_ATTACK_WEIGHT, deriveShares, matchScorerMarkets, normalizeName, scorerNameFromTitle,
  type XiPlayer,
} from "../scripts/player-model.mts";
import type { KalshiMarket } from "../lib/parlay";

const xi: XiPlayer[] = [
  { id: 1, name: "Mikel Oyarzabal", teamSide: "home", goals: 4, xg: 2.0 },
  { id: 2, name: "Lamine Yamal", teamSide: "home", goals: 3, xg: 3.0 },
  { id: 3, name: "Unai Simón", teamSide: "home", goals: 0, xg: null },
  { id: 4, name: "Romelu Lukaku", teamSide: "away", goals: 2, xg: 1.9 },
  { id: 5, name: "Kevin De Bruyne", teamSide: "away", goals: 1, xg: 0.1 },
];

describe("deriveShares", () => {
  it("normalizes goals+xG weights to 1 within each team, flooring missing stats", () => {
    const shares = deriveShares(xi);
    const home = shares.filter((s) => s.teamSide === "home");
    const away = shares.filter((s) => s.teamSide === "away");
    expect(home.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 12);
    expect(away.reduce((a, s) => a + s.share, 0)).toBeCloseTo(1, 12);
    // Oyarzabal: 6 / (6 + 6 + 0.1); keeper gets the floor weight
    expect(home.find((s) => s.name === "Mikel Oyarzabal")!.share).toBeCloseTo(6 / 12.1, 12);
    expect(home.find((s) => s.name === "Unai Simón")!.share).toBeCloseTo(MIN_ATTACK_WEIGHT / 12.1, 12);
    expect(away.find((s) => s.name === "Romelu Lukaku")!.share).toBeCloseTo(3.9 / (3.9 + 1.1), 12);
  });
});

describe("name matching", () => {
  it("normalizes diacritics and extracts names from Kalshi titles", () => {
    expect(normalizeName("Unai Simón")).toBe(normalizeName("Unai Simon"));
    expect(normalizeName("Martin Ødegaard")).toBe(normalizeName("Martin Odegaard"));
    expect(normalizeName("Julián Álvarez")).toBe(normalizeName("Julian Alvarez"));
    expect(scorerNameFromTitle("Mikel Oyarzabal: 1+ goals")).toBe("Mikel Oyarzabal");
  });

  it("matches Kalshi GOAL markets by name with a unique last-name fallback", () => {
    const markets: KalshiMarket[] = [
      { ticker: "KXWCGOAL-26JUL10ESPBEL-ESPMOYARZ10-1", title: "Mikel Oyarzabal: 1+ goals", yesMid: 0.4 },
      { ticker: "KXWCGOAL-26JUL10ESPBEL-ESPMOYARZ10-2", title: "Mikel Oyarzabal: 2+ goals", yesMid: 0.1 },
      { ticker: "KXWCGOAL-26JUL10ESPBEL-BELRLUKAK9-1", title: "R. Lukaku: 1+ goals", yesMid: 0.3 }, // last-name fallback
      { ticker: "KXWCGOAL-26JUL10ESPBEL-BELGHOST5-1", title: "Ghost Player: 1+ goals", yesMid: 0.2 }, // unmatched
      { ticker: "KXWCTOTAL-26JUL10ESPBEL-4", title: "Will over 3.5 goals be scored?", yesMid: 0.3 },
    ];
    const { players, unmatched } = matchScorerMarkets(markets, deriveShares(xi), "ESP");
    expect(players.map((p) => p.code).sort()).toEqual(["BELRLUKAK9", "ESPMOYARZ10"]);
    const oyar = players.find((p) => p.code === "ESPMOYARZ10")!;
    expect(oyar.teamSide).toBe("home");
    expect(oyar.share).toBeCloseTo(6 / 12.1, 12);
    const lukaku = players.find((p) => p.code === "BELRLUKAK9")!;
    expect(lukaku.teamSide).toBe("away");
    expect(lukaku.name).toBe("Romelu Lukaku");
    expect(unmatched).toEqual(["Ghost Player"]);
  });
});
