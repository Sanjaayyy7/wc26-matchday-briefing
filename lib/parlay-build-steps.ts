// App-style build instructions per leg — mirrors the Kalshi combo builder's
// category names so a slip can be assembled leg-by-leg without guesswork.
import { seriesOf } from "./parlay-v2";

const CATEGORY: Record<string, string> = {
  KXWCGAME: "Regulation Time Moneyline",
  KXWCSPREAD: "Spread",
  KXWCTOTAL: "Point Total",
  KXWCBTTS: "BTTS",
  KXWC1H: "1st Half Winner",
  KXWC1HSPREAD: "1st Half Spread",
  KXWC1HTOTAL: "1st Half Total",
  KXWC1HBTTS: "1st Half BTTS",
  KXWCADVANCE: "Full Match: To Advance",
  KXWCGOAL: "Full Match: Goalscorers",
};

const cap = (s: string): string => (s === "yes" ? "Yes" : "No");

/** "Point Total → 5.5 → No", "Spread → BEL 2.5 → No",
 *  "Full Match: Goalscorers → Kylian Mbappé 1+ → Yes". */
export function buildStep(leg: { ticker: string; side: "yes" | "no"; title: string }): string {
  const series = seriesOf(leg.ticker);
  const category = CATEGORY[series] ?? series;
  const suffix = leg.ticker.split("-").pop() ?? "";
  let pick = suffix;
  if (series === "KXWCTOTAL" || series === "KXWC1HTOTAL") {
    pick = `${Number(suffix) - 0.5}`;
  } else if (series === "KXWCSPREAD" || series === "KXWC1HSPREAD") {
    const m = suffix.match(/^([A-Z]+)(\d)$/);
    pick = m ? `${m[1]} ${Number(m[2]) - 0.5}` : suffix;
  } else if (series === "KXWCBTTS" || series === "KXWC1HBTTS") {
    pick = "Both score";
  } else if (series === "KXWCGOAL") {
    const parts = leg.ticker.split("-");
    const k = parts.length === 4 ? parts[3] : "1";
    pick = `${leg.title.split(":")[0].trim()} ${k}+`;
  }
  return `${category} → ${pick} → ${cap(leg.side)}`;
}
