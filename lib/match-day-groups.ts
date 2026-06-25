import type { MatchView } from "@/lib/match-view";

const ET_TZ = "America/New_York";

/** Convert any Date to a YYYY-MM-DD string in the given timezone. */
function toDateISO(date: Date, tz: string): string {
  const locale = date.toLocaleDateString("en-US", { timeZone: tz }); // "M/D/YYYY"
  const [month, day, year] = locale.split("/").map(Number);
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

/** Offset a YYYY-MM-DD string by `days` days. */
function shiftISO(dateISO: string, days: number): string {
  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d + days));
  return dt.toISOString().slice(0, 10);
}

/** Human-readable label for a date bucket. */
function labelFor(dateISO: string, todayISO: string): string {
  if (dateISO === todayISO) return "Today";
  if (dateISO === shiftISO(todayISO, -1)) return "Yesterday";
  if (dateISO === shiftISO(todayISO, 1)) return "Tomorrow";

  const [y, m, d] = dateISO.split("-").map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  const dow = dt.toLocaleDateString("en-US", { weekday: "short", timeZone: "UTC" });
  const mon = dt.toLocaleDateString("en-US", { month: "short", timeZone: "UTC" });
  return `${dow}, ${mon} ${d}`;
}

export type MatchDayGroup = {
  dateISO: string;
  label: string;
  views: MatchView[];
};

/**
 * Bucket `views` by ET calendar date, sorted ascending.
 * Each bucket carries a `dateISO` (YYYY-MM-DD in ET) and a human `label`.
 */
export function groupByMatchday(
  views: MatchView[],
  tz = ET_TZ,
): MatchDayGroup[] {
  const map = new Map<string, MatchView[]>();

  for (const view of views) {
    const dateISO = toDateISO(new Date(view.fixture.kickoffISO), tz);
    const bucket = map.get(dateISO);
    if (bucket) {
      bucket.push(view);
    } else {
      map.set(dateISO, [view]);
    }
  }

  const todayISO = toDateISO(new Date(), tz);

  return [...map.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([dateISO, groupViews]) => ({
      dateISO,
      label: labelFor(dateISO, todayISO),
      views: groupViews,
    }));
}

/**
 * Return the index of the group to show by default:
 * 1. today's group if present
 * 2. the first group whose dateISO is >= today (nearest upcoming)
 * 3. the last group (all dates are in the past)
 */
export function defaultSelectedIndex(
  groups: MatchDayGroup[],
  now: Date,
): number {
  if (groups.length === 0) return 0;

  const todayISO = toDateISO(now, ET_TZ);

  const todayIdx = groups.findIndex((g) => g.dateISO === todayISO);
  if (todayIdx !== -1) return todayIdx;

  const upcomingIdx = groups.findIndex((g) => g.dateISO >= todayISO);
  if (upcomingIdx !== -1) return upcomingIdx;

  return groups.length - 1;
}
