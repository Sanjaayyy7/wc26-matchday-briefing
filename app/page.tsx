import { SiteHeader } from "@/components/site-header";
import { FixtureCard } from "@/components/fixture-card";
import { MatchRow } from "@/components/match-row";
import { TournamentHero } from "@/components/landing/tournament-hero";
import { SimulationLeaders } from "@/components/landing/simulation-leaders";
import { allClubs, clubById, featuredFixture } from "@/lib/data";
import { allMatchViews, matchViewToRow } from "@/lib/match-view";
import simulation from "@/data/simulation.json";
import predictions from "@/data/predictions.json";
import accountability from "@/data/backtest/wc26-accountability.json";

export default function HomePage() {
  const featured = featuredFixture();
  const views = allMatchViews();
  const upcoming = views
    .filter((v) => v.fixture.slug !== featured.slug && (v.status === "locked" || v.status === "upcoming"))
    .slice(0, 6);
  const played = views.filter((v) => v.status === "official" || v.status === "informational").slice(0, 4);
  const clubs = allClubs();
  const byDataset = new Map(clubs.map((c) => [c.datasetName ?? c.name, c]));
  const sim = simulation as {
    teams: Record<string, { champion: number; reachFinal: number }>;
  };
  const leaders = Object.entries(sim.teams)
    .map(([name, o]) => ({ club: byDataset.get(name), champion: o.champion, final: o.reachFinal }))
    .filter((row): row is { club: ReturnType<typeof allClubs>[number]; champion: number; final: number } => Boolean(row.club))
    .sort((a, b) => b.champion - a.champion)
    .slice(0, 6);
  const leader = leaders[0];
  const officialCount = (accountability as { official: { aggregates: { n: number } } }).official
    .aggregates.n;
  const openLocks = (predictions as { entries: Array<{ result?: string }> }).entries.filter(
    (entry) => entry.result === undefined,
  ).length;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="space-y-16">
        <TournamentHero
          fixture={featured}
          home={clubById(featured.homeId)}
          away={clubById(featured.awayId)}
          officialCount={officialCount}
          openLocks={openLocks}
          leader={{ name: leader.club.name, pct: leader.champion * 100 }}
        />
        <section className="animate-rise">
          <h2 className="text-label mb-4">Cup Race</h2>
          <SimulationLeaders leaders={leaders} />
        </section>
        {played.length > 0 && (
          <section className="animate-rise">
            <h2 className="text-label mb-4">Latest results</h2>
            <div className="space-y-2">
              {played.map((view) => (
                <MatchRow key={view.fixture.slug} m={matchViewToRow(view)} />
              ))}
            </div>
          </section>
        )}
        <section className="animate-rise">
          <h2 className="text-label mb-4">Next up</h2>
          <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((view) => (
              <li key={view.fixture.slug}>
                <FixtureCard
                  fixture={view.fixture}
                  home={view.home}
                  away={view.away}
                />
              </li>
            ))}
          </ul>
        </section>
        </div>
      </main>
    </>
  );
}
