import Link from "next/link";
import { SiteHeader } from "@/components/site-header";
import { MatchdayHero } from "@/components/matchday-hero";
import { FixtureCard } from "@/components/fixture-card";
import { allFixtures, allClubs, clubById, featuredFixture } from "@/lib/data";
import simulation from "@/data/simulation.json";

function ChampionStrip() {
  const sim = (simulation as { teams: Record<string, { champion: number }> }).teams;
  const byDataset = new Map(allClubs().map((c) => [c.datasetName ?? c.name, c]));
  const top = Object.entries(sim)
    .sort((a, b) => b[1].champion - a[1].champion)
    .slice(0, 8);
  return (
    <section>
      <h2 className="text-label mb-4">Who wins the cup — 10,000 simulations</h2>
      <div className="flex gap-3 overflow-x-auto pb-1">
        {top.map(([name, o]) => {
          const club = byDataset.get(name);
          return (
            <Link
              key={name}
              href={club ? `/team/${club.id}` : "/simulator"}
              className="flex shrink-0 items-center gap-3 rounded-full bg-[var(--surface)] py-2 pl-2.5 pr-4 transition-colors duration-300 hover:bg-[var(--elevated)] dark:border dark:border-[var(--hairline)]"
            >
              <span
                className="h-2.5 w-2.5 rounded-full"
                style={{ background: club?.primary ?? "var(--neutral-fill)" }}
                aria-hidden
              />
              <span className="text-[14px] font-medium">{club?.name ?? name}</span>
              <span className="tabular text-[14px] font-bold text-[var(--up)]">
                {(o.champion * 100).toFixed(1)}%
              </span>
            </Link>
          );
        })}
      </div>
    </section>
  );
}

export default function HomePage() {
  const featured = featuredFixture();
  const upcoming = allFixtures()
    .filter((f) => f.slug !== featured.slug && f.homeScore === undefined)
    .slice(0, 9);
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-6 py-12 md:py-16">
        <MatchdayHero
          fixture={featured}
          home={clubById(featured.homeId)}
          away={clubById(featured.awayId)}
        />
        <ChampionStrip />
        <section>
          <div className="mb-6 flex items-baseline justify-between">
            <h2 className="text-label">Next up</h2>
            <Link href="/matches" className="text-caption hover:text-[var(--ink)]">
              All 72 matches →
            </Link>
          </div>
          <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {upcoming.map((f) => (
              <li key={f.slug}>
                <FixtureCard
                  fixture={f}
                  home={clubById(f.homeId)}
                  away={clubById(f.awayId)}
                />
              </li>
            ))}
          </ul>
        </section>
      </main>
    </>
  );
}
