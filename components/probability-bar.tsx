"use client";

import { motion } from "framer-motion";
import { NumberTicker } from "./number-ticker";
import type { Club } from "@/lib/data";
import { kitAccent } from "@/lib/kit-color";

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
    { key: "home", pct: probabilities.home, fill: kitAccent(home.primary, "up"), label: home.short },
    { key: "draw", pct: probabilities.draw, fill: "var(--neutral-fill)", label: "Draw" },
    { key: "away", pct: probabilities.away, fill: kitAccent(away.primary, "down"), label: away.short },
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
                  ? "font-[family-name:var(--font-display)] text-[clamp(2.25rem,3.6vw,3.25rem)] font-bold leading-none tracking-tight tabular"
                  : "font-[family-name:var(--font-display)] text-[clamp(1.375rem,2vw,1.75rem)] font-bold leading-none tracking-tight tabular"
              }
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex h-2 w-full gap-px overflow-hidden">
        {segments.map((s) => (
          <motion.div
            key={s.key}
            initial={{ width: 0 }}
            animate={{ width: `${s.pct}%` }}
            transition={{ type: "spring", stiffness: 80, damping: 24 }}
            style={{
              background: `linear-gradient(90deg, color-mix(in oklab, ${s.fill} 52%, var(--ink)), ${s.fill})`,
            }}
          />
        ))}
      </div>
      {probabilities.confidence && (
        <p className="text-caption mt-3">{probabilities.confidence}</p>
      )}
    </div>
  );
}
