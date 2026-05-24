import Link from "next/link";
import { Crest } from "./crest";
import { StarField } from "./star-field";
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
    <Link
      href={`/fixture/${fixture.slug}`}
      className="group relative block overflow-hidden rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-10 transition hover:border-[var(--gold)]"
    >
      <StarField />
      <div className="relative grid gap-7">
        <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--gold)]">
          Featured · {fixture.competition}
        </span>
        <div className="flex items-center justify-center gap-10 md:gap-16">
          <div className="flex flex-col items-center gap-3">
            <Crest
              short={home.short}
              primary={home.primary}
              secondary={home.secondary}
              name={home.name}
              size={104}
            />
            <div className="font-display text-xl md:text-2xl">{home.name}</div>
          </div>
          <div
            className="font-display text-5xl text-[var(--ink-muted)] md:text-6xl"
            aria-hidden
          >
            vs
          </div>
          <div className="flex flex-col items-center gap-3">
            <Crest
              short={away.short}
              primary={away.primary}
              secondary={away.secondary}
              name={away.name}
              size={104}
            />
            <div className="font-display text-xl md:text-2xl">{away.name}</div>
          </div>
        </div>
        <p className="mx-auto max-w-2xl text-center text-lg leading-snug text-[var(--ink)]">
          {fixture.stakes}
        </p>
        <div className="flex items-center justify-center gap-4 text-sm text-[var(--ink-muted)]">
          <span className="font-mono">Sun 16:00 BST</span>
          <span aria-hidden>·</span>
          <span>{fixture.venue}</span>
        </div>
        <div className="text-center">
          <span className="inline-flex items-center gap-2 rounded-full border border-[var(--gold)] px-5 py-2 text-sm text-[var(--gold)] transition group-hover:bg-[var(--gold)] group-hover:text-[var(--canvas)]">
            Open briefing →
          </span>
        </div>
      </div>
    </Link>
  );
}
