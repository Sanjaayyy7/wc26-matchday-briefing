"use client";

import { useMemo } from "react";
import { motion } from "framer-motion";
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
          <div
            key={a}
            className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]"
          >
            {a === 5 ? "5+" : a}
          </div>
        ))}
        {Array.from({ length: 6 }, (_, h) => (
          <Row key={h} h={h} grid={hm.grid} max={max} mode={hm.mode} />
        ))}
      </div>
      <div className="mt-3 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
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
      <div className="font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {h === 5 ? "5+" : h}
      </div>
      {grid[h].map((p, a) => {
        const intensity = max > 0 ? Math.min(1, p / max) : 0;
        const isMode = h === mode.home && a === mode.away;
        return (
          <motion.div
            key={a}
            initial={{ opacity: 0, scale: 0.92 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: (h * 6 + a) * 0.012, duration: 0.25 }}
            className="grid aspect-square place-items-center rounded-sm font-mono text-[10px]"
            style={{
              background: `color-mix(in oklab, var(--elevated) ${
                100 - intensity * 100
              }%, var(--gold) ${intensity * 100}%)`,
              boxShadow: isMode
                ? "0 0 0 2px var(--gold), 0 0 16px rgba(212,175,55,0.55)"
                : "none",
              color: intensity > 0.5 ? "#0a1d3a" : "var(--ink-muted)",
            }}
            title={`${h}-${a}: ${(p * 100).toFixed(1)}%`}
          >
            {(p * 100).toFixed(0)}
          </motion.div>
        );
      })}
    </>
  );
}
