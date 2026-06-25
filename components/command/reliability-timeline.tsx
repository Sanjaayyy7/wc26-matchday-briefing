"use client";

import { useState } from "react";
import type { ReliabilityTick } from "@/lib/command-data";

const TICK_COLOR: Record<ReliabilityTick["outcome"], string> = {
  hit: "var(--up)",
  correct: "var(--up)",
  miss: "var(--down)",
  neutral: "var(--ink-faint)",
};

export function ReliabilityTimeline({ ticks }: { ticks: ReliabilityTick[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (ticks.length === 0) return null;
  const cur = active !== null ? ticks[active] : null;

  return (
    <section className="border-t border-[var(--line)] px-6 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-label font-semibold text-[var(--ink)]">
          Reliability Timeline
        </div>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
        <div className="text-fine text-[var(--ink-faint)]">last {ticks.length} settled</div>
      </div>
      <div className="flex items-end gap-0.5 h-10">
        {ticks.map((t, i) => (
          <button
            key={t.slug + i}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="w-1 rounded-sm transition-opacity"
            style={{
              height: `${Math.max(20, 100 - t.brier * 80)}%`,
              backgroundColor: TICK_COLOR[t.outcome],
              opacity: active === null || active === i ? 1 : 0.4,
            }}
            aria-label={`${t.slug} ${t.result}`}
          />
        ))}
      </div>
      <div className="mt-2 h-4 text-fine text-[var(--ink-faint)]">
        {cur ? (
          <span>
            {cur.slug.replace(/-vs-/, " – ").replace(/-/g, " ")} · {cur.result} · Brier{" "}
            <span className="data-mono tabular text-[var(--ink-muted)]">{cur.brier.toFixed(3)}</span> ·{" "}
            <span className="uppercase">{cur.grade}</span>
          </span>
        ) : (
          <span className="opacity-50">Hover a forecast for settlement detail</span>
        )}
      </div>
    </section>
  );
}
