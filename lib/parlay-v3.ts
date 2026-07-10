// Parlay engine v3 — value profile. Pure, no I/O.
// Pre-registered 2026-07-09 (docs/superpowers/specs/2026-07-09-parlay-v3-value-design.md):
// maximize edge = model joint − combo mid product, subject to leg band
// [0.50, 0.90], joint band [0.30, 0.60], 2–4 legs, one leg per series,
// GAME⊥ADVANCE exclusion, pairwise redundancy ≤ REDUNDANCY_CAP, edge ≥ 0.03.
// REGISTERED PRINCIPLE CHANGE: lock-time Kalshi mids rank/gate subsets here;
// model probabilities remain 100% model-derived.
// Goalscorer legs: player goals ~ Binomial(team goals, share) per lattice cell
// (exact joint with totals/spreads/ML); ET goals ignored (conservative).
import { REDUNDANCY_CAP, pct1 } from "./parlay";
import type { KalshiMarket } from "./parlay";
import {
  parseMarketV2, seriesOf, legReasoningV2,
  type CandidateLegV2, type LatticeCell, type ParsedMarketV2,
} from "./parlay-v2";

export const ENGINE_VERSION_V3 = "v3-value";

export const V3_CONSTRAINTS = {
  legMin: 0.5, legMax: 0.9, jointMin: 0.3, jointMax: 0.6,
  maxLegs: 4, minEdge: 0.03, maxLegsPerSeries: 1,
  exclusiveSeries: [["KXWCGAME", "KXWCADVANCE"]],
} as const;
export type V3Constraints = {
  legMin: number; legMax: number; jointMin: number; jointMax: number;
  maxLegs: number; minEdge: number; maxLegsPerSeries: number;
  exclusiveSeries: ReadonlyArray<ReadonlyArray<string>>;
};

export const COMBO_SERIES_V3 = [
  "KXWCGAME", "KXWCSPREAD", "KXWCTOTAL", "KXWCBTTS",
  "KXWC1H", "KXWC1HSPREAD", "KXWC1HTOTAL", "KXWC1HBTTS",
  "KXWCADVANCE", "KXWCGOAL",
] as const;
export const YES_ONLY_SERIES_V3 = new Set<string>(["KXWCGAME", "KXWC1H", "KXWCGOAL"]);

export type PlayerShare = { code: string; name: string; teamSide: "home" | "away"; share: number };
export type PlayerModel = { source: string; lineupConfirmed: boolean; players: PlayerShare[] };

export type ScorerMarket = {
  kind: "scorer"; window: "match"; ticker: string; title: string; yesMid: number | null;
  playerCode: string; k: number;
};
export type ParsedMarketV3 = ParsedMarketV2 | ScorerMarket;
export type CandidateLegV3 = { market: ParsedMarketV3; side: "yes" | "no" };

/** KXWCGOAL-26JUL10ESPBEL-ESPMOYARZ10-1 → { playerCode: "ESPMOYARZ10", k: 1 } */
export function parseMarketV3(
  m: KalshiMarket, homeAbbr: string, awayAbbr: string,
): ParsedMarketV3 | null {
  if (seriesOf(m.ticker) === "KXWCGOAL") {
    const parts = m.ticker.split("-");
    if (parts.length !== 4) return null;
    const k = Number(parts[3]);
    if (!Number.isInteger(k) || k < 1) return null;
    return {
      kind: "scorer", window: "match", ticker: m.ticker, title: m.title,
      yesMid: m.yesMid, playerCode: parts[2], k,
    };
  }
  return parseMarketV2(m, homeAbbr, awayAbbr);
}

/** Candidates under v3 combo rules: YES everywhere, NO except YES-only.
 *  Scorer markets are candidates only when the player has a stored share. */
