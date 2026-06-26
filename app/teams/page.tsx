import { WCS26Shell } from "@/components/wc26-shell";
import Link from "next/link";
import { Crest } from "@/components/crest";
import { CanvasSection, RouteStack, SignalLine } from "@/components/cinematic";
import { NumberTicker } from "@/components/number-ticker";
import { Surface } from "@/components/ui/surface";
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
    <WCS26Shell
      route="teams"
      title="Team Dossiers"
      rail={
        <SignalLine
          signals={[
            { label: "Teams", value: clubs.length, detail: "qualified field" },
            { label: "Top Elo", value: ratings[clubs[0].datasetName ?? clubs[0].name] ?? 0, tone: "up", detail: clubs[0].name },
            { label: "Champion max", value: (sim[clubs[0].datasetName ?? clubs[0].name]?.champion ?? 0) * 100, suffix: "%", decimals: 1, detail: "current leader" },
          ]}
        />
      }
    >
      <RouteStack>
        <CanvasSection eyebrow="Power rating table" title="All 48 dossiers, ranked by Elo.">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {clubs.map((c, i) => {
              const key = c.datasetName ?? c.name;
              const champPct = (sim[key]?.champion ?? 0) * 100;
              return (
                <Surface key={c.id} interactive>
                  <Link
                    href={`/team/${c.id}`}
                    className="group flex items-center gap-3 p-4 transition-colors duration-300 hover:bg-[var(--panel)]"
                  >
                    <span className="text-label tabular w-6 shrink-0 text-[var(--ink-faint)]">{i + 1}</span>
                    <Crest
                      short={c.short}
                      primary={c.primary}
                      secondary={c.secondary}
                      name={c.name}
                      size={40}
                    />
                    <span className="min-w-0 flex-1">
                      <span className="text-title block truncate transition-colors duration-300 group-hover:text-[var(--accent)]">{c.name}</span>
                      <span className="text-label tabular mt-0.5 block text-[var(--ink-muted)]">
                        cup <span className="text-[var(--up)]">{champPct.toFixed(1)}%</span>
                      </span>
                    </span>
                    <span className="shrink-0 text-right">
                      {ratings[key] !== undefined ? (
                        <NumberTicker
                          value={ratings[key]}
                          className="text-display"
                        />
                      ) : (
                        <span className="text-display">—</span>
                      )}
                      <span className="text-label tabular mt-0.5 block text-[var(--ink-faint)]">Elo</span>
                    </span>
                  </Link>
                </Surface>
              );
            })}
          </div>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
