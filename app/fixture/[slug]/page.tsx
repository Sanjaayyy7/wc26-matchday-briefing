import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Crest } from "@/components/crest";
import { FixturePane } from "@/components/fixture-pane";
import { EloSparkline } from "@/components/elo-sparkline";
import { H2HPanel, type H2HRecord } from "@/components/h2h-panel";
import { formatKickoff } from "@/lib/format-kickoff";
import { clubById, fixtureBySlug, allFixtures } from "@/lib/data";
import history from "@/data/history.json";

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
      <main className="mx-auto w-full max-w-4xl flex-1 px-6 py-10">
        <Link
          href="/"
          className="text-label inline-flex h-9 items-center rounded-full px-4 transition-colors duration-300 hover:bg-[var(--neutral-fill)] hover:text-[var(--ink)]"
        >
          ← All fixtures
        </Link>

        <section className="mt-10 flex flex-col items-center gap-6 text-center">
          <span className="text-label">
            {fixture.group ? `Group ${fixture.group} · ` : ""}
            {formatKickoff(fixture)} · {fixture.venue}
          </span>
          <div className="flex items-center justify-center gap-6 md:gap-10">
            <div className="flex items-center gap-4">
              <Crest
                short={home.short}
                primary={home.primary}
                secondary={home.secondary}
                name={home.name}
                size={56}
              />
              <span className="text-title text-2xl md:text-3xl">{home.name}</span>
            </div>
            <span className="text-lg font-light text-[var(--ink-faint)]" aria-hidden>
              vs
            </span>
            <div className="flex items-center gap-4">
              <span className="text-title text-2xl md:text-3xl">{away.name}</span>
              <Crest
                short={away.short}
                primary={away.primary}
                secondary={away.secondary}
                name={away.name}
                size={56}
              />
            </div>
          </div>
          <p className="max-w-xl text-[15px] text-[var(--ink-muted)]">
            {fixture.stakes}
          </p>
        </section>

        <FixturePane slug={fixture.slug} home={home} away={away} />

        <section className="mt-16 space-y-12">
          <div>
            <h2 className="text-label mb-4">Head to head — full history</h2>
            <H2HPanel
              record={
                ((history as { h2h: Record<string, H2HRecord | null> }).h2h[
                  fixture.slug
                ] ?? null)
              }
              homeName={home.datasetName ?? home.name}
              awayName={away.datasetName ?? away.name}
            />
          </div>
          <div>
            <h2 className="text-label mb-4">Rating trend since 2002</h2>
            <div className="grid gap-8 sm:grid-cols-2">
              <EloSparkline
                points={
                  (history as {
                    trajectories: Record<string, Array<{ date: string; elo: number }>>;
                  }).trajectories[home.datasetName ?? home.name] ?? []
                }
                color="var(--up)"
                label={home.name}
              />
              <EloSparkline
                points={
                  (history as {
                    trajectories: Record<string, Array<{ date: string; elo: number }>>;
                  }).trajectories[away.datasetName ?? away.name] ?? []
                }
                color="var(--down)"
                label={away.name}
              />
            </div>
          </div>
        </section>
      </main>
    </>
  );
}
