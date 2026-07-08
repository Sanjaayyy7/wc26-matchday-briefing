// Parlay engine: Kalshi markets → grid predicates → exact joint probability →
// confidence-tiered hit-max selection → templated reasoning. Pure, no I/O.
// Pre-registered: LEG_FLOOR=0.60, JOINT_FLOOR=0.35, REDUNDANCY_CAP=0.97,
// MAX_LEGS=5, min 2 legs; ties broken by ticker; Kalshi mids display-only.

export type KalshiMarket = { ticker: string; title: string; yesMid: number | null };
export type GridPredicate = (h: number, a: number) => boolean;
export type ParsedMarket =
  | { kind: "reg"; ticker: string; title: string; yesMid: number | null; pred: GridPredicate }
  | { kind: "advance"; ticker: string; title: string; yesMid: number | null; advanceSide: "home" | "away" };

/** Suffix after the event code, e.g. "FRA2", "TIE", "3", "FRA3MAR0", "BTTS". */
const suffixOf = (ticker: string): string => ticker.split("-").pop() ?? "";
const seriesOf = (ticker: string): string => ticker.split("-")[0] ?? "";

export function parseMarket(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarket | null {
  const s = suffixOf(m.ticker);
  const base = { ticker: m.ticker, title: m.title, yesMid: m.yesMid };
  switch (seriesOf(m.ticker)) {
    case "KXWCGAME": {
      if (s === homeAbbr) return { ...base, kind: "reg", pred: (h, a) => h > a };
      if (s === awayAbbr) return { ...base, kind: "reg", pred: (h, a) => a > h };
      if (s === "TIE") return { ...base, kind: "reg", pred: (h, a) => h === a };
      return null;
    }
    case "KXWCSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", pred: (h, a) => h - a >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", pred: (h, a) => a - h >= margin };
      return null;
    }
    case "KXWCTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", pred: (h, a) => h + a >= n };
    }
    case "KXWCTEAMTOTAL": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const n = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", pred: (h) => h >= n };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", pred: (_h, a) => a >= n };
      return null;
    }
    case "KXWCBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", pred: (h, a) => h > 0 && a > 0 } : null;
    case "KXWCSCORE": {
      const tie = s.match(/^TIE(\d)$/);
      if (tie) {
        const n = Number(tie[1]);
        return { ...base, kind: "reg", pred: (h, a) => h === n && a === n };
      }
      const mm = s.match(/^([A-Z]+)(\d)([A-Z]+)(\d)$/);
      if (!mm) return null;
      const [, t1, g1, t2, g2] = mm;
      const hg = t1 === homeAbbr ? Number(g1) : t2 === homeAbbr ? Number(g2) : null;
      const ag = t1 === awayAbbr ? Number(g1) : t2 === awayAbbr ? Number(g2) : null;
      if (hg === null || ag === null) return null;
      return { ...base, kind: "reg", pred: (h, a) => h === hg && a === ag };
    }
    case "KXWCADVANCE": {
      if (s === homeAbbr) return { ...base, kind: "advance", advanceSide: "home" };
      if (s === awayAbbr) return { ...base, kind: "advance", advanceSide: "away" };
      return null;
    }
    default:
      return null; // player props, corners, mentions, unknown: unpriceable
  }
}

export type CandidateLeg = { market: ParsedMarket; side: "yes" | "no" };

/** Exact probability over the 90' score grid. Advance legs resolve win/loss
 *  cells by sign and draw cells by the shared ET Bernoulli (etWinProbHome) —
 *  a slip's advance demands must agree on the draw branch or that branch is 0. */
export function jointProb(legs: CandidateLeg[], grid: number[][], etWinProbHome: number): number {
  let p = 0;
  for (let h = 0; h < grid.length; h++) {
    for (let a = 0; a < grid.length; a++) {
      const mass = grid[h][a];
      if (mass === 0) continue;
      let pass = true;
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          if (leg.market.pred(h, a) !== (leg.side === "yes")) { pass = false; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (h > a && !wantsHome) { pass = false; break; }
          if (h < a && wantsHome) { pass = false; break; }
          if (h === a) {
            const f = wantsHome ? etWinProbHome : 1 - etWinProbHome;
            if (advFactor === null) advFactor = f;
            else if (advFactor !== f) { pass = false; break; }
          }
        }
      }
      if (pass) p += mass * (advFactor ?? 1);
    }
  }
  return p;
}

export function legProb(leg: CandidateLeg, grid: number[][], etWinProbHome: number): number {
  return jointProb([leg], grid, etWinProbHome);
}

export const LEG_FLOOR = 0.6;
export const JOINT_FLOOR = 0.35;
export const REDUNDANCY_CAP = 0.97;
export const MAX_LEGS = 5;

export type Selection =
  | { verdict: "slip"; legs: CandidateLeg[]; jointProb: number }
  | { verdict: "no-slip"; reason: string };

const legOrder = (a: { leg: CandidateLeg; p: number }, b: { leg: CandidateLeg; p: number }): number =>
  b.p - a.p ||
  a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
  a.leg.side.localeCompare(b.leg.side);

/** Confidence-tiered hit-max (pre-registered): greedy on conditional
 *  probability, capped for redundancy, floored on leg + joint. Deterministic. */
export function selectSlip(candidates: CandidateLeg[], grid: number[][], etWinProbHome: number): Selection {
  const eligible = candidates
    .map((leg) => ({ leg, p: legProb(leg, grid, etWinProbHome) }))
    .filter((c) => c.p >= LEG_FLOOR)
    .sort(legOrder);
  if (eligible.length < 2) return { verdict: "no-slip", reason: "no 2-leg combo ≥ floors" };

  const slip: CandidateLeg[] = [eligible[0].leg];
  let joint = eligible[0].p;
  let pool = eligible.slice(1);

  while (slip.length < MAX_LEGS && pool.length > 0) {
    const scored = pool
      .map((c) => {
        const j = jointProb([...slip, c.leg], grid, etWinProbHome);
        return { ...c, j, conditional: j / joint };
      })
      .filter((c) => c.conditional <= REDUNDANCY_CAP && c.j >= JOINT_FLOOR)
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

  if (slip.length < 2) return { verdict: "no-slip", reason: "no 2-leg combo ≥ floors" };
  return { verdict: "slip", legs: slip, jointProb: joint };
}
