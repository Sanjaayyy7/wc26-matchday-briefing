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

// ---- v2 ----
import { inspectSlipV2, type SlipRecordV2 } from "../scripts/parlay-inspector.mts";
import {
  ENGINE_VERSION_V2, Q_FIRST_HALF, V2_FLOORS,
  candidateLegsV2, comboImpliedProb, halfLattice, legProbV2, legReasoningV2, selectSlipV2,
} from "../lib/parlay-v2";

const mkV2 = (ticker: string, yesMid: number | null = 0.5): KalshiMarket => ({ ticker, title: `T ${ticker}`, yesMid });

describe("inspectSlipV2", () => {
  const ctxV2 = { homeAbbr: "FRA", awayAbbr: "MAR" };
  const lambdasV2 = { home: 1.4, away: 0.9 };
  const rhoV2 = -0.05;
  const etV2 = 0.62;
  const snapshotV2 = {
    markets: [
      mkV2("KXWCGAME-26JUL09FRAMAR-FRA", 0.62), mkV2("KXWCGAME-26JUL09FRAMAR-TIE", 0.25),
      mkV2("KXWCTOTAL-26JUL09FRAMAR-4", 0.12), mkV2("KXWCTOTAL-26JUL09FRAMAR-5", 0.05),
      mkV2("KXWC1HTOTAL-26JUL09FRAMAR-3", 0.1), mkV2("KXWC1HSPREAD-26JUL09FRAMAR-MAR2", 0.02),
      mkV2("KXWCSPREAD-26JUL09FRAMAR-MAR2", 0.04), mkV2("KXWCADVANCE-26JUL09FRAMAR-FRA", 0.78),
    ],
  };

  function goldenSlip(): SlipRecordV2 {
    const g = scoreGrid(lambdasV2.home, lambdasV2.away, rhoV2);
    const lat = halfLattice(g, Q_FIRST_HALF);
    const sel = selectSlipV2(candidateLegsV2(snapshotV2.markets, ctxV2.homeAbbr, ctxV2.awayAbbr), lat, etV2, V2_FLOORS);
    if (sel.verdict !== "slip") throw new Error("fixture must produce a slip");
    const legs = sel.legs.map((leg) => ({
      ticker: leg.market.ticker,
      side: leg.side,
      title: leg.market.title,
      modelProb: legProbV2(leg, lat, etV2),
      kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
      reasoning: legReasoningV2(leg, lat, etV2, { eloDiff: 187, homeAbbr: ctxV2.homeAbbr, awayAbbr: ctxV2.awayAbbr }),
    }));
    return {
      slug: "france-vs-morocco", engineVersion: ENGINE_VERSION_V2, lockedAt: "2026-07-08T18:00:00.000Z",
      modelDataThrough: "2026-07-07", eloDiff: 187, lambdas: lambdasV2, rho: rhoV2, etWinProbHome: etV2,
      qFirstHalf: Q_FIRST_HALF, floors: { ...V2_FLOORS },
      legs, jointProb: sel.jointProb, comboImpliedProb: comboImpliedProb(legs.map((l) => l.kalshiMid)),
    };
  }

  it("golden v2 slip passes every gate", () => {
    expect(inspectSlipV2(goldenSlip(), snapshotV2, ctxV2)).toEqual([]);
  });

  it("gate8 fires: combo-ineligible leg / NO on a YES-only series / too many legs", () => {
    const a = goldenSlip();
    a.legs![0] = { ...a.legs![0], ticker: "KXWCSCORE-26JUL09FRAMAR-FRA2MAR0" };
    expect(inspectSlipV2(a, snapshotV2, ctxV2).some((f) => f.startsWith("gate8:") || f.startsWith("gate1:"))).toBe(true);

    const b = goldenSlip();
    const ml = b.legs!.find((l) => l.ticker.startsWith("KXWCGAME"));
    if (ml) {
      ml.side = "no";
      expect(inspectSlipV2(b, snapshotV2, ctxV2).some((f) => f.startsWith("gate8:"))).toBe(true);
    }

    const c = goldenSlip();
    c.floors = { ...c.floors!, maxLegs: 1 };
    expect(inspectSlipV2(c, snapshotV2, ctxV2).some((f) => f.startsWith("gate8:") || f.startsWith("gate4:"))).toBe(true);
  });

  it("gate9 fires on jointProb drift and on missing qFirstHalf", () => {
    const a = goldenSlip();
    a.jointProb = a.jointProb! + 0.01;
    expect(inspectSlipV2(a, snapshotV2, ctxV2).some((f) => f.startsWith("gate3:") || f.startsWith("gate9:"))).toBe(true);

    const b = goldenSlip();
    delete b.qFirstHalf;
    expect(inspectSlipV2(b, snapshotV2, ctxV2).length).toBeGreaterThan(0);
  });

  it("gate10 fires when comboImpliedProb does not re-derive from stored mids", () => {
    const a = goldenSlip();
    a.comboImpliedProb = 0.123456;
    expect(inspectSlipV2(a, snapshotV2, ctxV2).some((f) => f.startsWith("gate10:"))).toBe(true);
  });

  it("v2 no-slip record needs reason + engineVersion", () => {
    const ok: SlipRecordV2 = { slug: "spain-vs-belgium", engineVersion: ENGINE_VERSION_V2, lockedAt: "2026-07-08T18:00:00.000Z", verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" };
    expect(inspectSlipV2(ok, { markets: [] }, { homeAbbr: "ESP", awayAbbr: "BEL" })).toEqual([]);
    const bad = { ...ok, reason: "" };
    expect(inspectSlipV2(bad, { markets: [] }, { homeAbbr: "ESP", awayAbbr: "BEL" }).length).toBeGreaterThan(0);
  });
});
