// Goalscorer player model — SportsAPI Pro predicted XI + WC26 per-player
// goals/xG, derived into per-team goal shares (spec 2026-07-09 §Goalscorer).
// Pure derivation is exported for tests; fetches are cached under
// data/raw/sportsapipro/ (gitignored). API key from SPORTSAPIPRO_API_KEY only.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir } from "./shared.mts";
import { seriesOf } from "../lib/parlay-v2";
import type { KalshiMarket } from "../lib/parlay";
import type { PlayerModel, PlayerShare } from "../lib/parlay-v3";

const SAP = "https://api.sportsapipro.com/v2/football/api";
const CACHE_DIR = path.join(appDir, "data", "raw", "sportsapipro");
export const MIN_ATTACK_WEIGHT = 0.1; // registered floor for players missing stats

export type XiPlayer = {
  id: number; name: string; teamSide: "home" | "away";
  goals: number | null; xg: number | null;
};

/** A_i = goals + xG (missing → 0, floored at MIN_ATTACK_WEIGHT); shares
 *  normalize to 1 over each team's XI. */
export function deriveShares(xi: XiPlayer[]): Array<{ name: string; teamSide: "home" | "away"; share: number }> {
  const weight = (p: XiPlayer): number =>
    Math.max(MIN_ATTACK_WEIGHT, (p.goals ?? 0) + (p.xg ?? 0));
  const totals = { home: 0, away: 0 };
  for (const p of xi) totals[p.teamSide] += weight(p);
  return xi.map((p) => ({
    name: p.name, teamSide: p.teamSide,
    share: totals[p.teamSide] > 0 ? weight(p) / totals[p.teamSide] : 0,
  }));
}

/** Diacritics-insensitive, case-insensitive name key. NFD strips combining
 *  marks; the map covers letters with no decomposition (ø, ł, đ, æ, ß). */
const NON_DECOMPOSABLE: Record<string, string> = {
  "ø": "o", "Ø": "o", "ł": "l", "Ł": "l", "đ": "d", "Đ": "d",
  "æ": "ae", "Æ": "ae", "ß": "ss", "ð": "d", "Ð": "d", "þ": "th", "Þ": "th",
};
export const normalizeName = (s: string): string =>
  s.replace(/[øØłŁđĐæÆßðÐþÞ]/g, (ch) => NON_DECOMPOSABLE[ch] ?? ch)
    .normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z ]/g, "").trim();

/** Kalshi GOAL market title → player name ("Mikel Oyarzabal: 1+ goals"). */
export const scorerNameFromTitle = (title: string): string => title.split(":")[0].trim();

/** Match Kalshi GOAL markets to derived XI shares. Side comes from the ticker
 *  code prefix (team abbr); the share lookup is by normalized name (exact,
 *  then unique last-name fallback). Unmatched players are skipped (never
 *  guessed) and reported. */
export function matchScorerMarkets(
  markets: KalshiMarket[],
  shares: Array<{ name: string; teamSide: "home" | "away"; share: number }>,
  homeAbbr: string,
): { players: PlayerShare[]; unmatched: string[] } {
  const byName = new Map(shares.map((s) => [normalizeName(s.name), s]));
  const players = new Map<string, PlayerShare>();
  const unmatched: string[] = [];
  for (const m of markets) {
    if (seriesOf(m.ticker) !== "KXWCGOAL") continue;
    const parts = m.ticker.split("-");
    if (parts.length !== 4) continue;
    const code = parts[2];
    if (players.has(code)) continue;
    const name = scorerNameFromTitle(m.title);
    const key = normalizeName(name);
    let hit = byName.get(key);
    if (!hit) {
      const last = key.split(" ").pop() ?? "";
      const cands = shares.filter((s) => normalizeName(s.name).split(" ").pop() === last);
      if (cands.length === 1) hit = cands[0];
    }
    if (!hit) { unmatched.push(name); continue; }
    const teamSide: "home" | "away" = code.startsWith(homeAbbr) ? "home" : "away";
    players.set(code, { code, name: hit.name, teamSide, share: hit.share });
  }
  return { players: [...players.values()], unmatched };
}

