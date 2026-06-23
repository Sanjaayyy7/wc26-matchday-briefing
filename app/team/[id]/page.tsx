import { notFound } from "next/navigation";
import { WCS26Shell } from "@/components/wc26-shell";
import { Crest } from "@/components/crest";
import { CanvasSection, DataPlane, MatchMarketLine, RouteStack } from "@/components/cinematic";
import { allClubs, clubById, fixturesForTeam } from "@/lib/data";
import { buildMatchRow } from "@/lib/match-rows";
import { kitPairWashStyle } from "@/lib/kit-color";
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
    <div className="border-b border-[var(--line)] pb-4 last:border-0">
      <span className="text-label">{label}</span>
      <NumberTicker
        value={value * 100}
        suffix="%"
        className="text-display text-2xl"
      />
    </div>
  );

  return (
    <WCS26Shell route="teams">
      <RouteStack>
        <section className="animate-rise relative -mx-6 grid min-h-120 gap-10 overflow-hidden px-6 py-16 md:grid-cols-[auto_1fr] md:items-end md:py-24" style={kitPairWashStyle(club.primary, club.secondary)}>
          <div className="chroma-rule absolute left-6 top-0 h-px w-64 md:w-96" />
          <div className="absolute bottom-0 left-0 h-1 w-1/2" style={{ background: "var(--kit-home)" }} />
          <div className="absolute bottom-0 right-0 h-1 w-1/2" style={{ background: "var(--kit-away)" }} />
          <Crest
            short={club.short}
            primary={club.primary}
            secondary={club.secondary}
            name={club.name}
            size={72}
          />
          <div>
            <h1 className="text-hero">{club.name}</h1>
            <p className="text-caption mt-1">
              Group {club.group} · Elo <span className="tabular">{rating}</span> (world #
              <span className="tabular">{rank}</span>)
            </p>
            <div className="mt-10 grid gap-5 border-t border-[var(--line)] pt-6 sm:grid-cols-3">
              <div>
                <span className="text-label">Elo</span>
                <NumberTicker value={rating} className="mt-1 block font-[family-name:var(--font-display)] text-[clamp(1.625rem,2.4vw,2.25rem)] font-bold leading-none tracking-tight tabular" />
                <span className="text-caption tabular">world #{rank}</span>
              </div>
              <div>
                <span className="text-label">Advance</span>
                <NumberTicker
                  value={(odds?.advanceGroup ?? 0) * 100}
                  suffix="%"
                  decimals={1}
                  className="mt-1 block font-[family-name:var(--font-display)] text-[clamp(1.625rem,2.4vw,2.25rem)] font-bold leading-none tracking-tight tabular"
                />
              </div>
              <div>
                <span className="text-label">Champion</span>
                <NumberTicker
                  value={(odds?.champion ?? 0) * 100}
                  suffix="%"
                  decimals={1}
                  className="mt-1 block font-[family-name:var(--font-display)] text-[clamp(1.625rem,2.4vw,2.25rem)] font-bold leading-none tracking-tight tabular text-[var(--up)]"
                />
              </div>
            </div>
          </div>
        </section>

        {odds && (
          <CanvasSection eyebrow="Tournament odds" title="Simulation probabilities.">
            <DataPlane>
              <div className="grid gap-6 sm:grid-cols-4">
                {stat("Advance group", odds.advanceGroup)}
                {stat("Quarter-final", odds.reachQF)}
                {stat("Final", odds.reachFinal)}
                {stat("Champion", odds.champion)}
              </div>
            </DataPlane>
          </CanvasSection>
        )}

        {form && (
          <CanvasSection eyebrow="Form strip" title="Last 10 internationals, recent first.">
            <DataPlane>
              <div className="flex items-center gap-1.5">
                {form.results.split("").map((r, i) => (
                  <span
                    key={i}
                    className="text-title tabular border-b-2 px-1 font-semibold"
                    style={{
                      borderColor:
                        r === "W"
                          ? "var(--up)"
                          : r === "L"
                            ? "var(--down)"
                            : "var(--neutral-fill)",
                      color:
                        r === "W"
                          ? "var(--up)"
                          : r === "L"
                            ? "var(--down)"
                            : "var(--ink-muted)",
                    }}
                  >
                    {r}
                  </span>
                ))}
                <span className="text-caption tabular ml-3">
                  {form.gf}–{form.ga} over the run
                </span>
              </div>
            </DataPlane>
          </CanvasSection>
        )}

        <CanvasSection eyebrow={`Group ${club.group} schedule`} title="Match rooms for this dossier.">
          <DataPlane>
            <div>
              {rows.map((m) => (
                <MatchMarketLine key={m.slug} row={m} />
              ))}
            </div>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
