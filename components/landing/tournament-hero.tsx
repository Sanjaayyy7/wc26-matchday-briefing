import Link from "next/link";
import { Crest } from "@/components/crest";
import { NumberTicker } from "@/components/number-ticker";
import { StageChip } from "@/components/stage-chip";
import { kitPairWashStyle } from "@/lib/kit-color";
import { formatKickoff } from "@/lib/format-kickoff";
import type { Club, Fixture } from "@/lib/data";

export function TournamentHero({
  fixture,
  home,
  away,
  officialCount,
  openLocks,
  leader,
}: {
  fixture: Fixture;
  home: Club;
  away: Club;
  officialCount: number;
  openLocks: number;
  leader: { name: string; pct: number };
}) {
  return (
    <section
      className="animate-rise p-6 md:p-8"
      style={kitPairWashStyle(home.primary, away.primary)}
    >
      <div className="grid gap-8 lg:grid-cols-[1.2fr_0.8fr] lg:items-end">
        <div>
          <div className="mb-6 flex flex-wrap items-center gap-2">
            <StageChip stage={fixture.stage} />
            <span className="text-label">Featured · {formatKickoff(fixture)}</span>
          </div>
          <div className="flex flex-col gap-6 sm:flex-row sm:items-center">
            <div className="flex items-center gap-4">
              <Crest
                short={home.short}
                primary={home.primary}
                secondary={home.secondary}
                name={home.name}
                size={72}
              />
              <h1 className="text-display">{home.name}</h1>
            </div>
            <span className="text-title text-[var(--ink-faint)]">vs</span>
            <div className="flex items-center gap-4">
              <Crest
                short={away.short}
                primary={away.primary}
                secondary={away.secondary}
                name={away.name}
                size={72}
              />
              <h2 className="text-display">{away.name}</h2>
            </div>
          </div>
          <p className="mt-6 max-w-2xl text-[var(--ink-muted)]">{fixture.stakes}</p>
          <Link
            href={`/fixture/${fixture.slug}`}
            className="mt-8 inline-flex h-11 items-center rounded-full bg-[var(--accent)] px-6 font-medium text-[var(--accent-foreground)] transition-transform duration-300 hover:scale-105"
          >
            Open briefing
          </Link>
        </div>
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-1">
          <div className="border-t border-[var(--hairline)] pt-4">
            <span className="text-label">Official sample</span>
            <NumberTicker value={officialCount} className="mt-2 block text-stat" />
          </div>
          <div className="border-t border-[var(--hairline)] pt-4">
            <span className="text-label">Open locks</span>
            <NumberTicker value={openLocks} className="mt-2 block text-stat" />
          </div>
          <div className="border-t border-[var(--hairline)] pt-4">
            <span className="text-label">Cup favorite</span>
            <span className="text-title mt-2 block">{leader.name}</span>
            <NumberTicker
              value={leader.pct}
              suffix="%"
              decimals={1}
              className="mt-1 block text-stat text-[var(--up)]"
            />
          </div>
        </div>
      </div>
    </section>
  );
}