export function candidateLegsV3(
  markets: KalshiMarket[], homeAbbr: string, awayAbbr: string, playerModel: PlayerModel | null,
): CandidateLegV3[] {
  const shares = new Map((playerModel?.players ?? []).map((p) => [p.code, p]));
  const out: CandidateLegV3[] = [];
  for (const m of markets) {
    const parsed = parseMarketV3(m, homeAbbr, awayAbbr);
    if (!parsed) continue;
    if (parsed.kind === "scorer" && !shares.has(parsed.playerCode)) continue;
    out.push({ market: parsed, side: "yes" });
    if (!YES_ONLY_SERIES_V3.has(seriesOf(parsed.ticker))) out.push({ market: parsed, side: "no" });
  }
  return out;
}

/** P(player scores ≥ k | team scored g) with goals ~ Binomial(g, share). */
export function scorerTailProb(g: number, share: number, k: number): number {
  if (k <= 0) return 1;
  if (g < k) return 0;
  const s = Math.min(1, Math.max(0, share));
  if (s === 0) return 0;
  if (s === 1) return 1; // g ≥ k already established
  // 1 − Σ_{j<k} C(g,j) s^j (1−s)^(g−j)
  let below = 0;
  let term = (1 - s) ** g; // j = 0
  for (let j = 0; j < k; j++) {
    below += term;
    term = term * ((g - j) / (j + 1)) * (s / (1 - s));
  }
  return Math.max(0, 1 - below);
}

const shareOf = (players: PlayerShare[], code: string): PlayerShare => {
  const p = players.find((x) => x.code === code);
  if (!p) throw new Error(`no stored share for scorer ${code}`);
  return p;
};

/** Exact joint over the lattice: reg legs by predicate, advance by the shared
 *  ET Bernoulli (v1/v2 convention), scorer legs by Binomial thinning of the
 *  cell's team goals (90' goals; ET goals ignored — registered). */
export function jointProbV3(
  legs: CandidateLegV3[], lattice: LatticeCell[], etWinProbHome: number, players: PlayerShare[],
): number {
  let p = 0;
  for (const c of lattice) {
    let pass = true;
    let factor = 1;
    let advFactor: number | null = null;
    for (const leg of legs) {
      if (leg.market.kind === "scorer") {
        const ps = shareOf(players, leg.market.playerCode);
        const g = ps.teamSide === "home" ? c.h : c.a;
        const tail = scorerTailProb(g, ps.share, leg.market.k);
        factor *= leg.side === "yes" ? tail : 1 - tail;
      } else if (leg.market.kind === "reg") {
        if (leg.market.pred(c) !== (leg.side === "yes")) { pass = false; break; }
      } else {
        const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
        if (c.h > c.a && !wantsHome) { pass = false; break; }
        if (c.h < c.a && wantsHome) { pass = false; break; }
        if (c.h === c.a) {
          const f = wantsHome ? etWinProbHome : 1 - etWinProbHome;
          if (advFactor === null) advFactor = f;
          else if (advFactor !== f) { pass = false; break; }
        }
      }
    }
    if (pass) p += c.mass * factor * (advFactor ?? 1);
  }
  return p;
}

export const legProbV3 = (
  leg: CandidateLegV3, lattice: LatticeCell[], etWinProbHome: number, players: PlayerShare[],
): number => jointProbV3([leg], lattice, etWinProbHome, players);

/** Side-adjusted mid product; null when any mid is missing. */
export function comboImpliedV3(legs: CandidateLegV3[]): number | null {
  let p = 1;
  for (const leg of legs) {
    const mid = leg.market.yesMid;
    if (mid === null) return null;
    p *= leg.side === "yes" ? mid : 1 - mid;
  }
  return p;
}

export type SelectionV3 =
  | { verdict: "slip"; legs: CandidateLegV3[]; jointProb: number; comboImpliedProb: number; edge: number }
  | { verdict: "no-slip"; reason: string };

const NO_SLIP_V3 = { verdict: "no-slip", reason: "no 2-4 leg subset ≥ v3 constraints" } as const;

