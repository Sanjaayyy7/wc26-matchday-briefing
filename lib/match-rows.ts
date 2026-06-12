// Server-side assembly of display rows for the matches hub and team pages.
import { allFixtures, clubById, type Fixture } from "./data";
import predictionsJson from "@/data/predictions.json";
import type { LockedEntry } from "./predictions-ledger";
import type { MatchRowData } from "@/components/match-row";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"] as const;

const ledger = (predictionsJson as { entries: LockedEntry[] }).entries;
const lockBySlug = new Map(ledger.map((e) => [e.slug, e]));

function dateLabel(f: Fixture): string {
  const local = new Date(
    new Date(f.kickoffISO).getTime() + (f.tzOffsetMinutes ?? 0) * 60 * 1000,
  );
  return `${DAYS[local.getUTCDay()]} ${local.getUTCDate()} ${MONTHS[local.getUTCMonth()]}`;
}

export function buildMatchRow(f: Fixture): MatchRowData {
  const home = clubById(f.homeId);
  const away = clubById(f.awayId);
  const lock = lockBySlug.get(f.slug);
  const row: MatchRowData = {
    slug: f.slug,
    dateLabel: dateLabel(f),
    group: f.group ?? "—",
    stage: f.stage ?? "group",
    homeName: home.name,
    awayName: away.name,
    homeColor: home.primary,
    awayColor: away.primary,
  };
  if (f.homeScore !== undefined) {
    row.score = `${f.homeScore}–${f.awayScore}`;
    if (lock?.realized) {
      const top = (
        Object.entries(lock.split) as Array<["home" | "draw" | "away", number]>
      ).reduce((a, b) => (b[1] > a[1] ? b : a));
      row.pick = {
        label:
          top[0] === "home" ? home.short : top[0] === "away" ? away.short : "Draw",
        pct: top[1],
        correct: lock.correctPick,
      };
    }
  } else if (lock) {
    row.split = lock.split;
  }
  return row;
}

export function allMatchRows(): MatchRowData[] {
  return allFixtures().map(buildMatchRow);
}
