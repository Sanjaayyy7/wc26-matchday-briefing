import { describe, it, expect } from "vitest";
import { buildFirstUserMessage } from "@/lib/fixture-template";
import type { Club, Fixture } from "@/lib/data";

const fixture: Fixture = {
  id: "ars-eve-md38",
  slug: "arsenal-vs-everton",
  homeId: "ars",
  awayId: "eve",
  kickoffISO: "2026-05-24T15:00:00Z",
  venue: "Emirates Stadium",
  competition: "Premier League MD-38",
  stakes: "Title race — Arsenal need a win to be champions",
  privateNotes: null,
};

const home: Club = {
  id: "ars",
  name: "Arsenal",
  short: "ARS",
  primary: "#EF0107",
  secondary: "#FFFFFF",
  crest: null,
  venue: "Emirates Stadium",
  manager: "Mikel Arteta",
  lastFiveResults: "WWDWW",
  goalsForLast5: 11,
  goalsAgainstLast5: 3,
};

const away: Club = {
  id: "eve",
  name: "Everton",
  short: "EVE",
  primary: "#003399",
  secondary: "#FFFFFF",
  crest: null,
  venue: "Hill Dickinson Stadium",
  manager: "David Moyes",
  lastFiveResults: "DLDWL",
  goalsForLast5: 4,
  goalsAgainstLast5: 7,
};

describe("buildFirstUserMessage", () => {
  it("includes all placeholder fields with names not ids", () => {
    const msg = buildFirstUserMessage({ fixture, home, away, today: "2026-05-23" });
    expect(msg).toContain("HOME_TEAM=Arsenal");
    expect(msg).toContain("AWAY_TEAM=Everton");
    expect(msg).toContain("COMPETITION=Premier League MD-38");
    expect(msg).toContain("VENUE=Emirates Stadium");
    expect(msg).toContain("TODAY=2026-05-23");
    expect(msg).toContain("My boy is going to ask me who wins");
  });

  it("formats kickoff in local readable form (Sun 16:00 BST)", () => {
    const msg = buildFirstUserMessage({ fixture, home, away, today: "2026-05-23" });
    expect(msg).toMatch(/KICKOFF_LOCAL=Sun 16:00 BST/);
  });

  it("renders PRIVATE_NOTES as 'none' when null", () => {
    const msg = buildFirstUserMessage({ fixture, home, away, today: "2026-05-23" });
    expect(msg).toContain('PRIVATE_NOTES="none"');
  });

  it("surfaces stakes as a separate public line", () => {
    const msg = buildFirstUserMessage({ fixture, home, away, today: "2026-05-23" });
    expect(msg).toContain("Public stakes context: Title race");
  });
});

const wcFixture: Fixture = {
  id: "bra-mar-gc1",
  slug: "brazil-vs-morocco",
  homeId: "bra",
  awayId: "mar",
  kickoffISO: "2026-06-13T20:00:00Z",
  venue: "New York New Jersey Stadium",
  competition: "FIFA World Cup 2026",
  stakes: "Group C opener for both sides.",
  privateNotes: null,
  stage: "group",
  group: "C",
  tzOffsetMinutes: -240,
  tzLabel: "EDT",
};

const bra: Club = { ...home, id: "bra", name: "Brazil", short: "BRA" };
const mar: Club = { ...away, id: "mar", name: "Morocco", short: "MAR" };

describe("buildFirstUserMessage - World Cup fixture", () => {
  it("uses the fixture's own timezone, not BST (L-10)", () => {
    const msg = buildFirstUserMessage({ fixture: wcFixture, home: bra, away: mar, today: "2026-06-12" });
    expect(msg).toMatch(/KICKOFF_LOCAL=Sat 16:00 EDT/);
    expect(msg).not.toContain("BST");
  });

  it("emits STAGE and GROUP key=value lines (L-04)", () => {
    const msg = buildFirstUserMessage({ fixture: wcFixture, home: bra, away: mar, today: "2026-06-12" });
    expect(msg).toContain("STAGE=group");
    expect(msg).toContain("GROUP=C");
  });

  it("emits NOW_LOCAL in venue time when now is provided (L-21)", () => {
    const msg = buildFirstUserMessage({
      fixture: wcFixture, home: bra, away: mar, today: "2026-06-12",
      now: new Date("2026-06-12T23:00:00Z"),
    });
    expect(msg).toMatch(/NOW_LOCAL=Fri 19:00 EDT/);
  });

  it("appends VERIFIED_FACTS and MARKET_SNAPSHOT blocks when provided (L-02/L-03)", () => {
    const msg = buildFirstUserMessage({
      fixture: wcFixture, home: bra, away: mar, today: "2026-06-12",
      verifiedFacts: "[squad] Brazil 26 named (source: CBF)",
      marketSnapshot: "Brazil 56% / Draw 25% / Morocco 19% (Kalshi, de-vigged)",
    });
    expect(msg).toContain("VERIFIED_FACTS:\n[squad] Brazil 26 named (source: CBF)");
    expect(msg).toContain("MARKET_SNAPSHOT: Brazil 56% / Draw 25% / Morocco 19% (Kalshi, de-vigged)");
  });

  it("omits the new lines entirely for legacy PL fixtures (backward compat)", () => {
    const msg = buildFirstUserMessage({ fixture, home, away, today: "2026-05-23" });
    expect(msg).not.toContain("STAGE=");
    expect(msg).not.toContain("VERIFIED_FACTS");
    expect(msg).not.toContain("MARKET_SNAPSHOT");
  });
});