async function getJson(url: string, apiKey: string, cacheFile: string): Promise<unknown> {
  const p = path.join(CACHE_DIR, cacheFile);
  if (existsSync(p)) return JSON.parse(readFileSync(p, "utf8"));
  const res = await fetch(url, { headers: { "x-api-key": apiKey }, signal: AbortSignal.timeout(15000) });
  if (!res.ok) throw new Error(`sportsapipro ${res.status} for ${url.replace(SAP, "")}`);
  const body = await res.json();
  mkdirSync(CACHE_DIR, { recursive: true });
  writeFileSync(p, `${JSON.stringify(body, null, 1)}\n`);
  return body;
}

type SapLineups = {
  data?: {
    confirmed?: boolean;
    home?: { players?: Array<{ player?: { id?: number; name?: string }; substitute?: boolean }> };
    away?: { players?: Array<{ player?: { id?: number; name?: string }; substitute?: boolean }> };
  };
};

/** Resolve the SportsAPI Pro matchId for a fixture by team names. */
export async function resolveSapMatchId(
  homeName: string, awayName: string, apiKey: string,
): Promise<number | null> {
  const body = (await getJson(`${SAP}/world-cup-2026/matches?page=0`, apiKey, "wc-matches-page0.json")) as {
    data?: { events?: Array<{ id?: number; homeTeam?: { name?: string }; awayTeam?: { name?: string } }> };
  };
  for (const e of body.data?.events ?? []) {
    if (e.homeTeam?.name === homeName && e.awayTeam?.name === awayName && e.id) return e.id;
  }
  return null;
}

/** Fetch predicted/confirmed XI + per-player WC26 stats, derive shares, and
 *  match them to the Kalshi GOAL markets. Returns null (with a warning) when
 *  the key or lineups are unavailable — lock degrades to the 9-series universe. */
export async function buildPlayerModel(
  sapMatchId: number, goalMarkets: KalshiMarket[], homeAbbr: string, apiKey: string,
): Promise<PlayerModel | null> {
  const lineups = (await getJson(
    `${SAP}/match/${sapMatchId}/predicted-lineups`, apiKey, `${sapMatchId}-predicted-lineups.json`,
  )) as SapLineups;
  const data = lineups.data;
  if (!data?.home?.players?.length || !data?.away?.players?.length) return null;

  const xi: XiPlayer[] = [];
  for (const teamSide of ["home", "away"] as const) {
    for (const row of data[teamSide]?.players ?? []) {
      if (row.substitute || !row.player?.id || !row.player.name) continue;
      let goals: number | null = null;
      let xg: number | null = null;
      try {
        const stats = (await getJson(
          `${SAP}/players/${row.player.id}/tournament/16/season/58210/statistics?type=overall`,
          apiKey, `player-${row.player.id}-wc26.json`,
        )) as { data?: { statistics?: { goals?: number; expectedGoals?: number } } };
        goals = stats.data?.statistics?.goals ?? null;
        xg = stats.data?.statistics?.expectedGoals ?? null;
      } catch {
        // player without tournament stats keeps the registered floor weight
      }
      xi.push({ id: row.player.id, name: row.player.name, teamSide, goals, xg });
    }
  }
  if (xi.length === 0) return null;

  const { players, unmatched } = matchScorerMarkets(goalMarkets, deriveShares(xi), homeAbbr);
  if (unmatched.length > 0) {
    console.error(`[player-model] unmatched Kalshi scorers (skipped): ${unmatched.join(", ")}`);
  }
  return {
    source: "sportsapipro predicted-lineups + WC26 player statistics (tournament 16, season 58210)",
    lineupConfirmed: data.confirmed === true,
    players,
  };
}
