// Parlay engine v2 — combo-eligible universe only. Pure, no I/O.
// Every leg must be purchasable inside one Kalshi combo ticket (user-verified
// combo-builder constraints, 2026-07-08). Pre-registered: Q_FIRST_HALF=0.45,
// LEG floor 0.75, JOINT floor 0.60, 2-4 legs, REDUNDANCY_CAP shared with v1.
// 3-way moneylines are YES-only (the combo builder offers one price per outcome).
import { REDUNDANCY_CAP, type KalshiMarket } from "./parlay";

export const ENGINE_VERSION_V2 = "v2-combo";
export const Q_FIRST_HALF = 0.45;
export const V2_FLOORS = { leg: 0.75, joint: 0.6, maxLegs: 4 } as const;
export type V2Floors = { leg: number; joint: number; maxLegs: number };

export const COMBO_SERIES = [
  "KXWCGAME", "KXWCSPREAD", "KXWCTOTAL", "KXWCBTTS",
  "KXWC1H", "KXWC1HSPREAD", "KXWC1HTOTAL", "KXWC1HBTTS",
  "KXWCADVANCE",
] as const;
export const YES_ONLY_SERIES = new Set<string>(["KXWCGAME", "KXWC1H"]);

export const seriesOf = (ticker: string): string => ticker.split("-")[0] ?? "";
const suffixOf = (ticker: string): string => ticker.split("-").pop() ?? "";

export type LatticePredicate = (c: { h1: number; a1: number; h: number; a: number }) => boolean;
export type ParsedMarketV2 =
  | { kind: "reg"; window: "90" | "1h"; ticker: string; title: string; yesMid: number | null; pred: LatticePredicate }
  | { kind: "advance"; window: "advance"; ticker: string; title: string; yesMid: number | null; advanceSide: "home" | "away" };
export type CandidateLegV2 = { market: ParsedMarketV2; side: "yes" | "no" };

export function parseMarketV2(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarketV2 | null {
  const s = suffixOf(m.ticker);
  const base = { ticker: m.ticker, title: m.title, yesMid: m.yesMid };
  switch (seriesOf(m.ticker)) {
    case "KXWCGAME": {
      if (s === homeAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.h > c.a };
      if (s === awayAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.a > c.h };
      if (s === "TIE") return { ...base, kind: "reg", window: "90", pred: (c) => c.h === c.a };
      return null;
    }
    case "KXWCSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.h - c.a >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.a - c.h >= margin };
      return null;
    }
    case "KXWCTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", window: "90", pred: (c) => c.h + c.a >= n };
    }
    case "KXWCBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", window: "90", pred: (c) => c.h > 0 && c.a > 0 } : null;
    case "KXWC1H": {
      if (s === homeAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 > c.a1 };
      if (s === awayAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.a1 > c.h1 };
      if (s === "TIE") return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 === c.a1 };
      return null;
    }
    case "KXWC1HSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 - c.a1 >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.a1 - c.h1 >= margin };
      return null;
    }
    case "KXWC1HTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 + c.a1 >= n };
    }
    case "KXWC1HBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 > 0 && c.a1 > 0 } : null;
    case "KXWCADVANCE": {
      if (s === homeAbbr) return { ...base, kind: "advance", window: "advance", advanceSide: "home" };
      if (s === awayAbbr) return { ...base, kind: "advance", window: "advance", advanceSide: "away" };
      return null;
    }
    default:
      return null; // combo-ineligible or unmodeled: structurally unpriceable
  }
}

/** Candidate legs under combo rules: YES everywhere, NO except 3-way moneylines. */
export function candidateLegsV2(markets: KalshiMarket[], homeAbbr: string, awayAbbr: string): CandidateLegV2[] {
  const out: CandidateLegV2[] = [];
  for (const m of markets) {
    const parsed = parseMarketV2(m, homeAbbr, awayAbbr);
    if (!parsed) continue;
    out.push({ market: parsed, side: "yes" });
    if (!YES_ONLY_SERIES.has(seriesOf(parsed.ticker))) out.push({ market: parsed, side: "no" });
  }
  return out;
}

