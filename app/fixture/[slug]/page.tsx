import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Crest } from "@/components/crest";
import { FixturePane } from "@/components/fixture-pane";
import { clubById, fixtureBySlug, allFixtures } from "@/lib/data";

export function generateStaticParams() {
  return allFixtures().map((f) => ({ slug: f.slug }));
}

export default async function FixturePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const fixture = fixtureBySlug(slug);
  if (!fixture) notFound();

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-5xl flex-1 px-6 py-8">
        <Link
          href="/"
          className="font-mono text-[11px] uppercase tracking-[0.18em] text-[var(--ink-muted)] transition hover:text-[var(--gold)]"
        >
          ← Matchday
        </Link>

        <section className="mt-6 grid items-center gap-6 rounded-3xl border border-[var(--hairline)] bg-[var(--surface)] p-8 md:grid-cols-[1fr_auto_1fr]">
          <div className="flex items-center justify-center gap-4 md:justify-end">
            <div className="text-right">
              <div className="font-display text-2xl">{home.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {home.lastFiveResults} · {home.goalsForLast5}–
                {home.goalsAgainstLast5}
              </div>
            </div>
            <Crest
              short={home.short}
              primary={home.primary}
              secondary={home.secondary}
              name={home.name}
              size={76}
            />
          </div>
          <div
            className="text-center font-display text-3xl text-[var(--ink-muted)]"
            aria-hidden
          >
            vs
          </div>
          <div className="flex items-center justify-center gap-4 md:justify-start">
            <Crest
              short={away.short}
              primary={away.primary}
              secondary={away.secondary}
              name={away.name}
              size={76}
            />
            <div>
              <div className="font-display text-2xl">{away.name}</div>
              <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
                {away.lastFiveResults} · {away.goalsForLast5}–
                {away.goalsAgainstLast5}
              </div>
            </div>
          </div>
        </section>

        <div className="mt-3 flex flex-wrap items-center justify-between gap-2 text-sm text-[var(--ink-muted)]">
          <span>{fixture.venue}</span>
          <span className="font-mono">Sun 24 May · 16:00 BST</span>
        </div>
        <p className="mt-2 font-display text-lg leading-snug">
          {fixture.stakes}
        </p>

        <FixturePane slug={fixture.slug} home={home} away={away} />
      </main>
    </>
  );
}
