// tests/upcoming-locks.test.ts
import { describe, it, expect } from "vitest";
import { selectUpcomingLocks } from "../lib/upcoming-locks";
import type { MatchView } from "../lib/match-view";

const view = (slug: string, status: string, kickoffISO: string) =>
  ({ status, fixture: { slug, kickoffISO } }) as unknown as MatchView;

describe("selectUpcomingLocks", () => {
  const now = new Date("2026-06-21T00:00:00Z");

  it("excludes locked fixtures whose kickoff is already in the past", () => {
    const out = selectUpcomingLocks(
      [
        view("past", "locked", "2026-06-17T20:00:00Z"),
        view("future", "locked", "2026-06-25T20:00:00Z"),
      ],
      now,
    );
    expect(out.map((v) => v.fixture.slug)).toEqual(["future"]);
  });

  it("includes both locked and upcoming statuses, excludes others", () => {
    const out = selectUpcomingLocks(
      [
        view("up", "upcoming", "2026-06-24T20:00:00Z"),
        view("off", "official", "2026-06-30T20:00:00Z"),
        view("lk", "locked", "2026-06-23T20:00:00Z"),
      ],
      now,
    );
    expect(out.map((v) => v.fixture.slug)).toEqual(["lk", "up"]);
  });

  it("sorts ascending by kickoff (nearest first) and respects the limit", () => {
    const out = selectUpcomingLocks(
      [
        view("far", "locked", "2026-07-01T00:00:00Z"),
        view("near", "locked", "2026-06-22T00:00:00Z"),
        view("mid", "locked", "2026-06-26T00:00:00Z"),
        view("x", "locked", "2026-06-28T00:00:00Z"),
      ],
      now,
      3,
    );
    expect(out.map((v) => v.fixture.slug)).toEqual(["near", "mid", "x"]);
  });

  it("returns empty when no future locks remain", () => {
    expect(selectUpcomingLocks([view("p", "locked", "2026-06-10T00:00:00Z")], now)).toEqual([]);
  });
});
