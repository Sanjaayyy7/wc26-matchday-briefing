// Derive the full WC26 fixture list + 48-team roster from the dataset and the
// verified groups file. Group letters come from data/groups.json (clique-checked);
// scores for played matches are injected from the dataset rows.
//
//   npm run ml:schedule
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir } from "./shared.mts";

type Qualifier = { type: string; group?: string; allowed?: string[] };

const CITY_TZ: Record<string, { offset: number; label: string; venue: string }> = {
  Arlington: { offset: -300, label: "CDT", venue: "Dallas Stadium (Arlington)" },
  Atlanta: { offset: -240, label: "EDT", venue: "Atlanta Stadium" },
  "East Rutherford": { offset: -240, label: "EDT", venue: "New York New Jersey Stadium (East Rutherford)" },
  Foxborough: { offset: -240, label: "EDT", venue: "Boston Stadium (Foxborough)" },
  Guadalupe: { offset: -360, label: "CST", venue: "Monterrey Stadium (Guadalupe)" },
  Houston: { offset: -300, label: "CDT", venue: "Houston Stadium" },
  Inglewood: { offset: -420, label: "PDT", venue: "Los Angeles Stadium (Inglewood)" },
  "Kansas City": { offset: -300, label: "CDT", venue: "Kansas City Stadium" },
  "Mexico City": { offset: -360, label: "CST", venue: "Mexico City Stadium (Estadio Azteca)" },
  "Miami Gardens": { offset: -240, label: "EDT", venue: "Miami Stadium (Miami Gardens)" },
  Philadelphia: { offset: -240, label: "EDT", venue: "Philadelphia Stadium" },
  "Santa Clara": { offset: -420, label: "PDT", venue: "San Francisco Bay Area Stadium (Santa Clara)" },
  Seattle: { offset: -420, label: "PDT", venue: "Seattle Stadium" },
  Toronto: { offset: -240, label: "EDT", venue: "Toronto Stadium" },
  Vancouver: { offset: -420, label: "PDT", venue: "BC Place Vancouver" },
  Zapopan: { offset: -360, label: "CST", venue: "Guadalajara Stadium (Zapopan)" },
};

// Verified kickoff ISO times for the originally-seeded fixtures (data/README.md).
const VERIFIED_KICKOFFS: Record<string, string> = {
  "mexico-vs-south-africa": "2026-06-11T20:00:00Z",
  "south-korea-vs-czech-republic": "2026-06-12T03:00:00Z",
  "canada-vs-bosnia-herzegovina": "2026-06-12T19:00:00Z",
  "united-states-vs-paraguay": "2026-06-13T01:00:00Z",
  "qatar-vs-switzerland": "2026-06-13T20:00:00Z",
  "brazil-vs-morocco": "2026-06-13T22:00:00Z",
  "haiti-vs-scotland": "2026-06-14T01:00:00Z",
  "australia-vs-turkiye": "2026-06-14T04:00:00Z",
  "germany-vs-curacao": "2026-06-14T17:00:00Z",
  "netherlands-vs-japan": "2026-06-14T20:00:00Z",
};

// Display names / slugs where the app diverges from dataset spelling.
const DISPLAY: Record<string, { name: string; slug?: string }> = {
  Turkey: { name: "Türkiye", slug: "turkiye" },
  "Bosnia and Herzegovina": { name: "Bosnia & Herzegovina", slug: "bosnia-herzegovina" },
};

const SHORT: Record<string, string> = {
  Mexico: "MEX", "South Africa": "RSA", "South Korea": "KOR", "Czech Republic": "CZE",
  Canada: "CAN", "Bosnia and Herzegovina": "BIH", Qatar: "QAT", Switzerland: "SUI",
  Brazil: "BRA", Morocco: "MAR", Haiti: "HAI", Scotland: "SCO",
  "United States": "USA", Paraguay: "PAR", Australia: "AUS", Turkey: "TUR",
  Germany: "GER", "Curaçao": "CUR", Ecuador: "ECU", "Ivory Coast": "CIV",
  Netherlands: "NED", Japan: "JPN", Sweden: "SWE", Tunisia: "TUN",
  Belgium: "BEL", Egypt: "EGY", Iran: "IRN", "New Zealand": "NZL",
  Spain: "ESP", "Cape Verde": "CPV", "Saudi Arabia": "KSA", Uruguay: "URU",
  France: "FRA", Senegal: "SEN", Iraq: "IRQ", Norway: "NOR",
  Argentina: "ARG", Algeria: "ALG", Austria: "AUT", Jordan: "JOR",
  Portugal: "POR", "DR Congo": "COD", Uzbekistan: "UZB", Colombia: "COL",
  England: "ENG", Croatia: "CRO", Ghana: "GHA", Panama: "PAN",
};

function slugify(datasetName: string): string {
  return (
    DISPLAY[datasetName]?.slug ??
    datasetName
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "")
  );
}

// ---- load inputs ----
const csv = readFileSync(path.join(appDir, "data", "raw", "results.csv"), "utf8")
  .trim()
  .split("\n")
  .slice(1);
