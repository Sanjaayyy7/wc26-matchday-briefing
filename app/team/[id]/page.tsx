import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Crest } from "@/components/crest";
import { MatchRow } from "@/components/match-row";
import { allClubs, clubById, fixturesForTeam } from "@/lib/data";
import { buildMatchRow } from "@/lib/match-rows";
import { NumberTicker } from "@/components/number-ticker";
import model from "@/data/model.json";
import simulation from "@/data/simulation.json";

export function generateStaticParams() {
  return allClubs().map((c) => ({ id: c.id }));
}

export default async function TeamPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  let club;
  try {
    club = clubById(id);
  } catch {
    notFound();
  }
  const key = club.datasetName ?? club.name;
  const ratings = (model as { ratings: Record<string, number> }).ratings;
  const forms = (
    model as { forms: Record<string, { results: string; gf: number; ga: number }> }
  ).forms;
  const sim = (
    simulation as {
      teams: Record<
        string,
        { advanceGroup: number; reachQF: number; reachFinal: number; champion: number }
      >;
    }
  ).teams;
  const rating = ratings[key];
  const rank =
    Object.values(ratings)
      .map(Number)
      .filter((r) => r > rating).length + 1;
  const odds = sim[key];
  const form = forms[key];
  const rows = fixturesForTeam(id).map(buildMatchRow);

  const stat = (label: string, value: number) => (
    <div className="flex flex-col gap-1">
      <span className="text-label">{label}</span>
      <NumberTicker
        value={value * 100}
        suffix="%"
        className="text-display text-2xl"
      />
    </div>
  );

  return (
    <>
      <SiteHeader />
      <main className="mx-auto max-w-6xl px-6 py-12 md:py-16">
        <div className="space-y-16">
          <section className="animate-rise flex items-center gap-5">
            <Crest
              short={club.short}
              primary={club.primary}
              secondary={club.secondary}
              name={club.name}
              size={72}
            />
            <div>
              <h1 className="text-title text-3xl">{club.name}</h1>
              <p className="text-caption mt-1">
                Group {club.group} · Elo <span className="tabular">{rating}</span> (world #
                <span className="tabular">{rank}</span>)
              </p>
            </div>
          </section>

          {odds && (
          <section className="animate-rise">
            <h2 className="text-label mb-5">Tournament odds — 10,000 simulations</h2>
            <div className="grid gap-6 sm:grid-cols-4">
              {stat("Advance group", odds.advanceGroup)}
              {stat("Quarter-final", odds.reachQF)}
              {stat("Final", odds.reachFinal)}
              {stat("Champion", odds.champion)}
            </div>
          </section>
          )}

          {form && (
          <section className="animate-rise">
            <h2 className="text-label mb-3">Last 10 internationals (recent first)</h2>
            <div className="flex items-center gap-1.5">
              {form.results.split("").map((r, i) => (
                <span
                  key={i}
                  className="text-caption tabular grid h-7 w-7 place-items-center rounded-lg font-semibold"
                  style={{
                    background:
                      r === "W"
                        ? "var(--up)"
                        : r === "L"
                          ? "var(--down)"
                          : "var(--neutral-fill)",
                    color: r === "D" ? "var(--ink-muted)" : "var(--canvas)",
                  }}
                >
                  {r}
                </span>
              ))}
              <span className="text-caption tabular ml-3">
                {form.gf}–{form.ga} over the run
              </span>
            </div>
          </section>
          )}

          <section className="animate-rise">
          <h2 className="text-label mb-4">Group {club.group} schedule</h2>
          <div className="space-y-2">
            {rows.map((m) => (
              <MatchRow key={m.slug} m={m} />
            ))}
          </div>
        </section>
        </div>
      </main>
    </>
  );
}
