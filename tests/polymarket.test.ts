import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePolymarketMatch } from "@/lib/polymarket";

const fx = (name: string) =>
  JSON.parse(readFileSync(path.resolve(__dirname, "fixtures", name), "utf8"));

describe("parsePolymarketMatch - resolved played match (MEX vs RSA)", () => {
  const event = fx("polymarket-event.json");

  it("returns the event slug", () => {
    const result = parsePolymarketMatch(event, "mex", "rsa");
    expect(result.slug).toBe("fifwc-mex-rsa-2026-06-11");
  });

  it("parses outcomePrices JSON-encoded strings and normalizes to probs summing to 1", () => {
    const result = parsePolymarketMatch(event, "mex", "rsa");
    // Market is resolved so probs come from final prices
    if (result.probs) {
      const sum = result.probs.home + result.probs.draw + result.probs.away;
      expect(sum).toBeCloseTo(1, 5);
    }
  });

  it("returns resolved = {home:1, draw:0, away:0} for Mexico win", () => {
    const result = parsePolymarketMatch(event, "mex", "rsa");
    expect(result.resolved).not.toBeNull();
    expect(result.resolved?.home).toBe(1);
    expect(result.resolved?.draw).toBe(0);
    expect(result.resolved?.away).toBe(0);
  });

  it("includes raw event in result", () => {
    const result = parsePolymarketMatch(event, "mex", "rsa");
    expect(result.raw).toBeDefined();
    expect(result.raw.slug).toBe("fifwc-mex-rsa-2026-06-11");
  });

  it("includes negRiskMarketID as conditionId", () => {
    const result = parsePolymarketMatch(event, "mex", "rsa");
    expect(result.negRiskMarketID).toBeTruthy();
  });
});

describe("parsePolymarketMatch - open/upcoming match (no resolution)", () => {
  // Build a synthetic open event based on the real structure
  const openEvent = {
    id: "999999",
    slug: "fifwc-bra-mar-2026-06-13",
    title: "Brazil vs. Morocco",
    closed: false,
    negRisk: true,
    negRiskMarketID: "0xabcd",
    markets: [
      {
        slug: "fifwc-bra-mar-2026-06-13-bra",
        groupItemTitle: "Brazil",
        outcomePrices: '["0.65", "0.35"]',
        outcomes: '["Yes", "No"]',
        lastTradePrice: 0.65,
        closed: false,
        umaResolutionStatus: null,
      },
      {
        slug: "fifwc-bra-mar-2026-06-13-draw",
        groupItemTitle: "Draw (Brazil vs. Morocco)",
        outcomePrices: '["0.18", "0.82"]',
        outcomes: '["Yes", "No"]',
        lastTradePrice: 0.18,
        closed: false,
        umaResolutionStatus: null,
      },
      {
        slug: "fifwc-bra-mar-2026-06-13-mar",
        groupItemTitle: "Morocco",
        outcomePrices: '["0.22", "0.78"]',
        outcomes: '["Yes", "No"]',
        lastTradePrice: 0.22,
        closed: false,
        umaResolutionStatus: null,
      },
    ],
  };

  it("returns null for resolved when event is open", () => {
    const result = parsePolymarketMatch(openEvent, "bra", "mar");
    expect(result.resolved).toBeNull();
  });

  it("returns de-vigged probs for open market", () => {
    const result = parsePolymarketMatch(openEvent, "bra", "mar");
    expect(result.probs).not.toBeNull();
    if (result.probs) {
      const sum = result.probs.home + result.probs.draw + result.probs.away;
      expect(sum).toBeCloseTo(1, 5);
      // Brazil is favourite at 0.65 raw; after de-vig should still be largest
      expect(result.probs.home).toBeGreaterThan(result.probs.draw);
      expect(result.probs.home).toBeGreaterThan(result.probs.away);
    }
  });

  it("de-vigs raw prices (0.65 + 0.18 + 0.22 = 1.05 book) to sum 1", () => {
    const result = parsePolymarketMatch(openEvent, "bra", "mar");
    // raw sum = 1.05, normalized home = 0.65/1.05 ≈ 0.619
    expect(result.probs?.home).toBeCloseTo(0.65 / 1.05, 5);
    expect(result.probs?.draw).toBeCloseTo(0.18 / 1.05, 5);
    expect(result.probs?.away).toBeCloseTo(0.22 / 1.05, 5);
  });
});

describe("parsePolymarketMatch - missing or incomplete markets", () => {
  it("returns null for probs and resolved when markets array is empty", () => {
    const event = {
      id: "1",
      slug: "fifwc-foo-bar-2026-06-01",
      title: "Foo vs Bar",
      closed: false,
      markets: [],
    };
    const result = parsePolymarketMatch(event, "foo", "bar");
    expect(result.probs).toBeNull();
    expect(result.resolved).toBeNull();
  });

  it("handles JSON-string-encoded outcomePrices correctly", () => {
    const event = {
      id: "2",
      slug: "fifwc-abc-xyz-2026-06-01",
      title: "ABC vs XYZ",
      closed: false,
      markets: [
        {
          slug: "fifwc-abc-xyz-2026-06-01-abc",
          groupItemTitle: "ABC",
          outcomePrices: '["0.5", "0.5"]',
          outcomes: '["Yes", "No"]',
          lastTradePrice: 0.5,
          closed: false,
        },
        {
          slug: "fifwc-abc-xyz-2026-06-01-draw",
          groupItemTitle: "Draw (ABC vs XYZ)",
          outcomePrices: '["0.25", "0.75"]',
          outcomes: '["Yes", "No"]',
          lastTradePrice: 0.25,
          closed: false,
        },
        {
          slug: "fifwc-abc-xyz-2026-06-01-xyz",
          groupItemTitle: "XYZ",
          outcomePrices: '["0.4", "0.6"]',
          outcomes: '["Yes", "No"]',
          lastTradePrice: 0.4,
          closed: false,
        },
      ],
    };
    const result = parsePolymarketMatch(event, "abc", "xyz");
    // Should parse JSON strings correctly and de-vig
    expect(result.probs).not.toBeNull();
    if (result.probs) {
      const sum = result.probs.home + result.probs.draw + result.probs.away;
      expect(sum).toBeCloseTo(1, 5);
    }
  });
});
