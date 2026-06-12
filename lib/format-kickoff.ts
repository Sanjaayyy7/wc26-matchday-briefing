import type { Fixture } from "./data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

/** Venue-local kickoff for display, e.g. "Sat 18:00 EDT". */
export function formatKickoff(fixture: Fixture): string {
  const local = new Date(
    new Date(fixture.kickoffISO).getTime() +
      (fixture.tzOffsetMinutes ?? 60) * 60 * 1000,
  );
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${DAYS[local.getUTCDay()]} ${hh}:${mm} ${fixture.tzLabel ?? "BST"}`;
}
