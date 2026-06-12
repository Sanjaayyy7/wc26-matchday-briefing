"use client";

import { motion } from "framer-motion";
import { NumberTicker } from "./number-ticker";
import type { Club } from "@/lib/data";

export function ProbabilityBar({
  probabilities,
  home,
  away,
  hero = false,
}: {
  probabilities: {
    home: number;
    draw: number;
    away: number;
    confidence: string;
  };
  home: Club;
  away: Club;
  /** Page-hero sizing: the three percentages become the dominant element. */
  hero?: boolean;
}) {
  const segments = [
    { key: "home", pct: probabilities.home, fill: "var(--up)", label: home.short },
    { key: "draw", pct: probabilities.draw, fill: "var(--neutral-fill)", label: "Draw" },
    { key: "away", pct: probabilities.away, fill: "var(--down)", label: away.short },
  ];
  return (
    <div>
      <div className="grid grid-cols-3 gap-4">
        {segments.map((s) => (
          <div key={s.key} className="flex flex-col gap-1">
            <span className="text-label">{s.label}</span>
            <NumberTicker
              value={s.pct}
              suffix="%"
              className={
                hero
                  ? "text-[clamp(36px,6vw,56px)] font-bold leading-none tracking-[-0.022em]"
                  : "text-[28px] font-bold tracking-[-0.02em]"
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-2 w-full gap-px overflow-hidden rounded-full">
        {segments.map((s) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 24 }}
            style={{ background: s.fill }}
          />
        ))}
      </div>
      {probabilities.confidence && (
        <p className="text-caption mt-3">{probabilities.confidence}</p>
      )}
    </div>
  );
}
