import Link from "next/link";
import { Crest } from "./crest";
import { formatKickoff } from "@/lib/format-kickoff";
import type { Club, Fixture } from "@/lib/data";

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
    <section className="rounded-3xl bg-[var(--surface)] px-6 py-16 dark:border dark:border-[var(--hairline)] md:py-20">
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
          <span
            className="text-2xl font-light text-[var(--ink-faint)] md:text-3xl"
            aria-hidden
          >
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
        <p className="max-w-xl text-[17px] leading-relaxed text-[var(--ink-muted)]">
          {fixture.stakes} {fixture.venue}.
        </p>
        <Link
          href={`/fixture/${fixture.slug}`}
          className="inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 text-[15px] font-medium text-[var(--accent-foreground)] transition-transform duration-300 hover:scale-[1.03]"
        >
          Read the briefing
        </Link>
      </div>
    </section>
  );
}
