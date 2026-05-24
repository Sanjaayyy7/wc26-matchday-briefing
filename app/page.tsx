import { SiteHeader } from "@/components/site-header";
import { MatchdayHero } from "@/components/matchday-hero";
import { FixtureCard } from "@/components/fixture-card";
import { allFixtures, clubById, featuredFixture } from "@/lib/data";

export default function HomePage() {
  const featured = featuredFixture();
  const rest = allFixtures().filter((f) => f.slug !== featured.slug);
  const hasKey = !!process.env.ANTHROPIC_API_KEY;
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-7xl flex-1 px-6 py-10">
        {!hasKey && (
          <div className="mb-8 rounded-2xl border border-[var(--crimson)] bg-[var(--surface)] p-4 text-sm">
            Missing <code className="font-mono">ANTHROPIC_API_KEY</code>. Add it
            to <code className="font-mono">app/.env.local</code> and restart{" "}
            <code className="font-mono">npm run dev</code> to enable briefings.
          </div>
        )}
        <MatchdayHero
          fixture={featured}
          home={clubById(featured.homeId)}
          away={clubById(featured.awayId)}
        />
        <section className="mt-12">
          <h2 className="mb-5 text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
            The rest of MD-38
          </h2>
          <ul
            role="list"
            className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3"
          >
            {rest.map((f) => (
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
