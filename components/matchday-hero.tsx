import Link from "next/link";
import { Crest } from "./crest";
import { formatKickoff } from "@/lib/format-kickoff";
import type { Club, Fixture } from "@/lib/data";
import { kitPairWashStyle } from "@/lib/kit-color";

export function MatchdayHero({
  fixture,
  home,
  away,
}: {
  fixture: Fixture;
  home: Club;
  away: Club;
}) {
  return (
    <section
      className="-mx-6 px-6 py-16 md:py-20"
      style={kitPairWashStyle(home.primary, away.primary)}
    >
      <div className="mx-auto flex max-w-3xl flex-col items-center gap-8 text-center">
        <span className="text-label">
          Featured{fixture.group ? ` · Group ${fixture.group}` : ""} ·{" "}
          {formatKickoff(fixture)}
        </span>
        <div className="flex items-center justify-center gap-8 md:gap-14">
          <div className="flex flex-col items-center gap-4">
            <Crest
              short={home.short}
              primary={home.primary}
              secondary={home.secondary}
              name={home.name}
              size={96}
            />
            <span className="text-display text-3xl md:text-5xl">{home.name}</span>
          </div>
          <span className="text-title text-[var(--ink-faint)]" aria-hidden>
            vs
          </span>
          <div className="flex flex-col items-center gap-4">
            <Crest
              short={away.short}
              primary={away.primary}
              secondary={away.secondary}
              name={away.name}
              size={96}
            />
            <span className="text-display text-3xl md:text-5xl">{away.name}</span>
          </div>
        </div>
        <p className="max-w-xl text-[var(--ink-muted)]">
          {fixture.stakes} {fixture.venue}.
        </p>
        <Link
          href={`/fixture/${fixture.slug}`}
          className="inline-flex h-11 items-center border-b border-[var(--accent)] font-medium text-[var(--accent)] transition-colors duration-300 hover:text-[var(--ink)]"
        >
          Read the briefing
        </Link>
      </div>
    </section>
  );
}
