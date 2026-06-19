"use client";

import type { ChampionProjection } from "@/lib/command-data";

export function ChampionshipProjection({ projections }: { projections: ChampionProjection[] }) {
  const maxProb = projections[0]?.probability ?? 0.01;

  return (
    <div className="p-4">
      <div className="text-tiny font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-3">
        Championship projection · 10k simulations
      </div>
      <div>
        {projections.map((p) => (
          <div key={p.team} className="flex items-center gap-1.5 py-1 border-b border-[rgba(255,255,255,0.03)] last:border-0">
            <span className="text-fine text-[var(--ink-faint)] w-2.5 flex-shrink-0">{p.rank}</span>
            <span className={`text-xs flex-1 truncate ${p.rank === 1 ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
              {p.team}
            </span>
            <div className="w-9 h-1 bg-[var(--hairline)] rounded-full overflow-hidden flex-shrink-0">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(p.probability / maxProb) * 100}%`,
                  background: "linear-gradient(90deg, var(--signal-1), var(--up))",
                }}
              />
            </div>
            <span className="text-fine font-semibold tabular-nums text-[var(--ink-muted)] text-right w-9 flex-shrink-0">
              {(p.probability * 100).toFixed(1)}%
            </span>
            {p.delta !== undefined && Math.abs(p.delta) >= 0.001 && (
              <span className={`text-micro tabular-nums w-7 text-right flex-shrink-0 ${p.delta > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                {p.delta > 0 ? "+" : ""}{(p.delta * 100).toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="text-fine text-[var(--ink-faint)] mt-2">
        Δ vs previous simulation · updated after each settlement
      </div>
    </div>
  );
}
