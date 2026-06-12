import type { Club, Fixture } from "./data";

const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"] as const;

function formatLocal(date: Date, tzOffsetMinutes: number, tzLabel: string): string {
  const local = new Date(date.getTime() + tzOffsetMinutes * 60 * 1000);
  const day = DAYS[local.getUTCDay()];
  const hh = String(local.getUTCHours()).padStart(2, "0");
  const mm = String(local.getUTCMinutes()).padStart(2, "0");
  return `${day} ${hh}:${mm} ${tzLabel}`;
}

export function buildFirstUserMessage(args: {
  fixture: Fixture;
  home: Club;
  away: Club;
  today: string;
  now?: Date;
  verifiedFacts?: string;
  marketSnapshot?: string;
}): string {
  const { fixture, home, away, today, now, verifiedFacts, marketSnapshot } = args;
  // Legacy PL fixtures carry no timezone fields; UK in late May is BST (UTC+1).
  const tzOffset = fixture.tzOffsetMinutes ?? 60;
  const tzLabel = fixture.tzLabel ?? "BST";
  const kickoff = formatLocal(new Date(fixture.kickoffISO), tzOffset, tzLabel);
  const notes = fixture.privateNotes ?? "none";

  const lines = [
    `Tomorrow's fixture: HOME_TEAM=${home.name}, AWAY_TEAM=${away.name},`,
    `COMPETITION=${fixture.competition}, KICKOFF_LOCAL=${kickoff},`,
  ];
  if (fixture.stage) {
    lines.push(
      `STAGE=${fixture.stage},${fixture.group ? ` GROUP=${fixture.group},` : ""}`,
    );
  }
  lines.push(`VENUE=${fixture.venue}, TODAY=${today},`);
  if (now) {
    lines.push(`NOW_LOCAL=${formatLocal(now, tzOffset, tzLabel)},`);
  }
  lines.push(`PRIVATE_NOTES="${notes}".`, `Public stakes context: ${fixture.stakes}.`);
  if (verifiedFacts) {
    lines.push(`VERIFIED_FACTS:\n${verifiedFacts}`);
  }
  if (marketSnapshot) {
    lines.push(`MARKET_SNAPSHOT: ${marketSnapshot}`);
  }
  lines.push(`My boy is going to ask me who wins — give me the preview.`);
  return lines.join("\n");
}
