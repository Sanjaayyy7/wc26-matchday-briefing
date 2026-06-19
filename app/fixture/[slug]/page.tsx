import { notFound } from "next/navigation";
import Link from "next/link";
import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, HeroScene, RouteStack } from "@/components/cinematic";
import { FixturePane } from "@/components/fixture-pane";
import { EloSparkline } from "@/components/elo-sparkline";
import { H2HPanel, type H2HRecord } from "@/components/h2h-panel";
import { MatchResultPanel } from "@/components/match-result-panel";
import { clubById, fixtureBySlug, allFixtures } from "@/lib/data";
import { kitAccent } from "@/lib/kit-color";
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
    <WCS26Shell route="matches">
      <RouteStack>
        <Link
          href="/matches"
          className="text-label inline-flex h-9 w-fit items-center border-b border-[var(--line)] px-1 transition-colors duration-300 hover:border-[var(--stage-final)] hover:text-[var(--ink)]"
        >
          All fixtures
        </Link>
        <HeroScene fixture={fixture} home={home} away={away} variant="fixture" />

        {view && (view.status === "official" || view.status === "informational") ? (
          <MatchResultPanel view={view} />
        ) : (
          <CanvasSection eyebrow="Model briefing" title="Probability, score grid, and rationale.">
            <DataPlane>
              <FixturePane slug={fixture.slug} home={home} away={away} />
            </DataPlane>
          </CanvasSection>
        )}

        <CanvasSection eyebrow="Head to head" title="Full history between the two sides.">
          <DataPlane>
            <H2HPanel
              record={
                ((history as { h2h: Record<string, H2HRecord | null> }).h2h[
                  fixture.slug
                ] ?? null)
              }
              homeName={home.datasetName ?? home.name}
              awayName={away.datasetName ?? away.name}
            />
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Rating trend" title="Elo movement since 2002.">
          <DataPlane>
            <div className="grid gap-8 sm:grid-cols-2">
              <EloSparkline
                points={
                  (history as {
                    trajectories: Record<string, Array<{ date: string; elo: number }>>;
                  }).trajectories[home.datasetName ?? home.name] ?? []
                }
                color={kitAccent(home.primary, "up")}
                label={home.name}
              />
              <EloSparkline
                points={
                  (history as {
                    trajectories: Record<string, Array<{ date: string; elo: number }>>;
                  }).trajectories[away.datasetName ?? away.name] ?? []
                }
                color={kitAccent(away.primary, "down")}
                label={away.name}
              />
            </div>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
