// tests/parlay-inspector.test.ts
import { describe, expect, it } from "vitest";
import { inspectSlip } from "../scripts/parlay-inspector.mts";
import { scoreGrid } from "../lib/poisson-model";
import { legProb, legReasoning, parseMarket, selectSlip, type CandidateLeg, type KalshiMarket } from "../lib/parlay";

const markets: KalshiMarket[] = [
  { ticker: "KXWCGAME-26JUL09FRAMAR-FRA", title: "France vs Morocco Winner?", yesMid: 0.62 },
  { ticker: "KXWCTOTAL-26JUL09FRAMAR-1", title: "Will over 0.5 goals be scored?", yesMid: 0.9 },
  { ticker: "KXWCTEAMTOTAL-26JUL09FRAMAR-MAR2", title: "Will Morocco score over 1.5 goals?", yesMid: 0.2 },
];
const lambdas = { home: 1.4, away: 0.9 };
const rho = -0.05;
const et = 0.62;
const grid = scoreGrid(lambdas.home, lambdas.away, rho);
const ctx = { homeAbbr: "FRA", awayAbbr: "MAR" };

function buildSlip() {
  const candidates: CandidateLeg[] = markets.flatMap((m) => {
    const p = parseMarket(m, "FRA", "MAR");
    return p ? [{ market: p, side: "yes" as const }, { market: p, side: "no" as const }] : [];
  });
  const sel = selectSlip(candidates, grid, et);
  if (sel.verdict !== "slip") throw new Error("fixture must produce slip");
  const rctx = { eloDiff: 181, homeAbbr: "FRA", awayAbbr: "MAR" };
  return {
    slug: "france-vs-morocco",
    lockedAt: "2026-07-08T12:00:00Z",
    modelDataThrough: "2026-07-07",
    eloDiff: 181,
    lambdas, rho, etWinProbHome: et,
    legs: sel.legs.map((leg) => ({
      ticker: leg.market.ticker, side: leg.side, title: leg.market.title,
      modelProb: legProb(leg, grid, et),
      kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
      reasoning: legReasoning(leg, grid, et, rctx),
    })),
    jointProb: sel.jointProb,
  };
}

describe("inspectSlip", () => {
  it("clean slip passes all gates", () => {
    expect(inspectSlip(buildSlip() as never, { markets }, ctx)).toEqual([]);
  });
  it("gate 1: leg ticker missing from snapshot", () => {
    const s = buildSlip(); s.legs[0].ticker = "KXWCGAME-26JUL09FRAMAR-XXX";
    expect(inspectSlip(s as never, { markets }, ctx).some((f) => f.startsWith("gate1"))).toBe(true);
  });
  it("gate 3: tampered jointProb detected", () => {
    const s = buildSlip(); s.jointProb += 0.05;
    expect(inspectSlip(s as never, { markets }, ctx).some((f) => f.startsWith("gate3"))).toBe(true);
  });
  it("gate 5: tampered reasoning detected", () => {
    const s = buildSlip(); s.legs[0].reasoning = "France will definitely dominate this game.";
    expect(inspectSlip(s as never, { markets }, ctx).some((f) => f.startsWith("gate5"))).toBe(true);
  });
});
