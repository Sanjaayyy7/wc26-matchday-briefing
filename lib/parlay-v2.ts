// Parlay engine v2 — combo-eligible universe only. Pure, no I/O.
// Every leg must be purchasable inside one Kalshi combo ticket (user-verified
// combo-builder constraints, 2026-07-08). Pre-registered: Q_FIRST_HALF=0.45,
// LEG floor 0.75, JOINT floor 0.60, 2-4 legs, REDUNDANCY_CAP shared with v1.
// 3-way moneylines are YES-only (the combo builder offers one price per outcome).
import type { KalshiMarket } from "./parlay";

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
