import { describe, expect, it } from "vitest";
import { inspectSlipV3, type SlipRecordV3 } from "../scripts/parlay-inspector-v3.mts";
import {
  ENGINE_VERSION_V3, V3_CONSTRAINTS,
  candidateLegsV3, legProbV3, legReasoningV3, selectSlipV3,
  type PlayerShare,
} from "../lib/parlay-v3";
import { Q_FIRST_HALF, halfLattice } from "../lib/parlay-v2";
import { scoreGrid } from "../lib/poisson-model";
import type { KalshiMarket } from "../lib/parlay";

const mkV3 = (ticker: string, yesMid: number | null, title: string): KalshiMarket => ({ ticker, title, yesMid });

const ctx = { homeAbbr: "FRA", awayAbbr: "MAR" };
const lambdas = { home: 1.4, away: 0.9 };
const rho = -0.05;
const et = 0.62;
const PLAYERS: PlayerShare[] = [
  { code: "FRAKMBAP10", name: "Kylian Mbappé", teamSide: "home", share: 0.6 },
];
const snapshot = {
  markets: [
    mkV3("KXWCGAME-26JUL09FRAMAR-FRA", 0.45, "France vs Morocco Winner?"),
    mkV3("KXWCTOTAL-26JUL09FRAMAR-2", 0.6, "Will over 1.5 goals be scored?"),
    mkV3("KXWCTOTAL-26JUL09FRAMAR-3", 0.45, "Will over 2.5 goals be scored?"),
    mkV3("KXWCBTTS-26JUL09FRAMAR-BTTS", 0.5, "Will both teams score?"),
    mkV3("KXWCADVANCE-26JUL09FRAMAR-FRA", 0.6, "France vs Morocco: To Advance"),
    mkV3("KXWCGOAL-26JUL09FRAMAR-FRAKMBAP10-1", 0.4, "Kylian Mbappé: 1+ goals"),
  ],
};

function goldenV3(): SlipRecordV3 {
  const grid = scoreGrid(lambdas.home, lambdas.away, rho);
  const lat = halfLattice(grid, Q_FIRST_HALF);
  const pm = { source: "test", lineupConfirmed: false, players: PLAYERS };
  const sel = selectSlipV3(candidateLegsV3(snapshot.markets, ctx.homeAbbr, ctx.awayAbbr, pm), lat, et, PLAYERS, V3_CONSTRAINTS);
  if (sel.verdict !== "slip") throw new Error("fixture must produce a slip");
  const legs = sel.legs.map((leg) => ({
    ticker: leg.market.ticker,
    side: leg.side,
    title: leg.market.title,
    modelProb: legProbV3(leg, lat, et, PLAYERS),
    kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
    reasoning: legReasoningV3(leg, lat, et, PLAYERS, { eloDiff: 187, homeAbbr: ctx.homeAbbr, awayAbbr: ctx.awayAbbr }),
  }));
  const usesScorer = sel.legs.some((l) => l.market.kind === "scorer");
  return {
    slug: "france-vs-morocco", engineVersion: ENGINE_VERSION_V3, lockedAt: "2026-07-09T22:00:00.000Z",
    modelDataThrough: "2026-07-09", eloDiff: 187, lambdas, rho, etWinProbHome: et, qFirstHalf: Q_FIRST_HALF,
    constraints: { ...V3_CONSTRAINTS, exclusiveSeries: V3_CONSTRAINTS.exclusiveSeries.map((g) => [...g]) },
    ...(usesScorer ? { playerModel: { source: "test", lineupConfirmed: false, players: PLAYERS } } : {}),
    legs, jointProb: sel.jointProb, comboImpliedProb: sel.comboImpliedProb, edge: sel.edge,
  };
}

describe("inspectSlipV3", () => {
  it("golden v3 slip passes every gate (and exercises a scorer leg)", () => {
    const s = goldenV3();
    expect(s.legs!.some((l) => l.ticker.startsWith("KXWCGOAL"))).toBe(true); // cheap scorer mid → in slip
    expect(inspectSlipV3(s, snapshot, ctx)).toEqual([]);
  });

  it("gate8: wrong engine version", () => {
    const s = { ...goldenV3(), engineVersion: "v2.1-combo" };
    expect(inspectSlipV3(s, snapshot, ctx).some((f) => f.startsWith("gate8:"))).toBe(true);
  });

  it("gate9: edge and jointProb tampering detected", () => {
    const a = goldenV3();
    a.edge = (a.edge ?? 0) + 0.02;
    expect(inspectSlipV3(a, snapshot, ctx).some((f) => f.includes("edge drift"))).toBe(true);
    const b = goldenV3();
    b.jointProb = b.jointProb! + 0.01;
    expect(inspectSlipV3(b, snapshot, ctx).some((f) => f.includes("jointProb drift"))).toBe(true);
  });

  it("gate11: exclusive series (GAME + ADVANCE) rejected via stored constraints", () => {
    const s = goldenV3();
    // splice in a fabricated extra leg from the exclusive partner series
    s.legs = [...s.legs!, {
      ticker: "KXWCADVANCE-26JUL09FRAMAR-FRA", side: "yes", title: "France vs Morocco: To Advance",
      modelProb: 0.7, kalshiMid: 0.6, reasoning: "x",
    }, {
      ticker: "KXWCGAME-26JUL09FRAMAR-FRA", side: "yes", title: "France vs Morocco Winner?",
      modelProb: 0.52, kalshiMid: 0.45, reasoning: "x",
    }];
    const fails = inspectSlipV3(s, snapshot, ctx);
    expect(fails.some((f) => f.includes("exclusive series together (KXWCGAME + KXWCADVANCE)"))).toBe(true);
  });

  it("gate10/gate2: scorer legs require a stored playerModel share", () => {
    const s = goldenV3();
    delete s.playerModel;
    const fails = inspectSlipV3(s, snapshot, ctx);
    expect(fails.some((f) => f.includes("scorer leg without stored share") || f.startsWith("gate10:"))).toBe(true);
  });

  it("v3 no-slip record needs only version + reason", () => {
    const ok: SlipRecordV3 = {
      slug: "spain-vs-belgium", engineVersion: ENGINE_VERSION_V3,
      lockedAt: "2026-07-09T22:00:00.000Z", verdict: "no-slip", reason: "no 2-4 leg subset ≥ v3 constraints",
    };
    expect(inspectSlipV3(ok, { markets: [] }, { homeAbbr: "ESP", awayAbbr: "BEL" })).toEqual([]);
  });
});
