import Link from "next/link";
import { formatKickoff } from "@/lib/format-kickoff";
import type { Club, Fixture } from "@/lib/data";
import { kitAccent, kitPairWashStyle } from "@/lib/kit-color";

function TeamRow({ team }: { team: Club }) {
  return (
    <div className="flex items-center gap-3">
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ background: kitAccent(team.primary, "up") }}
        aria-hidden
      />
      <span className="text-title">{team.name}</span>
    </div>
  );
}

export function FixtureCard({
  fixture,
  home,
  away,
}: {
  fixture: Fixture;
  home: Club;
  away: Club;
}) {
  return (
    <Link
      href={`/fixture/${fixture.slug}`}
      className="group flex h-full flex-col gap-5 rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1 hover:shadow-[var(--shadow-hover)] dark:border dark:border-[var(--hairline)]"
      style={kitPairWashStyle(home.primary, away.primary)}
    >
      <span className="text-label">
        {fixture.group ? `Group ${fixture.group}` : fixture.competition}
      </span>
      <div className="flex flex-1 flex-col gap-2.5">
        <TeamRow team={home} />
        <TeamRow team={away} />
      </div>
      <span className="text-caption tabular">{formatKickoff(fixture)}</span>
    </Link>
  );
}
