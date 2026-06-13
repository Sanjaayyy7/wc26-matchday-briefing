/**
 * Pure parsing utilities for Polymarket Gamma API per-match events.
 *
 * Structure: each WC26 match is a `negRisk` event with 3 binary markets:
 *   - Home win: slug suffix `<home-code>` (e.g. "mex")
 *   - Draw:     slug suffix "draw"
 *   - Away win: slug suffix `<away-code>` (e.g. "rsa")
 *
 * `outcomePrices` is a JSON-encoded string: `"[\"0.65\", \"0.35\"]"`
 *   Index 0 = "Yes" price (0..1). Use `lastTradePrice` as primary price source;
 *   `outcomePrices[0]` is the fallback.
 *
 * Resolution: when `closed=true` and `umaResolutionStatus="resolved"`, the
 *   winning market has `outcomePrices[0]` ≈ 1 (or `lastTradePrice` ≈ 0.999).
 *
 * De-vig: the 3 yes-prices form an overround book (sum > 1 pre-match); we
 *   normalize them to sum to exactly 1.
 */

export type ProbSplit = { home: number; draw: number; away: number };
export type ResolvedSplit = { home: 0 | 1; draw: 0 | 1; away: 0 | 1 };

export type PolymarketMatchResult = {
  slug: string;
  probs: ProbSplit | null;
  resolved: ResolvedSplit | null;
  negRiskMarketID: string | null;
  raw: Record<string, unknown>;
};

type RawMarket = {
  slug?: string;
  groupItemTitle?: string;
  outcomePrices?: string;
  lastTradePrice?: number;
  closed?: boolean;
  umaResolutionStatus?: string | null;
};

type RawEvent = {
  slug?: string;
  closed?: boolean;
  negRiskMarketID?: string;
  markets?: RawMarket[];
  [key: string]: unknown;
};

/** Extract the yes-price from a market, preferring lastTradePrice over outcomePrices[0]. */
function yesPrice(m: RawMarket): number | null {
  if (typeof m.lastTradePrice === "number" && m.lastTradePrice > 0) {
    return m.lastTradePrice;
  }
  if (typeof m.outcomePrices === "string") {
    try {
      const prices = JSON.parse(m.outcomePrices) as string[];
      const p = parseFloat(prices[0]);
      if (!isNaN(p)) return p;
    } catch {
      // fall through
    }
  }
  return null;
}

/**
 * Identify the home, draw, and away markets within a negRisk event.
 *
 * Primary: match slug suffix against homePolyCode/awayPolyCode (Polymarket
 *   team codes, which may differ from our clubs.json IDs — e.g. "kor" for
 *   South Korea vs Polymarket's "kr"; "cur" for Curaçao vs Polymarket's "kor").
 * Fallback: look at `groupItemTitle` — draw title contains "Draw"; remaining
 *   non-draw markets are assigned home/away in document order.
 */
function findMarkets(
  markets: RawMarket[],
  homePolyCode: string,
  awayPolyCode: string,
): { home: RawMarket | null; draw: RawMarket | null; away: RawMarket | null } {
  const homeCode = homePolyCode.toLowerCase();
  const awayCode = awayPolyCode.toLowerCase();

  // Slug-suffix matching: event slug is e.g. "fifwc-mex-rsa-2026-06-11"
  // market slugs: "fifwc-mex-rsa-2026-06-11-mex", "-draw", "-rsa"
  const bySuffix = (code: string) =>
    markets.find((m) => m.slug?.endsWith(`-${code}`)) ?? null;

  let home = bySuffix(homeCode);
  let draw = bySuffix("draw");
  let away = bySuffix(awayCode);

  // Fallback: groupItemTitle heuristic
  if (!home || !draw || !away) {
    for (const m of markets) {
      const t = m.groupItemTitle?.toLowerCase() ?? "";
      if (!draw && t.startsWith("draw")) draw = m;
      else if (!home && !t.startsWith("draw")) home = m;
      else if (!away && !t.startsWith("draw") && m !== home) away = m;
    }
  }

  return { home, draw, away };
}

/**
 * Parse a Polymarket Gamma API event JSON into a normalized match result.
 *
 * @param eventJson     - raw event object from Gamma API (`/events?slug=...`)
 * @param homeId        - fixture homeId (lowercase, matches clubs.json)
 * @param awayId        - fixture awayId (lowercase, matches clubs.json)
 * @param homePolyCode  - optional Polymarket market-slug code for home team
 *                        (defaults to homeId; override when codes differ, e.g.
 *                         homeId="kor" → homePolyCode="kr")
 * @param awayPolyCode  - optional Polymarket market-slug code for away team
 */
export function parsePolymarketMatch(
  eventJson: Record<string, unknown>,
  homeId: string,
  awayId: string,
  homePolyCode?: string,
  awayPolyCode?: string,
): PolymarketMatchResult {
  const event = eventJson as RawEvent;
  const markets = event.markets ?? [];

  const base: PolymarketMatchResult = {
    slug: event.slug ?? "",
    probs: null,
    resolved: null,
    negRiskMarketID: event.negRiskMarketID ?? null,
    raw: eventJson,
  };

  if (markets.length === 0) return base;

  const { home: hm, draw: dm, away: am } = findMarkets(
    markets,
    homePolyCode ?? homeId,
    awayPolyCode ?? awayId,
  );
  if (!hm || !dm || !am) return base;

  const hp = yesPrice(hm);
  const dp = yesPrice(dm);
  const ap = yesPrice(am);

  if (hp === null || dp === null || ap === null) return base;

  // De-vig: normalize yes-prices to sum to 1
  const total = hp + dp + ap;
  if (total <= 0) return base;

  base.probs = {
    home: hp / total,
    draw: dp / total,
    away: ap / total,
  };

  // Resolution: event closed AND at least one market resolved via UMA
  const isResolved =
    event.closed === true &&
    markets.some((m) => m.umaResolutionStatus === "resolved");

  if (isResolved) {
    // Winning market has yes-price ≈ 1 (Polymarket settles to 0.999/0.001)
    const WIN_PRICE_THRESHOLD = 0.9; // settlement price is ~0.999; 0.9 safely clears pre-match highs
    const isWin = (p: number): 0 | 1 => (p >= WIN_PRICE_THRESHOLD ? 1 : 0);
    base.resolved = {
      home: isWin(hp),
      draw: isWin(dp),
      away: isWin(ap),
    };
  }

  return base;
}