const legKey = (l: CandidateLegV3): string => `${l.market.ticker}|${l.side}`;

/** Exhaustive edge-max under the registered v3 constraints. Deterministic. */
export function selectSlipV3(
  candidates: CandidateLegV3[], lattice: LatticeCell[], etWinProbHome: number,
  players: PlayerShare[], cons: V3Constraints,
): SelectionV3 {
  const eligible = candidates
    .map((leg) => ({ leg, p: legProbV3(leg, lattice, etWinProbHome, players) }))
    .filter((c) => c.p >= cons.legMin && c.p <= cons.legMax && c.leg.market.yesMid !== null)
    .sort((a, b) => legKey(a.leg).localeCompare(legKey(b.leg)));
  const n = eligible.length;
  if (n < 2) return NO_SLIP_V3;

  // pairwise redundancy: P(i∧j)/min(P(i),P(j)) ≤ cap
  const pairOk: boolean[][] = Array.from({ length: n }, () => Array(n).fill(true));
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const pij = jointProbV3([eligible[i].leg, eligible[j].leg], lattice, etWinProbHome, players);
      const cond = pij / Math.min(eligible[i].p, eligible[j].p);
      pairOk[i][j] = pairOk[j][i] = cond <= REDUNDANCY_CAP;
    }
  }

  const exclusive = cons.exclusiveSeries.map((g) => new Set(g));
  const compatible = (idx: number[], next: number): boolean => {
    const s = seriesOf(eligible[next].leg.market.ticker);
    let perSeries = 0;
    for (const i of idx) {
      if (!pairOk[i][next]) return false;
      const si = seriesOf(eligible[i].leg.market.ticker);
      if (si === s) perSeries += 1;
      for (const group of exclusive) {
        if (group.has(si) && group.has(s) && si !== s) return false;
      }
    }
    return perSeries < cons.maxLegsPerSeries;
  };

  let best: SelectionV3 | null = null;
  const consider = (idx: number[]): void => {
    const legs = idx.map((i) => eligible[i].leg);
    const joint = jointProbV3(legs, lattice, etWinProbHome, players);
    if (joint < cons.jointMin || joint > cons.jointMax) return;
    const implied = comboImpliedV3(legs);
    if (implied === null) return;
    const edge = joint - implied;
    if (edge < cons.minEdge) return;
    if (
      best === null || best.verdict !== "slip" || edge > best.edge ||
      (edge === best.edge && joint > best.jointProb)
    ) {
      best = { verdict: "slip", legs, jointProb: joint, comboImpliedProb: implied, edge };
    }
  };
  const extend = (idx: number[], from: number): void => {
    if (idx.length >= 2) consider(idx);
    if (idx.length === cons.maxLegs) return;
    for (let next = from; next < n; next++) {
      if (compatible(idx, next)) extend([...idx, next], next + 1);
    }
  };
  extend([], 0);
  return best ?? NO_SLIP_V3;
}

/** Deterministic scorer reasoning; reg/advance legs reuse the v2 generator. */
export function legReasoningV3(
  leg: CandidateLegV3, lattice: LatticeCell[], etWinProbHome: number, players: PlayerShare[],
  ctx: { eloDiff: number; homeAbbr: string; awayAbbr: string },
): string {
  if (leg.market.kind !== "scorer") {
    return legReasoningV2(leg as CandidateLegV2, lattice, etWinProbHome, ctx);
  }
  const ps = shareOf(players, leg.market.playerCode);
  const abbr = ps.teamSide === "home" ? ctx.homeAbbr : ctx.awayAbbr;
  const p = legProbV3(leg, lattice, etWinProbHome, players);
  return `model ${pct1(p)} — ${ps.name} carries ${pct1(ps.share)} of ${abbr} goals ` +
    `(WC26 goals + xG share); ${leg.market.k}+ via Binomial thinning of the ${abbr} goal count.`;
}
