// Reads data/raw/results.csv (martj42 dataset) and patches data/fixtures.json
// with homeScore/awayScore for completed WC26 matches.
//
// Run after: npm run ml:fetch
// Run before: npm run pipeline:settle
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, teams, fixtures } from "./shared.mts";

const CSV_PATH = path.join(appDir, "data", "raw", "results.csv");
const FIXTURES_PATH = path.join(appDir, "data", "fixtures.json");

// CSV name → clubs.json name normalisations (martj42 uses different spellings)
const NAME_OVERRIDES: Record<string, string> = {
  "Bosnia and Herzegovina": "Bosnia & Herzegovina",
  "Turkey": "Türkiye",
  "Ivory Coast": "Ivory Coast",       // matches — listed explicitly for clarity
  "South Korea": "South Korea",       // matches — listed explicitly for clarity
  "DR Congo": "DR Congo",             // matches
};

// ── CSV parse ──────────────────────────────────────────────────────────────
// martj42 format: date,home_team,away_team,home_score,away_score,tournament,city,country,neutral
const raw = readFileSync(CSV_PATH, "utf8");
const lines = raw.split("\n").filter((l) => l.trim());
const headers = lines[0].split(",").map((h) => h.trim());

function parseLine(line: string): string[] {
  const vals: string[] = [];
  let cur = "";
  let inQuote = false;
  for (const ch of line) {
    if (ch === '"') {
      inQuote = !inQuote;
    } else if (ch === "," && !inQuote) {
      vals.push(cur.trim());
      cur = "";
    } else {
      cur += ch;
    }
  }
  vals.push(cur.trim());
  return vals;
}

type CsvRow = Record<string, string>;
const rows: CsvRow[] = lines.slice(1).map((l) => {
  const vals = parseLine(l);
  return Object.fromEntries(headers.map((h, i) => [h, vals[i] ?? ""]));
});

// WC26 matches only: "FIFA World Cup" tournament, date >= 2026-06-11, with real scores
const wc26 = rows.filter(
  (r) =>
    (r.tournament ?? "").includes("FIFA World Cup") &&
    r.date >= "2026-06-11" &&
    r.home_score !== "" &&
    r.home_score !== "NA" &&
    r.away_score !== "" &&
    r.away_score !== "NA" &&
    !isNaN(parseInt(r.home_score, 10)) &&
    !isNaN(parseInt(r.away_score, 10)),
);

console.log(`WC26 rows with completed scores: ${wc26.length}`);

// Build name → id map (normalized)
const teamList = teams();
const nameToId = new Map<string, string>();
for (const t of teamList) {
  nameToId.set(t.name, t.id);
}

function normalize(csvName: string): string {
  return NAME_OVERRIDES[csvName] ?? csvName;
}

// Load fixtures as mutable array
type MutableFixture = {
  id: string;
  slug: string;
  homeId: string;
  awayId: string;
  homeScore?: number;
  awayScore?: number;
  [k: string]: unknown;
};
const fixtureArr: MutableFixture[] = JSON.parse(readFileSync(FIXTURES_PATH, "utf8"));

let updated = 0;
let skipped = 0;
let noMatch = 0;

for (const result of wc26) {
  const homeNorm = normalize(result.home_team);
  const awayNorm = normalize(result.away_team);
  const homeId = nameToId.get(homeNorm);
  const awayId = nameToId.get(awayNorm);

  if (!homeId || !awayId) {
    console.warn(
      `  ⚠ no club ID for: "${result.home_team}" (→ "${homeNorm}") vs "${result.away_team}" (→ "${awayNorm}")`,
    );
    noMatch++;
    continue;
  }

  // Find fixture by homeId + awayId
  const fixture = fixtureArr.find((f) => f.homeId === homeId && f.awayId === awayId);

  if (!fixture) {
    // Try reversed (neutral-ground listings sometimes swap sides)
    const reversed = fixtureArr.find((f) => f.homeId === awayId && f.awayId === homeId);
    if (reversed) {
      if (reversed.homeScore === undefined) {
        reversed.homeScore = parseInt(result.away_score, 10);
        reversed.awayScore = parseInt(result.home_score, 10);
        updated++;
        console.log(
          `  ✓ (reversed) ${reversed.slug} → ${reversed.homeScore}-${reversed.awayScore}`,
        );
      } else {
        skipped++;
      }
    } else {
      console.warn(`  ⚠ no fixture for: ${homeId} vs ${awayId} (${result.date})`);
      noMatch++;
    }
    continue;
  }

  if (fixture.homeScore !== undefined) {
    // Already has a score — verify consistency
    const csvH = parseInt(result.home_score, 10);
    const csvA = parseInt(result.away_score, 10);
    if (fixture.homeScore !== csvH || fixture.awayScore !== csvA) {
      console.warn(
        `  ⚠ score conflict ${fixture.slug}: stored ${fixture.homeScore}-${fixture.awayScore} vs CSV ${csvH}-${csvA}`,
      );
    }
    skipped++;
    continue;
  }

  fixture.homeScore = parseInt(result.home_score, 10);
  fixture.awayScore = parseInt(result.away_score, 10);
  updated++;
  console.log(`  ✓ ${fixture.slug} → ${fixture.homeScore}-${fixture.awayScore}`);
}

writeFileSync(FIXTURES_PATH, JSON.stringify(fixtureArr, null, 2));
console.log(
  `\nDone: ${updated} patched, ${skipped} already scored, ${noMatch} unmatched.`,
);
if (updated > 0) {
  console.log("Next: npm run pipeline:settle && npm run report:accountability");
}
