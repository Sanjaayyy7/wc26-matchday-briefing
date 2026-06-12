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
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-6 py-12 md:py-16">
        {!hasKey && (
          <div className="rounded-2xl bg-[var(--surface)] p-4 text-sm text-[var(--ink-muted)] dark:border dark:border-[var(--hairline)]">
            Missing <code>ANTHROPIC_API_KEY</code>. Add it to{" "}
            <code>app/.env.local</code> and restart <code>npm run dev</code> to
            enable briefings.
          </div>
        )}
        <MatchdayHero
          fixture={featured}
          home={clubById(featured.homeId)}
          away={clubById(featured.awayId)}
        />
        <section>
          <h2 className="text-label mb-6">Opening window · June 11–14</h2>
          <ul role="list" className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
