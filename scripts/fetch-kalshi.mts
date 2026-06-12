// Fetch the Kalshi 3-way match book for a fixture and write a de-vigged
// MARKET_SNAPSHOT artifact. Public API, no auth.
//
//   npm run pipeline:fetch -- <fixture-slug>
import { writeFileSync } from "node:fs";
import path from "node:path";
import { deVig } from "../lib/calibration";
import { fixtureBySlugOrDie, kalshiEventTicker, outDir, teams } from "./shared.mts";

const API = "https://api.elections.kalshi.com/trade-api/v2";

type KalshiMarket = {
  ticker: string;
  yes_bid_dollars?: string;
  yes_ask_dollars?: string;
  last_price_dollars?: string;
  volume_fp?: string;
  status: string;
};

function mid(m: KalshiMarket): number {
  const bid = Number(m.yes_bid_dollars ?? "0");
  const ask = Number(m.yes_ask_dollars ?? "0");
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  const last = Number(m.last_price_dollars ?? "0");
  if (last > 0) return last;
  throw new Error(`no usable price on ${m.ticker}`);
}

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pipeline:fetch -- <fixture-slug>");
  process.exit(1);
}
const fixture = fixtureBySlugOrDie(slug);
const eventTicker = kalshiEventTicker(fixture);
const teamName = (id: string) => teams().find((t) => t.id === id)?.name ?? id;

const res = await fetch(`${API}/markets?event_ticker=${eventTicker}`);
if (!res.ok) {
  console.error(`Kalshi ${res.status} for ${eventTicker}`);
  process.exit(1);
}
const { markets } = (await res.json()) as { markets: KalshiMarket[] };
if (!markets?.length) {
  console.error(`No markets for ${eventTicker}`);
  process.exit(1);
}

const homeCode = fixture.homeId.toUpperCase();
const awayCode = fixture.awayId.toUpperCase();
const byOutcome = (suffix: string) => {
  const m = markets.find((x) => x.ticker.endsWith(`-${suffix}`));
  if (!m) throw new Error(`missing ${suffix} market in ${eventTicker}`);
  return m;
};

const raw = {
  home: mid(byOutcome(homeCode)),
  draw: mid(byOutcome("TIE")),
  away: mid(byOutcome(awayCode)),
};
const probs = deVig(raw);
const fetchedAt = new Date().toISOString();
const pct = (x: number) => Math.round(x * 100);

const snapshot = {
  fixture: slug,
  eventTicker,
  fetchedAt,
  rawMid: raw,
  deVigged: probs,
  markets: markets.map((m) => ({
    ticker: m.ticker,
    yes_bid_dollars: m.yes_bid_dollars,
    yes_ask_dollars: m.yes_ask_dollars,
    last_price_dollars: m.last_price_dollars,
    volume_fp: m.volume_fp,
    status: m.status,
  })),
};

const dir = outDir(slug);
writeFileSync(path.join(dir, "market.json"), JSON.stringify(snapshot, null, 2));
const line =
  `${teamName(fixture.homeId)} ${pct(probs.home)}% / Draw ${pct(probs.draw)}% / ` +
  `${teamName(fixture.awayId)} ${pct(probs.away)}% ` +
  `(Kalshi ${eventTicker}, de-vigged mid, fetched ${fetchedAt}; 90-minute result, ET/pens excluded)`;
writeFileSync(path.join(dir, "market.md"), line + "\n");
console.log(`wrote ${dir}/market.{json,md}`);
console.log(line);
