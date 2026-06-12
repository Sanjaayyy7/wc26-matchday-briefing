import "server-only";
import fixturesJson from "@/data/fixtures.json";
import clubsJson from "@/data/clubs.json";

export type Club = {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  crest: string | null;
  venue: string;
  manager: string;
  lastFiveResults: string;
  goalsForLast5: number;
  goalsAgainstLast5: number;
  group?: string;
  /** Exact team name as it appears in the results dataset / model. */
  datasetName?: string;
};

export type Fixture = {
  id: string;
  slug: string;
  homeId: string;
  awayId: string;
  kickoffISO: string;
  venue: string;
  competition: string;
  stakes: string;
  privateNotes: string | null;
  featured?: boolean;
  // World Cup fields (absent on legacy PL fixtures)
  stage?: "group" | "round-of-32" | "round-of-16" | "quarter-final" | "semi-final" | "final";
  group?: string;
  tzOffsetMinutes?: number;
  tzLabel?: string;
  /** Kickoff hour not yet verified — render the date only. */
  timeTBD?: boolean;
  neutral?: boolean;
  homeScore?: number;
  awayScore?: number;
};

const clubs = clubsJson as Club[];
const fixtures = fixturesJson as Fixture[];
const clubMap = new Map<string, Club>(clubs.map((c) => [c.id, c]));

export function allFixtures(): Fixture[] {
  return fixtures;
}

export function featuredFixture(): Fixture {
  return fixtures.find((f) => f.featured) ?? fixtures[0];
}

export function fixtureBySlug(slug: string): Fixture | undefined {
  return fixtures.find((f) => f.slug === slug);
}

export function clubById(id: string): Club {
  const c = clubMap.get(id);
  if (!c) throw new Error(`Unknown club id: ${id}`);
  return c;
}

export function allClubs(): Club[] {
  return clubs;
}

export function fixturesByGroup(group: string): Fixture[] {
  return fixtures.filter((f) => f.group === group);
}

export function fixturesForTeam(id: string): Fixture[] {
  return fixtures.filter((f) => f.homeId === id || f.awayId === id);
}

export function playedFixtures(): Fixture[] {
  return fixtures.filter((f) => f.homeScore !== undefined);
}
