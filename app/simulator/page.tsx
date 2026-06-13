import { SiteHeader } from "@/components/site-header";
import { OddsTable, type OddsRow } from "@/components/odds-table";
import { allClubs } from "@/lib/data";
import simulation from "@/data/simulation.json";
import model from "@/data/model.json";

export const metadata = { title: "Simulator — Matchday Briefing" };

export default function SimulatorPage() {
  const sim = simulation as {
    runMeta: {
      runs: number;
      seed: number;
      dataThrough: string;
      generatedAt: string;
      playedLocked: number;
      knockoutVenueNote: string;
    };
    teams: Record<
      string,
      {
        advanceGroup: number;
        reachQF: number;
        reachFinal: number;
        champion: number;
      }
    >;
  };
  const ratings = (model as { ratings: Record<string, number> }).ratings;
  const rows: OddsRow[] = allClubs().map((c) => {
    const key = c.datasetName ?? c.name;
    const o = sim.teams[key];
    return {
      id: c.id,
      name: c.name,
      color: c.primary,
      group: c.group ?? "—",
      elo: ratings[key],
      advanceGroup: o?.advanceGroup ?? 0,
      reachQF: o?.reachQF ?? 0,
      reachFinal: o?.reachFinal ?? 0,
      champion: o?.champion ?? 0,
    };
  });

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl overflow-x-hidden px-6 py-12 md:py-16">
        <div className="min-w-0 space-y-16">
        <section className="animate-rise min-w-0">
          <h1 className="text-title text-2xl">Tournament simulator</h1>
          <p className="mt-2 max-w-2xl text-[var(--ink-muted)]">
            {sim.runMeta.runs.toLocaleString()} full tournaments sampled from the
            Elo + Dixon-Coles model: every unplayed match drawn from its score
            grid, FIFA group tiebreakers, the verified round-of-32 bracket, and
            extra-time/penalty resolution for drawn knockouts.{" "}
            {sim.runMeta.playedLocked} real results locked in.
          </p>
        </section>
        <section className="animate-rise">
          <h2 className="text-label mb-4">Tournament odds</h2>
          <OddsTable rows={rows} />
        </section>
        <section className="animate-rise">
          <h2 className="text-label mb-4">Run metadata</h2>
          <p className="text-caption max-w-2xl">
            Run seed {sim.runMeta.seed} · data through {sim.runMeta.dataThrough} ·
            generated {sim.runMeta.generatedAt.slice(0, 16).replace("T", " ")} UTC.{" "}
            {sim.runMeta.knockoutVenueNote} Re-run with{" "}
            <code>npm run ml:simulate -- 50000</code>.
          </p>
        </section>
        </div>
      </main>
    </>
  );
}
