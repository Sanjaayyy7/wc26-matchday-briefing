import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { OddsTable, type OddsRow } from "@/components/odds-table";
import { allClubs } from "@/lib/data";
import { kitAccent } from "@/lib/kit-color";
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
  const leaders = [...rows].sort((a, b) => b.champion - a.champion).slice(0, 5);

  return (
    <WCS26Shell
      route="simulator"
      title="Futures Board"
      rail={
        <SignalLine
          signals={[
            { label: "Runs", value: sim.runMeta.runs, detail: "full tournaments" },
            { label: "Seed", value: sim.runMeta.seed, detail: "reproducible" },
            { label: "Real locks", value: sim.runMeta.playedLocked, tone: "up", detail: "results in model" },
          ]}
        />
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Simulation engine" title="Every contender, priced like a futures desk.">
          <DataPlane>
            <div className="grid gap-10 lg:grid-cols-[minmax(0,0.95fr)_minmax(18rem,0.55fr)] lg:items-start">
              <p className="max-w-3xl text-title leading-relaxed">
                {sim.runMeta.runs.toLocaleString()} full tournaments sampled from the
                Elo + Dixon-Coles model: every unplayed match drawn from its score
                grid, FIFA group tiebreakers, the verified round-of-32 bracket, and
                extra-time/penalty resolution for drawn knockouts.{" "}
                {sim.runMeta.playedLocked} real results locked in.
              </p>
              <div>
                <p className="text-label">Champion pressure</p>
                <div className="mt-5 space-y-4">
                  {leaders.map((row, index) => (
                    <div key={row.id}>
                      <div className="mb-1 flex items-center justify-between gap-4">
                        <span className="text-title truncate">
                          <span className="text-caption tabular mr-2">{index + 1}</span>
                          {row.name}
                        </span>
                        <span className="text-label tabular">{(row.champion * 100).toFixed(1)}%</span>
                      </div>
                      <div className="h-1 w-full bg-[var(--neutral-fill)]">
                        <div
                          className="h-full"
                          style={{
                            width: `${Math.max(row.champion * 100, 1)}%`,
                            background: `linear-gradient(90deg, ${kitAccent(row.color, "up")}, transparent)`,
                          }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </DataPlane>
        </CanvasSection>
        <CanvasSection eyebrow="Tournament odds" title="Sortable champion board.">
          <DataPlane className="py-0">
            <OddsTable rows={rows} />
          </DataPlane>
        </CanvasSection>
        <CanvasSection eyebrow="Run metadata">
          <DataPlane>
            <p className="text-caption max-w-2xl">
              Run seed {sim.runMeta.seed} · data through {sim.runMeta.dataThrough} ·
              generated {sim.runMeta.generatedAt.slice(0, 16).replace("T", " ")} UTC.{" "}
              {sim.runMeta.knockoutVenueNote} Re-run with{" "}
              <code>npm run ml:simulate -- 50000</code>.
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