const groupsFile = JSON.parse(
  readFileSync(path.join(appDir, "data", "groups.json"), "utf8"),
) as { groups: Record<string, string[]> };
const bracket = JSON.parse(
  readFileSync(path.join(appDir, "data", "bracket.json"), "utf8"),
);
const existingClubs = JSON.parse(
  readFileSync(path.join(appDir, "data", "clubs.json"), "utf8"),
) as Array<Record<string, unknown> & { id: string }>;

const groupOf = new Map<string, string>();
for (const [letter, teams] of Object.entries(groupsFile.groups)) {
  for (const t of teams) groupOf.set(t, letter);
}

// ---- fixtures from dataset rows ----
type Fx = Record<string, unknown>;
const fixtures: Fx[] = [];
for (const line of csv) {
  const [date, home, away, hs, as, tournament, city] = line.split(",");
  if (tournament !== "FIFA World Cup" || date < "2026-06-01") continue;
  const g = groupOf.get(home);
  if (!g || g !== groupOf.get(away)) {
    throw new Error(`group mismatch for ${home} vs ${away}`);
  }
  const tz = CITY_TZ[city];
  if (!tz) throw new Error(`unknown host city: ${city}`);
  const slug = `${slugify(home)}-vs-${slugify(away)}`;
  const kickoffISO =
    VERIFIED_KICKOFFS[slug] ?? `${date}T00:00:00Z`;
  const hostAdv = ["Mexico", "Canada", "United States"].includes(home);
  const fixture: Fx = {
    id: `${SHORT[home].toLowerCase()}-${SHORT[away].toLowerCase()}-g${g.toLowerCase()}`,
    slug,
    homeId: SHORT[home].toLowerCase(),
    awayId: SHORT[away].toLowerCase(),
    kickoffISO,
    timeTBD: !(slug in VERIFIED_KICKOFFS),
    venue: tz.venue,
    competition: "FIFA World Cup 2026",
    stakes: `Group ${g}: ${DISPLAY[home]?.name ?? home} meet ${DISPLAY[away]?.name ?? away}.`,
    privateNotes: null,
    stage: "group",
    group: g,
    tzOffsetMinutes: tz.offset,
    tzLabel: tz.label,
    neutral: !hostAdv,
  };
  if (hs !== "NA" && as !== "NA") {
    fixture.homeScore = Number(hs);
    fixture.awayScore = Number(as);
  }
  if (slug === "brazil-vs-morocco") fixture.featured = true;
  fixtures.push(fixture);
}
fixtures.sort((a, b) =>
  String(a.kickoffISO).localeCompare(String(b.kickoffISO)),
);

// ---- knockout placeholders from bracket (no teams yet) ----
function qualifierLabel(q: Qualifier): string {
  if (q.type === "winner") return `Winner Group ${q.group}`;
  if (q.type === "runnerup") return `Runner-up Group ${q.group}`;
  return `3rd place (${(q.allowed ?? []).join("/")})`;
}
const knockouts: Fx[] = bracket.roundOf32.map(
  (m: { match: number; home: Qualifier; away: Qualifier }) => ({
    id: `r32-m${m.match}`,
    slug: `match-${m.match}`,
    stage: "round-of-32",
    match: m.match,
    homeLabel: qualifierLabel(m.home),
    awayLabel: qualifierLabel(m.away),
  }),
);

// ---- 48-team roster (preserve curated 20, add the rest) ----
const PALETTE: Array<[string, string]> = [
  ["#1d4ed8", "#ffffff"], ["#b91c1c", "#ffffff"], ["#047857", "#ffffff"],
  ["#7c3aed", "#ffffff"], ["#b45309", "#ffffff"], ["#0e7490", "#ffffff"],
  ["#be123c", "#ffffff"], ["#374151", "#ffffff"],
];
const clubs: Array<Record<string, unknown>> = [];
let p = 0;
for (const [letter, teams] of Object.entries(groupsFile.groups)) {
  for (const datasetName of teams) {
    const id = SHORT[datasetName].toLowerCase();
    const existing = existingClubs.find((c) => c.id === id);
    if (existing) {
      clubs.push({ ...existing, group: letter, datasetName });
      continue;
    }
    const [primary, secondary] = PALETTE[p++ % PALETTE.length];
    clubs.push({
      id,
      name: DISPLAY[datasetName]?.name ?? datasetName,
      short: SHORT[datasetName],
      primary,
      secondary,
      crest: null,
      venue: "National side",
      manager: "TBC — verify",
      lastFiveResults: "—",
      goalsForLast5: 0,
      goalsAgainstLast5: 0,
      group: letter,
      datasetName,
    });
  }
}
clubs.sort((a, b) => String(a.name).localeCompare(String(b.name)));

writeFileSync(
  path.join(appDir, "data", "fixtures.json"),
  JSON.stringify(fixtures, null, 1),
);
writeFileSync(
  path.join(appDir, "data", "knockouts.json"),
  JSON.stringify(knockouts, null, 1),
);
writeFileSync(
  path.join(appDir, "data", "clubs.json"),
  JSON.stringify(clubs, null, 1),
);
const played = fixtures.filter((f) => f.homeScore !== undefined).length;
console.log(
  `wrote ${fixtures.length} group fixtures (${played} played), ${knockouts.length} knockout slots, ${clubs.length} teams`,
);
