import type { MatchView } from "./match-view";

/**
 * "Next locks" = forecasts still awaiting kickoff.
 *
 * A fixture keeps `status: "locked"` until it is graded (buildMatchView never
 * flips it on kickoff passing), so an already-played-but-ungraded match would
 * otherwise leak into the homepage "Next locks" list as a stale past date.
 * Filter to future kickoffs and order nearest-first.
 */
export function selectUpcomingLocks(
  views: MatchView[],
  now: Date = new Date(),
  limit = 3,
): MatchView[] {
  const nowMs = now.getTime();
  return views
    .filter(
      (v) =>
        (v.status === "locked" || v.status === "upcoming") &&
        new Date(v.fixture.kickoffISO).getTime() > nowMs,
    )
    .sort(
      (a, b) =>
        new Date(a.fixture.kickoffISO).getTime() - new Date(b.fixture.kickoffISO).getTime(),
    )
    .slice(0, limit);
}
