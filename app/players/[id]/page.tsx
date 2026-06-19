import { notFound } from "next/navigation";
import { AppChrome } from "@/components/app-chrome";
import { CanvasSection, DataPlane, MetricRun, RouteStack, SignalLine } from "@/components/cinematic";
import { NumberTicker } from "@/components/number-ticker";
import { allPlayerRows, playerById } from "@/lib/player-view";

export function generateStaticParams() {
  return allPlayerRows().map((p) => ({ id: p.id }));
}

export default async function PlayerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const player = playerById(id);
  if (!player) notFound();

  // Nearest teammates: same cluster, same team, sorted by impact desc
  const all = allPlayerRows();
  const teammates = all
    .filter((p) => p.id !== id && p.teamId === player.teamId && p.cluster === player.cluster)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 4);

  // All cluster-mates
  const clusterMates = all
    .filter((p) => p.id !== id && p.cluster === player.cluster)
    .sort((a, b) => b.impact - a.impact)
    .slice(0, 5);

  const per90 = player.minutes > 0 ? (90 / player.minutes) : 0;
  const goalsPer90 = (player.goals * per90).toFixed(2);
  const assistsPer90 = (player.assists * per90).toFixed(2);

  return (
    <AppChrome route="players">
      <RouteStack>
        {/* Hero */}
        <section
          className="animate-rise relative -mx-6 grid min-h-80 gap-10 overflow-hidden px-6 py-16 md:grid-cols-[auto_1fr] md:items-end md:py-24"
          style={{ background: `linear-gradient(135deg, color-mix(in oklab, ${player.teamPrimary} 15%, var(--bg)), var(--bg))` }}
        >
          <div className="chroma-rule absolute left-6 top-0 h-px w-64 md:w-96" />
          <div className="absolute bottom-0 left-0 h-1 w-full" style={{ background: player.teamPrimary }} />
          <div
            className="flex h-16 w-16 items-center justify-center border text-xl font-bold"
            style={{ background: player.teamPrimary, color: player.teamSecondary, borderColor: player.teamPrimary }}
          >
            {player.teamShort}
          </div>
          <div>
            <div className="flex flex-wrap items-center gap-3">
              <h1 className="text-hero">{player.name}</h1>
              {player.isSeeded && (
                <span className="rounded-sm border border-[var(--stage-sf)] px-2 py-0.5 text-caption text-[var(--stage-sf)]">
                  seeded data
                </span>
              )}
            </div>
            <p className="text-caption mt-2">
              {player.teamName} · {player.position}
              {player.group ? ` · Group ${player.group}` : ""}
            </p>
            <div className="mt-8 grid gap-6 border-t border-[var(--line)] pt-6 sm:grid-cols-4">
              <div>
                <span className="text-label">Goals</span>
                <NumberTicker value={player.goals} className="text-display mt-1 block text-4xl" />
              </div>
              <div>
                <span className="text-label">Assists</span>
                <NumberTicker value={player.assists} className="text-display mt-1 block text-4xl" />
              </div>
              <div>
                <span className="text-label">Minutes</span>
                <NumberTicker value={player.minutes} suffix="′" className="text-display mt-1 block text-4xl" />
              </div>
              <div>
                <span className="text-label">Impact</span>
                <NumberTicker
                  value={player.impact * 1000}
                  decimals={0}
                  className="text-display mt-1 block text-4xl text-[var(--up)]"
                />
                <span className="text-caption">×10⁻³</span>
              </div>
            </div>
          </div>
        </section>

        {/* Rail stats */}
        <SignalLine
          signals={[
            { label: "Goals/90", value: parseFloat(goalsPer90), decimals: 2, detail: "raw rate" },
            { label: "Assists/90", value: parseFloat(assistsPer90), decimals: 2, detail: "raw rate" },
            { label: "Cluster", value: player.cluster, detail: player.clusterLabel },
            { label: "Appearances", value: player.appearances, detail: "matches" },
          ]}
        />

        {/* Impact breakdown */}
        <CanvasSection eyebrow="Impact breakdown" title="Shrunk per-90 contribution.">
          <DataPlane>
            <MetricRun
              items={[
                { label: "Goals/90 (raw)", value: goalsPer90, tone: player.goals > 0 ? "up" : "neutral" },
                { label: "Assists/90 (raw)", value: assistsPer90, tone: player.assists > 0 ? "up" : "neutral" },
                { label: "Impact score (shrunk)", value: player.impact.toFixed(4), tone: "up" },
                { label: "Cluster", value: player.clusterLabel },
                { label: "Cluster distance", value: player.clusterDistance.toFixed(3) },
              ]}
            />
          </DataPlane>
        </CanvasSection>

        {/* Nearest teammates in same cluster */}
        {teammates.length > 0 && (
          <CanvasSection eyebrow={`${player.clusterLabel} teammates`} title="Same style cluster, same nation.">
            <DataPlane>
              <ul className="divide-y divide-[var(--line)]">
                {teammates.map((t) => (
                  <li key={t.id} className="grid grid-cols-[1fr_auto_auto] items-center gap-4 py-3">
                    <span className="text-title">{t.name}</span>
                    <span className="text-caption tabular">{t.goals}G {t.assists}A</span>
                    <span className="text-label tabular">{t.impact.toFixed(3)}</span>
                  </li>
                ))}
              </ul>
            </DataPlane>
          </CanvasSection>
        )}

        {/* Cluster-mates across tournament */}
        <CanvasSection eyebrow={`${player.clusterLabel} cluster`} title="Nearest players across tournament.">
          <DataPlane>
            <ul className="divide-y divide-[var(--line)]">
              {clusterMates.map((t) => (
                <li key={t.id} className="grid grid-cols-[auto_1fr_auto_auto] items-center gap-4 py-3">
                  <span
                    className="h-2 w-2 shrink-0 rounded-full"
                    style={{ background: t.teamPrimary }}
                  />
                  <div className="min-w-0">
                    <span className="text-title block truncate">{t.name}</span>
                    <span className="text-caption">{t.teamName}</span>
                  </div>
                  <span className="text-caption tabular">{t.goals}G {t.assists}A</span>
                  <span className="text-label tabular">{t.impact.toFixed(3)}</span>
                </li>
              ))}
              {clusterMates.length === 0 && (
                <li className="py-3 text-caption text-[var(--ink-muted)]">No cluster-mates found.</li>
              )}
            </ul>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </AppChrome>
  );
}
