"use client";

import { motion } from "framer-motion";
import type { Club } from "@/lib/data";

function contrastInk(hex: string): string {
  if (!hex.startsWith("#")) return "var(--canvas)";
  const c = hex.replace("#", "");
  const r = parseInt(c.slice(0, 2), 16);
  const g = parseInt(c.slice(2, 4), 16);
  const b = parseInt(c.slice(4, 6), 16);
  const l = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return l > 0.55 ? "#0a1d3a" : "#f5f5f0";
}

export function ProbabilityBar({
  probabilities,
  home,
  away,
}: {
  probabilities: {
    home: number;
    draw: number;
    away: number;
    confidence: string;
  };
  home: Club;
  away: Club;
}) {
  const segments = [
    { key: "home", pct: probabilities.home, color: home.primary, label: home.short },
    { key: "draw", pct: probabilities.draw, color: "#d4af37", label: "DRAW" },
    { key: "away", pct: probabilities.away, color: away.primary, label: away.short },
  ];
  return (
    <div>
      {probabilities.confidence && (
        <div className="mb-3 inline-block rounded-full border border-[var(--hairline)] px-2 py-0.5 font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
          {probabilities.confidence}
        </div>
      )}
      <div className="flex h-12 w-full overflow-hidden rounded-md border border-[var(--hairline)]">
        {segments.map((s) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ duration: 0.7, ease: "easeOut" }}
            className="flex items-center justify-center font-mono text-xs font-semibold"
            style={{ background: s.color, color: contrastInk(s.color) }}
          >
            {s.pct}%
          </motion.div>
        ))}
      </div>
      <div className="mt-2 flex justify-between font-mono text-[10px] uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        {segments.map((s) => (
          <span key={s.key}>{s.label}</span>
        ))}
      </div>
    </div>
  );
}
