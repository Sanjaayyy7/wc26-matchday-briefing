// Lock pre-kickoff model predictions (with a best-effort Kalshi snapshot)
// into data/predictions.json. Existing locks are never touched.
//
//   npm run pipeline:lock
import { readFileSync, writeFileSync, existsSync } from "node:fs";
import path from "node:path";
import { lockNew, type LockedEntry } from "../lib/predictions-ledger";
import { predictFixture } from "../lib/predict";
import { deVig, type Split } from "../lib/calibration";
import { appDir, fixtures, teams, kalshiEventTicker, type FixtureRow } from "./shared.mts";

const API = "https://api.elections.kalshi.com/trade-api/v2";
const HOSTS = ["United States", "Canada", "Mexico"];

const ledgerPath = path.join(appDir, "data", "predictions.json");
const existing: LockedEntry[] = existsSync(ledgerPath)
  ? JSON.parse(readFileSync(ledgerPath, "utf8")).entries
  : [];

const teamName = (id: string) => teams().find((t) => t.id === id)?.name ?? id;

async function fetchMarket(
  f: FixtureRow,
): Promise<{ market: Split; ticker: string } | undefined> {
  try {
    const ticker = kalshiEventTicker(f);
    const res = await fetch(`${API}/markets?event_ticker=${ticker}`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return undefined;
    const { markets } = (await res.json()) as {
      markets: Array<{ ticker: string; yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }>;
    };
    if (!markets?.length) return undefined;
    const mid = (m: (typeof markets)[number]): number => {
      const bid = Number(m.yes_bid_dollars ?? "0");
      const ask = Number(m.yes_ask_dollars ?? "0");
      if (bid > 0 && ask > 0) return (bid + ask) / 2;
      return Number(m.last_price_dollars ?? "0");
    };
    const find = (suffix: string) => markets.find((x) => x.ticker.endsWith(`-${suffix}`));
    const h = find(f.homeId.toUpperCase());
    const t = find("TIE");
    const a = find(f.awayId.toUpperCase());
    if (!h || !t || !a) return undefined;
    const raw = { home: mid(h), draw: mid(t), away: mid(a) };
    if (raw.home <= 0 || raw.draw <= 0 || raw.away <= 0) return undefined;
    return { market: deVig(raw), ticker };
  } catch {
    return undefined; // markets are a bonus, never a blocker
  }
}

const all = fixtures();
const now = new Date();
const unlockedFuture = all.filter(
  (f) =>
    !existing.some((e) => e.slug === f.slug) &&
    new Date(f.kickoffISO).getTime() > now.getTime(),
);

// Pre-fetch markets (parallel batches of 8) for the fixtures we're about to lock.
const marketBySlug = new Map<string, { market: Split; ticker: string }>();
for (let i = 0; i < unlockedFuture.length; i += 8) {
  const batch = unlockedFuture.slice(i, i + 8);
  const results = await Promise.all(batch.map((f) => fetchMarket(f)));
  results.forEach((r, j) => {
    if (r) marketBySlug.set(batch[j].slug, r);
  });
}

const entries = lockNew(
  existing,
  all,
  (slug) => {
    const f = all.find((x) => x.slug === slug)!;
    const home = teamName(f.homeId);
    const p = predictFixture({
      home,
      away: teamName(f.awayId),
      neutral: !HOSTS.includes(home),
      stage: f.stage ?? "group",
    });
    const m = marketBySlug.get(slug);
    return {
      split: p.split,
      mostLikely: p.summary.mostLikely,
      ...(m ? { market: m.market, marketTicker: m.ticker } : {}),
    };
  },
  now,
);

writeFileSync(ledgerPath, JSON.stringify({ entries }, null, 1));
const withMarket = entries.filter((e) => e.market).length;
console.log(
  `locked ${entries.length - existing.length} new (total ${entries.length}, ${withMarket} with Kalshi snapshots)`,
);
