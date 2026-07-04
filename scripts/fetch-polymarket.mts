// Fetch Polymarket Gamma API per-match WC26 markets and write
// data/markets/polymarket.json. Public API, no auth.
//
// Market structure:
//   Each WC26 match is a `negRisk` event at:
//     https://gamma-api.polymarket.com/events?slug=<event-slug>
//   Event slug pattern: fifwc-<home-poly-code>-<away-poly-code>-<local-date>
//   3 binary markets per event: home win, draw, away win
//   outcomePrices: JSON-encoded strings e.g. "[\"0.65\", \"0.35\"]"
//   Resolution: closed=true + umaResolutionStatus="resolved"
//
//   npm run pipeline:polymarket

import { writeFileSync, mkdirSync, readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appDir, fixtures, type FixtureRow } from "./shared.mts";
import { parsePolymarketMatch, type ProbSplit, type ResolvedSplit } from "../lib/polymarket.ts";
import { preserveSnapshotProbs } from "../lib/market-blend";

const GAMMA_API = "https://gamma-api.polymarket.com";

// ---------------------------------------------------------------------------
// Team ID → Polymarket market-slug code mapping.
// Our clubs.json id → Polymarket's team code used in event/market slugs.
// Determined empirically from live API responses (2026-06-13).
// ---------------------------------------------------------------------------
const POLY_CODE: Record<string, string> = {
  alg: "alg",
  arg: "arg",
  aus: "aus",
  aut: "aut",
  bel: "bel",
  bih: "bih",
  bra: "bra",
  can: "can",
  cod: "cdr", // DR Congo
  col: "col",
  cpv: "cvi", // Cape Verde
  cro: "hrv", // Croatia (ISO 3166-1 alpha-3)
  cur: "kor", // Curaçao (Polymarket uses "kor" — distinct from South Korea "kr")
  cze: "cze",
  ecu: "ecu",
  egy: "egy",
  eng: "eng",
  esp: "esp",
  fra: "fra",
  ger: "ger",
  gha: "gha",
  hai: "hai",
  irn: "irn",
  irq: "irq",
  civ: "civ",  // Côte d'Ivoire
  jpn: "jpn",
  jor: "jor",
  kor: "kr",   // South Korea (Polymarket uses "kr")
  ksa: "ksa",
  mar: "mar",
  mex: "mex",
  ned: "nld",  // Netherlands (ISO 3166-1 alpha-3)
  nor: "nor",
  nzl: "nzl",
  pan: "pan",
  par: "par",
  por: "prt",  // Portugal
  qat: "qat",
  rsa: "rsa",
  sco: "sco",
  sen: "sen",
  sui: "che",  // Switzerland (ISO 3166-1 alpha-3)
  swe: "swe",
  tun: "tun",
  tur: "tur",
  usa: "usa",
  uru: "ury",  // Uruguay
  uzb: "uzb",
};

/** UTC date portion of a kickoffISO string. */
function utcDate(kickoffISO: string): string {
  return kickoffISO.slice(0, 10); // "YYYY-MM-DD"
}

// ---------------------------------------------------------------------------
// Explicit slug overrides: fixtures where Polymarket's event slug differs from
// the one derived by toPolySlug() — due to reversed home/away order, a date
// discrepancy, or an unconventional team code. Key = our fixture slug → value
// = Polymarket event slug. Determined empirically 2026-06-13.
// ---------------------------------------------------------------------------
const POLY_SLUG_OVERRIDES: Record<string, string> = {
  // UTC kickoff June 12 but game is June 11 evening in local time (CST)
  "south-korea-vs-czech-republic": "fifwc-kr-cze-2026-06-11",
  // UTC kickoff June 13 but game is June 12 evening in local time (MST)
  "united-states-vs-paraguay": "fifwc-usa-par-2026-06-12",
  // Polymarket lists as Haiti vs Scotland (not this fixture's UTC date June 14)
  "haiti-vs-scotland": "fifwc-hai-sco-2026-06-13",
  // Our home = mex, away = cze — but Polymarket lists it as Czechia vs Mexico
  "mexico-vs-czech-republic": "fifwc-cze-mex-2026-06-24",
  // Our home = can, away = sui — but Polymarket lists it as Switzerland vs Canada
  "canada-vs-switzerland": "fifwc-che-can-2026-06-24",
  // Our home = usa, away = tur — but Polymarket lists it as Türkiye vs United States
  "united-states-vs-turkiye": "fifwc-tur-usa-2026-06-25",
  // Midnight UTC kicks — local date is one day later than UTC date
  // kickoffISO 2026-06-16T00:00:00Z (UTC-7) = June 17 local
  "austria-vs-jordan": "fifwc-aut-jor-2026-06-17",
  // kickoffISO 2026-06-20T00:00:00Z (UTC-6) = June 21 local
  "tunisia-vs-japan": "fifwc-tun-jpn-2026-06-21",
};

/** Build Polymarket event slug from fixture (uses UTC date). */
function toPolySlug(f: FixtureRow): string {
  const homeCode = POLY_CODE[f.homeId] ?? f.homeId;
  const awayCode = POLY_CODE[f.awayId] ?? f.awayId;
  const date = utcDate(f.kickoffISO);
  return `fifwc-${homeCode}-${awayCode}-${date}`;
}

