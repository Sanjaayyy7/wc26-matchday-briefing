"use client";

import { useMemo } from "react";
import { deriveHeatmap } from "@/lib/derive-heatmap";
import type { Club } from "@/lib/data";

export function ScorelineHeatmap({
  probabilities,
  scoreline,
  home,
  away,
}: {
  probabilities: { home: number; draw: number; away: number };
  scoreline: { home: number; away: number };
  home: Club;
  away: Club;
}) {
  const hm = useMemo(
    () => deriveHeatmap({ scoreline, probabilities }),
    [scoreline, probabilities],
  );
  const max = Math.max(...hm.grid.flat());
  return (
    <div>
      <div className="grid grid-cols-[auto_repeat(6,minmax(0,1fr))] gap-1 text-center">
        <div aria-hidden />
        {Array.from({ length: 6 }, (_, a) => (
          <div key={a} className="text-caption tabular">
            {a === 5 ? "5+" : a}
          </div>
        ))}
        {Array.from({ length: 6 }, (_, h) => (
          <Row key={h} h={h} grid={hm.grid} max={max} mode={hm.mode} />
        ))}
      </div>
      <div className="text-caption mt-3 flex justify-between">
        <span>↑ {home.short} goals</span>
        <span>{away.short} goals →</span>
      </div>
    </div>
  );
}

function Row({
  h,
  grid,
  max,
  mode,
}: {
  h: number;
  grid: number[][];
  max: number;
  mode: { home: number; away: number };
}) {
  return (
    <>
      <div className="text-caption tabular self-center">
        {h === 5 ? "5+" : h}
      </div>
      {grid[h].map((p, a) => {
        const intensity = max > 0 ? Math.min(1, p / max) : 0;
        const isMode = h === mode.home && a === mode.away;
        return (
          <div
            key={a}
            className="text-caption tabular grid aspect-square place-items-center border border-transparent"
            style={
              isMode
                ? {
                    background: "var(--up)",
                    color: "var(--canvas)",
                    fontWeight: 700,
                    borderColor: "var(--canvas)",
                  }
                : {
                    background: `color-mix(in oklab, var(--elevated) ${
                      100 - intensity * 80
                    }%, var(--up) ${intensity * 80}%)`,
                    color:
                      intensity > 0.5 ? "var(--canvas)" : "var(--ink-muted)",
                  }
            }
            title={`${h}-${a}: ${(p * 100).toFixed(1)}%`}
          >
            {(p * 100).toFixed(0)}
          </div>
        );
      })}
    </>
  );
}
