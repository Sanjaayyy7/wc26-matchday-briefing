"use client";

import type { PlayerRowView, ClusterSummaryRow } from "@/lib/player-view";

const CLUSTER_COLORS = [
  "var(--up)",
  "var(--stage-final)",
  "var(--stage-sf)",
  "var(--stage-qf)",
  "var(--down)",
  "var(--stage-r16)",
];

/**
 * 2D scatter of player clusters using CSS-grid / probability-bar primitives.
 * X axis = goals, Y axis = impact score (both normalized to [0,100] for display).
 * No external charting library — renders purely with Tailwind + inline CSS.
 */
export function StyleClusterPlot({
  players,
  summary,
}: {
  players: PlayerRowView[];
  summary: ClusterSummaryRow[];
}) {
  const maxGoals = Math.max(1, ...players.map((p) => p.goals));
  const maxImpact = Math.max(0.01, ...players.map((p) => p.impact));

  const labelMap = new Map(summary.map((s) => [s.cluster, s.label]));

  return (
    <div>
      {/* Legend */}
      <div className="mb-6 flex flex-wrap gap-4">
        {summary.map((s) => (
          <div key={s.cluster} className="flex items-center gap-2">
            <span
              className="inline-block h-3 w-3 rounded-full"
              style={{ background: CLUSTER_COLORS[s.cluster % CLUSTER_COLORS.length] }}
            />
            <span className="text-caption">
              {s.label} ({s.playerCount})
            </span>
          </div>
        ))}
      </div>

      {/* Scatter plot area */}
      <div
        className="relative border border-[var(--line)]"
        style={{ height: 320, overflow: "hidden" }}
        aria-label="Player style cluster scatter plot: X=goals, Y=impact"
      >
        {/* Y-axis label */}
        <div
          className="absolute left-1 top-1/2 text-caption text-[var(--ink-muted)]"
          style={{ transform: "rotate(-90deg) translateX(-50%)", transformOrigin: "center", whiteSpace: "nowrap", fontSize: 10 }}
        >
          Impact ↑
        </div>

        {/* X-axis label */}
        <div className="absolute bottom-1 right-2 text-caption text-[var(--ink-muted)]" style={{ fontSize: 10 }}>
          Goals →
        </div>

        {/* Grid lines */}
        <div className="absolute inset-8">
          <div className="absolute inset-0 border border-[var(--line)] opacity-30" />
          <div className="absolute left-1/2 top-0 bottom-0 w-px border-l border-[var(--line)] border-dashed opacity-20" />
          <div className="absolute top-1/2 left-0 right-0 h-px border-t border-[var(--line)] border-dashed opacity-20" />
        </div>

        {/* Data points */}
        <div className="absolute inset-8">
          {players.map((p) => {
            const x = (p.goals / maxGoals) * 100;
            const y = 100 - (p.impact / maxImpact) * 100;
            const color = CLUSTER_COLORS[p.cluster % CLUSTER_COLORS.length];
            return (
              <div
                key={p.id}
                title={`${p.name} (${labelMap.get(p.cluster) ?? "?"}) G=${p.goals} Impact=${p.impact.toFixed(3)}`}
                style={{
                  position: "absolute",
                  left: `${x}%`,
                  top: `${y}%`,
                  transform: "translate(-50%, -50%)",
                  width: p.goals > 0 ? 10 : 6,
                  height: p.goals > 0 ? 10 : 6,
                  borderRadius: "50%",
                  background: color,
                  opacity: p.isSeeded ? 0.5 : 0.9,
                  border: p.goals > 0 ? `2px solid ${color}` : "none",
                }}
              />
            );
          })}
        </div>
      </div>

      {/* Cluster summary table */}
      <div className="mt-6 divide-y divide-[var(--line)]">
        {summary.map((s) => (
          <div
            key={s.cluster}
            className="grid grid-cols-[auto_1fr_auto_auto_auto] items-center gap-4 py-3"
          >
            <span
              className="h-3 w-3 shrink-0 rounded-full"
              style={{ background: CLUSTER_COLORS[s.cluster % CLUSTER_COLORS.length] }}
            />
            <div className="min-w-0">
              <span className="text-title">{s.label}</span>
              <span className="text-caption ml-2">
                {s.topPlayers.slice(0, 2).join(", ")}
                {s.playerCount > 2 ? ` +${s.playerCount - 2}` : ""}
              </span>
            </div>
            <span className="text-caption tabular text-[var(--ink-muted)]">
              {s.avgGoals.toFixed(1)}G
            </span>
            <span className="text-caption tabular text-[var(--ink-muted)]">
              {s.avgAssists.toFixed(1)}A
            </span>
            <span className="text-caption tabular">
              {s.avgImpact.toFixed(3)} imp
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}
