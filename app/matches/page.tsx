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
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-10 px-6 py-12">
        <div>
          <h1 className="text-title text-2xl">All matches</h1>
          <p className="text-caption mt-1">
            {rows.length} group-stage fixtures · model splits locked before kickoff
          </p>
        </div>
        <MatchesFilter rows={rows} />
        <section>
          <h2 className="text-label mb-4">Round of 32 — slots set after the groups</h2>
          <div className="space-y-2">
            {(knockouts as Array<{ match: number; homeLabel: string; awayLabel: string }>).map(
              (k) => (
                <div
                  key={k.match}
                  className="grid grid-cols-[5.5rem_1fr] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 opacity-70 dark:border dark:border-[var(--hairline)]"
                >
                  <span className="text-caption tabular">Match {k.match}</span>
                  <span className="text-[14px] text-[var(--ink-muted)]">
                    {k.homeLabel} vs {k.awayLabel}
                  </span>
                </div>
              ),
            )}
          </div>
        </section>
      </main>
    </>
  );
}
