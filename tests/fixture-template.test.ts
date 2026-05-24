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
