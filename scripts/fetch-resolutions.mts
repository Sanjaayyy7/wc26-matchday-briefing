// Fetch Kalshi settlement resolutions for played fixtures and write
// data/markets/kalshi-resolutions.json. Public API, no auth.
//
// Handles two sources of event tickers:
//   1. Ledger entries with explicit `marketTicker` (predictions.json)
//   2. Fixtures whose kickoff has passed (derived via kalshiEventTicker())
//      — gated on kickoff date, NOT on dataset score presence
//
// Only settled (finalized) events are written to the output file.
// Idempotent: re-running overwrites deterministically.
//
//   npm run pipeline:resolutions

import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appDir, fixtures, kalshiEventTicker, type FixtureRow } from "./shared.mts";
import { parseKalshiResolution, type MarketsResponse } from "../lib/kalshi";

const API = "https://api.elections.kalshi.com/trade-api/v2";

// ---------------------------------------------------------------------------
// Script entrypoint (only runs when executed directly via tsx)
// ---------------------------------------------------------------------------

type PredictionsLedger = {
  entries: Array<{ slug: string; marketTicker?: string }>;
};

type ResolutionRecord = {
  ticker: string;
  resolved: { home: 0 | 1; draw: 0 | 1; away: 0 | 1 };
  settledTime?: string;
  _source: string;
};

async function fetchMarkets(eventTicker: string): Promise<MarketsResponse> {
  const res = await fetch(`${API}/markets?event_ticker=${eventTicker}`);
  if (!res.ok) {
    throw new Error(`Kalshi API ${res.status} for ${eventTicker}`);
  }
  return res.json() as Promise<MarketsResponse>;
}

async function main() {
  const allFixtures: FixtureRow[] = fixtures();

  // Played fixtures: kickoff date is in the past (dataset score lag must not block resolution fetch)
  const now = new Date();
  const playedFixtures = allFixtures.filter(
    (f) => new Date(f.kickoffISO) < now,
  );

  // Read predictions ledger (do NOT mutate)
  const ledgerPath = path.join(appDir, "data", "predictions.json");
  const ledger: PredictionsLedger = JSON.parse(readFileSync(ledgerPath, "utf8"));

  // Build a map from slug to explicit marketTicker from ledger
  const ledgerTickers = new Map<string, string>();
  for (const entry of ledger.entries) {
    if (entry.marketTicker) {
      ledgerTickers.set(entry.slug, entry.marketTicker);
    }
  }

  // Collect all candidate (slug, eventTicker, source) to process
  type Candidate = {
    slug: string;
    fixture: FixtureRow;
    eventTicker: string;
    source: string;
  };

  const candidates: Candidate[] = [];
  const seen = new Set<string>();

  // Source 1: explicit marketTicker entries in ledger
  for (const [slug, ticker] of ledgerTickers) {
    const fixture = allFixtures.find((f) => f.slug === slug);
    if (!fixture) {
      console.warn(`[resolutions] No fixture found for ledger slug: ${slug} — skipping`);
      continue;
    }
    seen.add(slug);
    candidates.push({ slug, fixture, eventTicker: ticker, source: "ledger" });
  }

  // Source 2: played fixtures without an explicit ledger ticker — derive ticker
  for (const fixture of playedFixtures) {
    if (seen.has(fixture.slug)) continue;
    seen.add(fixture.slug);
    const eventTicker = kalshiEventTicker(fixture);
    candidates.push({
      slug: fixture.slug,
      fixture,
      eventTicker,
      source: "derived",
    });
  }

  console.log(`[resolutions] Processing ${candidates.length} candidate(s)...`);

  const output: Record<string, ResolutionRecord> = {};

  for (const { slug, fixture, eventTicker, source } of candidates) {
    try {
      console.log(`[resolutions] Fetching ${eventTicker} (${slug}, source=${source})`);
      const marketsResponse = await fetchMarkets(eventTicker);
      const resolution = parseKalshiResolution(
        marketsResponse,
        fixture.homeId,
        fixture.awayId,
      );

      if (resolution.status !== "settled") {
        console.log(`[resolutions]   → unsettled/open, skipping`);
        continue;
      }

      const winner =
        resolution.home === 1
          ? fixture.homeId
          : resolution.away === 1
            ? fixture.awayId
            : "draw";

      console.log(
        `[resolutions]   → settled: home=${resolution.home} draw=${resolution.draw} away=${resolution.away} (winner: ${winner})`,
      );

      output[slug] = {
        ticker: eventTicker,
        resolved: {
          home: resolution.home,
          draw: resolution.draw,
          away: resolution.away,
        },
        settledTime: resolution.settledTime,
        _source: source,
      };
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.warn(`[resolutions]   → error fetching ${eventTicker}: ${msg} — skipping`);
    }
  }

  const settledCount = Object.keys(output).length;
  console.log(`[resolutions] ${settledCount} settled event(s) recorded.`);

  mkdirSync(path.join(appDir, "data", "markets"), { recursive: true });
  const outPath = path.join(appDir, "data", "markets", "kalshi-resolutions.json");
  writeFileSync(outPath, JSON.stringify(output, null, 2) + "\n");
  console.log(`[resolutions] wrote ${outPath}`);
}

const isMain =
  import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("[resolutions] Fatal error:", err);
    process.exit(1);
  });
}
