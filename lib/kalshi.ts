export type KalshiMarket = {
  ticker: string;
  status: string;
  result: string;
  settlement_ts?: string;
  yes_sub_title?: string;
  no_sub_title?: string;
};

export type ResolutionResult = {
  status: "settled" | "open";
  home: 0 | 1;
  draw: 0 | 1;
  away: 0 | 1;
  settledTime?: string;
};

export type MarketsResponse = {
  markets: KalshiMarket[];
};

/**
 * Pure parser: maps a Kalshi markets API response to a resolution result.
 *
 * Ticker suffix convention (confirmed from real API responses):
 *   - Home team: uppercase homeId (e.g. "MEX", "USA", "KOR")
 *   - Away team: uppercase awayId (e.g. "RSA", "PAR", "CZE")
 *   - Draw/Tie:  "TIE"
 *
 * A market is settled when ALL markets have status "finalized".
 * The winning outcome has result="yes"; losers have result="no".
 *
 * @param response - raw API response with markets array
 * @param homeId   - fixture homeId (lowercase, e.g. "mex")
 * @param awayId   - fixture awayId (lowercase, e.g. "rsa")
 */
export function parseKalshiResolution(
  response: MarketsResponse,
  homeId: string,
  awayId: string,
): ResolutionResult {
  const { markets } = response;

  if (!markets || markets.length === 0) {
    return { status: "open", home: 0, draw: 0, away: 0 };
  }

  const allFinalized = markets.every((m) => m.status === "finalized");
  if (!allFinalized) {
    return { status: "open", home: 0, draw: 0, away: 0 };
  }

  const homeCode = homeId.toUpperCase();
  const awayCode = awayId.toUpperCase();

  const find = (suffix: string): KalshiMarket | undefined =>
    markets.find((m) => m.ticker.endsWith(`-${suffix}`));

  const homeMarket = find(homeCode);
  const drawMarket = find("TIE");
  const awayMarket = find(awayCode);

  const isWin = (m: KalshiMarket | undefined): 0 | 1 =>
    m?.result === "yes" ? 1 : 0;

  // settlement_ts is consistent across all markets in an event — use first found
  const settledTime =
    markets.find((m) => m.settlement_ts)?.settlement_ts;

  return {
    status: "settled",
    home: isWin(homeMarket),
    draw: isWin(drawMarket),
    away: isWin(awayMarket),
    settledTime,
  };
}
