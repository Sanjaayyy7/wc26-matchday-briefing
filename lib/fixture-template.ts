import type { Club, Fixture } from "./data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatKickoff(iso: string): string {
  const d = new Date(iso);
  // UK in late May is BST (UTC+1)
  const local = new Date(d.getTime() + 60 * 60 * 1000);
  const day = DAYS[local.getUTCDay()];
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm} BST`;
}

export function buildFirstUserMessage(args: {
  fixture: Fixture;
  home: Club;
  away: Club;
  today: string;
}): string {
  const { fixture, home, away, today } = args;
  const kickoff = formatKickoff(fixture.kickoffISO);
  const notes = fixture.privateNotes ?? "none";
  return [
    `Tomorrow's fixture: HOME_TEAM=${home.name}, AWAY_TEAM=${away.name},`,
    `COMPETITION=${fixture.competition}, KICKOFF_LOCAL=${kickoff},`,
    `VENUE=${fixture.venue}, TODAY=${today},`,
    `PRIVATE_NOTES="${notes}".`,
    `Public stakes context: ${fixture.stakes}.`,
    `My boy is going to ask me who wins — give me the preview.`,
  ].join("\n");
}