function polyCodesForFixture(
  f: FixtureRow,
): { homePolyCode: string; awayPolyCode: string } {
  return {
    homePolyCode: POLY_CODE[f.homeId] ?? f.homeId,
    awayPolyCode: POLY_CODE[f.awayId] ?? f.awayId,
  };
}

async function fetchEvent(slug: string): Promise<Record<string, unknown> | null> {
  const url = `${GAMMA_API}/events?slug=${slug}`;
  const res = await fetch(url);
  if (!res.ok) {
    console.warn(`[polymarket] HTTP ${res.status} for slug ${slug} — skipping`);
    return null;
  }
  const data = (await res.json()) as unknown;
  if (Array.isArray(data)) {
    return data.length > 0 ? (data[0] as Record<string, unknown>) : null;
  }
  if (data && typeof data === "object" && "id" in (data as object)) {
    return data as Record<string, unknown>;
  }
  return null;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------
type MatchEntry = {
  polymarketSlug: string;
  negRiskMarketID: string | null;
  probs: ProbSplit | null;
  resolved: ResolvedSplit | null;
  _sources: string[];
};

// ---------------------------------------------------------------------------
// Main script
// ---------------------------------------------------------------------------
async function main() {
  const allFixtures: FixtureRow[] = fixtures();
  const now = new Date();
  const checkedAt = now.toISOString();

  // Stored pre-kickoff snapshots are immutable once a match kicks off — a
  // re-fetch must never replace them with in-play/resolved (0/1-ish) prices.
  const priorPath = path.join(appDir, "data", "markets", "polymarket.json");
  const prior: Record<string, MatchEntry> = existsSync(priorPath)
    ? Object.fromEntries(
        Object.entries(
          JSON.parse(readFileSync(priorPath, "utf8")) as Record<string, MatchEntry>,
        ).filter(([k]) => !k.startsWith("_")),
      )
    : {};
  const output: Record<string, MatchEntry> = {};

  console.log(`[polymarket] Processing ${allFixtures.length} fixture(s)...`);

  let matched = 0;
  let resolved = 0;
  let upcoming = 0;
  let notFound = 0;

  for (const fixture of allFixtures) {
    const polySlug =
      POLY_SLUG_OVERRIDES[fixture.slug] ?? toPolySlug(fixture);
    const sourceUrl = `${GAMMA_API}/events?slug=${polySlug}`;

    console.log(`[polymarket] ${fixture.slug} → ${polySlug}`);
    const eventData = await fetchEvent(polySlug);

    if (!eventData) {
      console.log(`[polymarket]   → not found on Polymarket`);
      notFound++;
      continue;
    }

    const { homePolyCode, awayPolyCode } = polyCodesForFixture(fixture);
    const result = parsePolymarketMatch(
      eventData,
      fixture.homeId,
      fixture.awayId,
      homePolyCode,
      awayPolyCode,
    );

    if (!result.probs && !result.resolved) {
      console.log(`[polymarket]   → found but could not parse market prices`);
      notFound++;
      continue;
    }

    matched++;
    const isResolved = result.resolved !== null;
    const isKickedOff = new Date(fixture.kickoffISO) < now;

    if (isResolved) {
      const winner =
        result.resolved!.home === 1
          ? fixture.homeId
          : result.resolved!.away === 1
            ? fixture.awayId
            : "draw";
      console.log(`[polymarket]   → resolved: ${winner}`);
      resolved++;
    } else if (isKickedOff) {
      console.log(`[polymarket]   → in-play or awaiting resolution`);
    } else {
      console.log(
        `[polymarket]   → upcoming, probs: home=${(result.probs!.home * 100).toFixed(1)}% ` +
        `draw=${(result.probs!.draw * 100).toFixed(1)}% ` +
        `away=${(result.probs!.away * 100).toFixed(1)}%`,
      );
      upcoming++;
    }

    output[fixture.slug] = {
      polymarketSlug: polySlug,
      negRiskMarketID: result.negRiskMarketID,
      probs: preserveSnapshotProbs(prior[fixture.slug]?.probs, result.probs, isKickedOff),
      resolved: result.resolved,
      _sources: [sourceUrl],
    };
  }

  // Carry over any stored match the live API no longer returns.
  for (const [slug, entry] of Object.entries(prior)) {
    if (!(slug in output)) output[slug] = entry;
  }

  console.log(
    `[polymarket] Summary: ${matched} matched | ${resolved} resolved | ` +
    `${upcoming} upcoming snapshots | ${notFound} not found`,
  );

  mkdirSync(path.join(appDir, "data", "markets"), { recursive: true });
  const outPath = path.join(appDir, "data", "markets", "polymarket.json");

  const finalOutput = {
    _checkedAt: checkedAt,
    _source: GAMMA_API,
    _summary: {
      totalFixtures: allFixtures.length,
      matched,
      resolved,
      upcomingSnapshots: upcoming,
      notFound,
    },
    ...output,
  };

  writeFileSync(outPath, JSON.stringify(finalOutput, null, 2) + "\n");
  console.log(`[polymarket] wrote ${outPath}`);
}

// ---------------------------------------------------------------------------
// Guard: only run as main script, not when imported in tests
// ---------------------------------------------------------------------------
const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("[polymarket] Fatal error:", err);
    process.exit(1);
  });
}
