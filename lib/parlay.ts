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
