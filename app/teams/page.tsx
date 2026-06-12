import { SiteHeader } from "@/components/site-header";
import Link from "next/link";
import { Crest } from "@/components/crest";
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
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-10 px-6 py-12">
        <div>
          <h1 className="text-title text-2xl">Teams</h1>
          <p className="text-caption mt-1">All 48, ordered by Elo rating</p>
        </div>
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
                  <span className="flex-1 truncate text-[15px] font-medium">
                    {c.name}
                  </span>
                  <span className="flex flex-col items-end">
                    <span className="tabular text-[15px] font-semibold">
                      {ratings[key] ?? "—"}
                    </span>
                    <span className="text-caption tabular">
                      cup {((sim[key]?.champion ?? 0) * 100).toFixed(1)}%
                    </span>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </main>
    </>
  );
}
