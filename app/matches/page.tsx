import { SiteHeader } from "@/components/site-header";
import { MatchesFilter } from "@/components/matches-filter";
import { allMatchRows } from "@/lib/match-rows";
import knockouts from "@/data/knockouts.json";

export const metadata = { title: "Matches — Matchday Briefing" };

export default function MatchesPage() {
  const rows = allMatchRows();
  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-6 py-12 md:py-16">
        <div className="min-w-0 space-y-16">
        <section className="animate-rise">
          <h1 className="text-title text-2xl">All matches</h1>
          <p className="text-caption mt-1">
            {rows.length} group-stage fixtures · settled results, locked calls, and upcoming model splits
          </p>
        </section>
        <section className="animate-rise">
          <h2 className="text-label mb-4">Fixture list</h2>
          <MatchesFilter rows={rows} />
        </section>
        <section className="animate-rise">
          <h2 className="text-label mb-4">Round of 32 — slots set after the groups</h2>
          <div className="space-y-2">
            {(knockouts as Array<{ match: number; homeLabel: string; awayLabel: string }>).map(
              (k) => (
                <div
                  key={k.match}
                  className="grid grid-cols-[5.5rem_1fr] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 opacity-70 dark:border dark:border-[var(--hairline)]"
                >
                  <span className="text-caption tabular">Match {k.match}</span>
                  <span className="text-caption">
                    {k.homeLabel} vs {k.awayLabel}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
        </div>
      </main>
    </>
  );
}