export type LatticeCell = { h1: number; a1: number; h: number; a: number; mass: number };

/** C(n,k)·q^k·(1−q)^(n−k) for k = 0..n, Pascal recurrence; exact at q = 0 and 1. */
export function binomRow(n: number, q: number): number[] {
  if (q <= 0) return Array.from({ length: n + 1 }, (_, k) => (k === 0 ? 1 : 0));
  if (q >= 1) return Array.from({ length: n + 1 }, (_, k) => (k === n ? 1 : 0));
  const row: number[] = [(1 - q) ** n];
  for (let k = 1; k <= n; k++) row.push(row[k - 1] * ((n - k + 1) / k) * (q / (1 - q)));
  return row;
}

/** 4-dim half-split lattice: DC grid stays ground truth; each goal lands in the
 *  first half independently with probability q (spec §3, Q_FIRST_HALF pre-registered). */
export function halfLattice(grid: number[][], q: number): LatticeCell[] {
  const cells: LatticeCell[] = [];
  for (let h = 0; h < grid.length; h++) {
    const bh = binomRow(h, q);
    for (let a = 0; a < grid.length; a++) {
      const mass = grid[h][a];
      if (mass === 0) continue;
      const ba = binomRow(a, q);
      for (let h1 = 0; h1 <= h; h1++)
        for (let a1 = 0; a1 <= a; a1++) cells.push({ h1, a1, h, a, mass: mass * bh[h1] * ba[a1] });
    }
  }
  return cells;
}

/** Exact joint over the lattice. Advance legs: win/loss cells by FT sign, draw
 *  cells by the shared ET Bernoulli — same convention as the v1 engine. */
export function jointProbV2(legs: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number): number {
  let p = 0;
  for (const c of lattice) {
    let pass = true;
    let advFactor: number | null = null;
    for (const leg of legs) {
      if (leg.market.kind === "reg") {
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
    if (pass) p += c.mass * (advFactor ?? 1);
  }
  return p;
}

export const legProbV2 = (leg: CandidateLegV2, lattice: LatticeCell[], etWinProbHome: number): number =>
  jointProbV2([leg], lattice, etWinProbHome);

export type SelectionV2 =
  | { verdict: "slip"; legs: CandidateLegV2[]; jointProb: number }
  | { verdict: "no-slip"; reason: string };

const NO_SLIP_V2 = { verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" } as const;

const legOrderV2 = (
  a: { leg: CandidateLegV2; p: number }, b: { leg: CandidateLegV2; p: number },
): number =>
  b.p - a.p ||
  a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
  a.leg.side.localeCompare(b.leg.side);

/** Confidence-tiered hit-max under caller-registered floors. Deterministic. */
export function selectSlipV2(
  candidates: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number, floors: V2Floors,
): SelectionV2 {
  const eligible = candidates
    .map((leg) => ({ leg, p: legProbV2(leg, lattice, etWinProbHome) }))
    .filter((c) => c.p >= floors.leg)
    .sort(legOrderV2);
  if (eligible.length < 2) return NO_SLIP_V2;

  const slip: CandidateLegV2[] = [eligible[0].leg];
  let joint = eligible[0].p;
  let pool = eligible.slice(1);

  while (slip.length < floors.maxLegs && pool.length > 0) {
    const scored = pool
      .map((c) => {
        const j = jointProbV2([...slip, c.leg], lattice, etWinProbHome);
        return { ...c, j, conditional: j / joint };
      })
      .filter((c) => c.conditional <= REDUNDANCY_CAP && c.j >= floors.joint)
      .sort(
        (a, b) =>
          b.conditional - a.conditional ||
          a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
          a.leg.side.localeCompare(b.leg.side),
      );
    if (scored.length === 0) break;
    slip.push(scored[0].leg);
    joint = scored[0].j;
    pool = pool.filter((c) => c.leg !== scored[0].leg);
  }

  if (slip.length < 2) return NO_SLIP_V2;
  return { verdict: "slip", legs: slip, jointProb: joint };
}
