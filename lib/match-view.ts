import "server-only";

import { allFixtures, clubById, fixtureBySlug, type Club, type Fixture } from "./data";
import predictionsJson from "@/data/predictions.json";
import matchFactsJson from "@/data/match-facts.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import type {
  AccountabilityOutput,
  InformationalRow,
  OfficialRow,
  Verdict,
} from "./accountability";
import type { LockedEntry } from "./predictions-ledger";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const ledger = (predictionsJson as { entries: LockedEntry[] }).entries;
const lockBySlug = new Map(ledger.map((e) => [e.slug, e]));
const accountability = accountabilityJson as AccountabilityOutput;
const officialBySlug = new Map(accountability.official.rows.map((r) => [r.slug, r]));
const informationalBySlug = new Map(
  accountability.informational.rows.map((r) => [r.slug, r]),
);

export type MatchFactDisplay = {
  possessionHome?: number;
  possessionAway?: number;
  shotsHome?: number;
  shotsAway?: number;
  onTargetHome?: number;
  onTargetAway?: number;
  cards?: Array<{
    player: string;
    team: string;
    type: string;
    minute: number;
    reason?: string;
  }>;
};

export type ScorerDisplay = {
  player: string;
  team: string;
  minute: number;
  assist?: string;
};

export type MatchFactsDisplay = {
  score?: { home: number; away: number };
  btts?: boolean;
  totalGoals?: number;
  scorers?: ScorerDisplay[];
  facts?: MatchFactDisplay;
};

type MatchFactsFile = Record<string, MatchFactsDisplay | string>;

export type MatchViewBase = {
  fixture: Fixture;
  home: Club;
  away: Club;
  dateLabel: string;
  facts?: MatchFactsDisplay;
};

export type OfficialMatchView = MatchViewBase & {
  status: "official";
  score: string;
  lock: LockedEntry;
  official: OfficialRow;
  verdict: Verdict;
};

export type InformationalMatchView = MatchViewBase & {
  status: "informational";
  score: string;
  informational: InformationalRow;
};

export type LockedMatchView = MatchViewBase & {
  status: "locked";
  lock: LockedEntry;
};

export type UpcomingMatchView = MatchViewBase & {
  status: "upcoming";
};

export type MatchView =
  | OfficialMatchView
  | InformationalMatchView
  | LockedMatchView
  | UpcomingMatchView;

export type MatchRowData = {
  slug: string;
  dateLabel: string;
  group: string;
  stage: NonNullable<Fixture["stage"]>;
  homeName: string;
  awayName: string;
  homeShort: string;
  awayShort: string;
  homeColor: string;
  awayColor: string;
  status: MatchView["status"];
  score?: string;
  split?: { home: number; draw: number; away: number };
  pick?: { label: string; pct: number; correct?: boolean };
  verdict?: Verdict;
  grade?: { brier: number; rps: number };
  note?: string;
};

function dateLabel(f: Fixture): string {
  const local = new Date(
    new Date(f.kickoffISO).getTime() + (f.tzOffsetMinutes ?? 0) * 60 * 1000,
  );
  return `${DAYS[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
}

function scoreFromFacts(facts: MatchFactsDisplay | undefined): string | undefined {
  return facts?.score ? `${facts.score.home}-${facts.score.away}` : undefined;
}

function factsFor(slug: string): MatchFactsDisplay | undefined {
  const facts = (matchFactsJson as MatchFactsFile)[slug];
  return typeof facts === "object" ? facts : undefined;
}

function topPick(
  split: { home: number; draw: number; away: number },
  homeLabel: string,
  awayLabel: string,
): { label: string; pct: number } {
  const [outcome, pct] = (Object.entries(split) as Array<["home" | "draw" | "away", number]>)
    .reduce((a, b) => (b[1] > a[1] ? b : a));
  return {
    pct,
    label: outcome === "home" ? homeLabel : outcome === "away" ? awayLabel : "Draw",
  };
}

export function buildMatchView(fixture: Fixture): MatchView {
  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  const facts = factsFor(fixture.slug);
  const base: MatchViewBase = {
    fixture,
    home,
    away,
    dateLabel: dateLabel(fixture),
    facts,
  };

  const official = officialBySlug.get(fixture.slug);
  const lock = lockBySlug.get(fixture.slug);
  if (official && lock) {
    return {
      ...base,
      status: "official",
      score: official.actual,
      lock,
      official,
      verdict: official.verdict,
    };
  }

  const informational = informationalBySlug.get(fixture.slug);
  const factScore = scoreFromFacts(facts);
  if (informational || factScore) {
    return {
      ...base,
      status: "informational",
      score: informational?.actual ?? factScore ?? "unknown",
      informational:
        informational ??
        ({
          slug: fixture.slug,
          actual: factScore ?? "unknown",
          btts: facts?.btts,
          totalGoals: facts?.totalGoals,
          note: "Played before a locked prediction existed; shown for completeness, not scored.",
        } satisfies InformationalRow),
    };
  }

  if (lock) {
    return { ...base, status: "locked", lock };
  }

  return { ...base, status: "upcoming" };
}

export function allMatchViews(): MatchView[] {
  return allFixtures().map(buildMatchView);
}

export function matchViewBySlug(slug: string): MatchView | undefined {
  const fixture = fixtureBySlug(slug);
  return fixture ? buildMatchView(fixture) : undefined;
}

export function matchViewToRow(view: MatchView): MatchRowData {
  const { fixture, home, away } = view;
  const row: MatchRowData = {
    slug: fixture.slug,
    dateLabel: view.dateLabel,
    group: fixture.group ?? "-",
    stage: fixture.stage ?? "group",
    homeName: home.name,
    awayName: away.name,
    homeShort: home.short,
    awayShort: away.short,
    homeColor: home.primary,
    awayColor: away.primary,
    status: view.status,
  };

  if (view.status === "official") {
    const pick = topPick(view.official.locked, home.short, away.short);
    return {
      ...row,
      score: view.score.replace("-", "–"),
      split: view.official.locked,
      pick: { ...pick, correct: view.official.grades.correctPick },
      verdict: view.verdict,
      grade: {
        brier: view.official.grades.modelBrier,
        rps: view.official.grades.modelRps,
      },
    };
  }

  if (view.status === "informational") {
    return {
      ...row,
      score: view.score.replace("-", "–"),
      note: "Not graded",
    };
  }

  if (view.status === "locked") {
    return {
      ...row,
      split: view.lock.split,
      pick: topPick(view.lock.split, home.short, away.short),
    };
  }

  return row;
}
