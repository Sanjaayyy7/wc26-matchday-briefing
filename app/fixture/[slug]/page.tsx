import { notFound } from "next/navigation";
import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { Crest } from "@/components/crest";
import { FixturePane } from "@/components/fixture-pane";
import { EloSparkline } from "@/components/elo-sparkline";
import { H2HPanel, type H2HRecord } from "@/components/h2h-panel";
import { MatchResultPanel } from "@/components/match-result-panel";
import { StageChip } from "@/components/stage-chip";
import { formatKickoff } from "@/lib/format-kickoff";
import { clubById, fixtureBySlug, allFixtures } from "@/lib/data";
import { matchViewBySlug } from "@/lib/match-view";
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
  const view = matchViewBySlug(fixture.slug);

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="space-y-16">
          <section className="animate-rise">
            <Link
              href="/matches"
              className="text-label mb-8 inline-flex h-9 items-center rounded-full px-4 transition-colors duration-300 hover:bg-[var(--neutral-fill)] hover:text-[var(--ink)]"
            >
              All fixtures
            </Link>
            <div className="flex flex-col items-center gap-6 text-center">
              <div className="flex flex-wrap items-center justify-center gap-2">
                <StageChip stage={fixture.stage} />
                <span className="text-label">
                  {fixture.group ? `Group ${fixture.group} · ` : ""}
                  {formatKickoff(fixture)} · {fixture.venue}
                </span>
              </div>
              <div className="flex flex-col items-center justify-center gap-6 md:flex-row md:gap-10">
                <div className="flex items-center gap-4">
                  <Crest
                    short={home.short}
                    primary={home.primary}
                    secondary={home.secondary}
                    name={home.name}
                    size={56}
                  />
                  <span className="text-title text-3xl">{home.name}</span>
                </div>
                <span className="text-title text-[var(--ink-faint)]" aria-hidden>
                  vs
                </span>
                <div className="flex items-center gap-4">
                  <span className="text-title text-3xl">{away.name}</span>
                  <Crest
                    short={away.short}
                    primary={away.primary}
                    secondary={away.secondary}
                    name={away.name}
                    size={56}
                  />
                </div>
              </div>
              <p className="max-w-xl text-[var(--ink-muted)]">{fixture.stakes}</p>
            </div>
          </section>

          {view && (view.status === "official" || view.status === "informational") ? (
            <MatchResultPanel view={view} />
          ) : (
            <section className="animate-rise">
              <h2 className="text-label mb-4">Model briefing</h2>
              <FixturePane slug={fixture.slug} home={home} away={away} />
            </section>
          )}

          <section className="animate-rise">
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
          </section>
          <section className="animate-rise">
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
          </section>
        </div>
      </main>
    </>
  );
}
