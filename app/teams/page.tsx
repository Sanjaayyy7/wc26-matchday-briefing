import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { Crest } from "@/components/crest";
import { NumberTicker } from "@/components/number-ticker";
import { allClubs } from "@/lib/data";
import model from "@/data/model.json";
import simulation from "@/data/simulation.json";

export const metadata = { title: "Teams — Matchday Briefing" };

export default function TeamsPage() {
  const ratings = (model as { ratings: Record<string, number> }).ratings;
  const sim = (simulation as { teams: Record<string, { champion: number }> }).teams;
  const clubs = [...allClubs()].sort((a, b) => {
    const ra = ratings[a.datasetName ?? a.name] ?? 0;
    const rb = ratings[b.datasetName ?? b.name] ?? 0;
    return rb - ra;
  });
  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="space-y-16">
        <section className="animate-rise">
          <h1 className="text-title text-2xl">Teams</h1>
          <p className="text-caption mt-1">All 48, ordered by Elo rating</p>
        </section>
        <section className="animate-rise">
          <h2 className="text-label mb-4">Power rating table</h2>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c, i) => {
              const key = c.datasetName ?? c.name;
              return (
                <li key={c.id}>
                  <Link
                    href={`/team/${c.id}`}
                    className="flex items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 transition-colors duration-300 hover:bg-[var(--elevated)] dark:border dark:border-[var(--hairline)]"
                  >
                    <span className="text-caption tabular w-6">{i + 1}</span>
                    <Crest
                      short={c.short}
                      primary={c.primary}
                      secondary={c.secondary}
                      name={c.name}
                      size={40}
                    />
                    <span className="text-title flex-1 truncate">{c.name}</span>
                    <span className="flex flex-col items-end">
                      {ratings[key] !== undefined ? (
                        <NumberTicker
                          value={ratings[key]}
                          className="text-title"
                        />
                      ) : (
                        <span className="text-title">—</span>
                      )}
                      <span className="text-caption tabular">
                        cup {((sim[key]?.champion ?? 0) * 100).toFixed(1)}%
                      </span>
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
        </div>
      </main>
    </>
  );
}
