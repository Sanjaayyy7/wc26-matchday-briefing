import { WCS26Shell } from "@/components/wc26-shell";
import Link from "next/link";
import { Crest } from "@/components/crest";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
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
          <DataPlane>
          <ul className="divide-y divide-[var(--line)]">
            {clubs.map((c, i) => {
              const key = c.datasetName ?? c.name;
              return (
                <li key={c.id}>
                  <Link
                    href={`/team/${c.id}`}
                    className="grid grid-cols-[2rem_auto_1fr_auto] items-center gap-4 py-4 transition-colors duration-300 hover:bg-[var(--panel)]"
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
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
