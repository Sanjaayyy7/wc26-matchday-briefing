import Link from "next/link";
import { Crest } from "./crest";
import type { Club, Fixture } from "@/lib/data";

export function FixtureCard({
  fixture,
  home,
  away,
}: {
  fixture: Fixture;
  home: Club;
  away: Club;
}) {
  const streak = `linear-gradient(90deg, ${home.primary} 0%, ${home.primary} 50%, ${away.primary} 50%, ${away.primary} 100%)`;
  return (
    <Link
      href={`/fixture/${fixture.slug}`}
      className="group relative flex h-full flex-col gap-4 overflow-hidden rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-5 transition hover:-translate-y-0.5 hover:border-[var(--gold)]"
    >
      <div className="flex items-center justify-between gap-3">
        <Crest
          short={home.short}
          primary={home.primary}
          secondary={home.secondary}
          name={home.name}
          size={44}
        />
        <span className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          Sun 16:00
        </span>
        <Crest
          short={away.short}
          primary={away.primary}
          secondary={away.secondary}
          name={away.name}
          size={44}
        />
      </div>
      <div className="flex items-center justify-between font-display text-base">
        <span>{home.short}</span>
        <span className="text-[var(--ink-muted)]" aria-hidden>
          vs
        </span>
        <span>{away.short}</span>
      </div>
      <p className="line-clamp-2 flex-1 text-sm text-[var(--ink-muted)]">
        {fixture.stakes}
      </p>
      <div
        className="h-[3px] w-full rounded-full opacity-60 transition group-hover:opacity-100"
        style={{ background: streak }}
      />
    </Link>
  );
}
