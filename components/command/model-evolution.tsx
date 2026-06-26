"use client";

import type { EvolutionEntry } from "@/lib/command-data";
import { Surface } from "@/components/ui/surface";

const ENTRY_STYLES = {
  surprise:    { borderClass: "border-l-[var(--down)]", tagBg: "bg-[var(--down)]/12", tagText: "text-[var(--down)]", label: "Surprise observed" },
  calibration: { borderClass: "border-l-[var(--warn)]", tagBg: "bg-[var(--warn)]/10", tagText: "text-[var(--warn)]", label: "Calibration updated" },
  confirm:     { borderClass: "border-l-[var(--up)]",   tagBg: "bg-[var(--up)]/10",   tagText: "text-[var(--up)]",   label: "Pattern confirmed" },
};

const STATUS_COLORS = {
  up:   "text-[var(--up)]",
  warn: "text-[var(--warn)]",
  blue: "text-[var(--signal-1)]",
};
const STATUS_DOT = {
  up:   "bg-[var(--up)]",
  warn: "bg-[var(--warn)]",
  blue: "bg-[var(--signal-1)]",
};

export function ModelEvolution({ entries }: { entries: EvolutionEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="px-6 py-5">
      <div className="text-label font-semibold text-[var(--ink)] mb-3 flex items-center justify-between">
        <span>Model evolution</span>
        <span className="text-fine font-normal text-[var(--ink-faint)]">how this model learns</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const s = ENTRY_STYLES[entry.type];
          return (
            <Surface
              key={entry.id}
              className={`pl-3 pr-3 py-2.5 border-l-2 rounded-r-[var(--radius-card)] ${s.borderClass}`}
            >
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-fine text-[var(--ink-faint)]">
                  {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                </span>
                <span className={`text-micro font-bold px-1.5 py-px rounded-sm uppercase tracking-wide ${s.tagBg} ${s.tagText}`}>
                  {s.label}
                </span>
              </div>

              <div className="text-xs text-[var(--ink-faint)] leading-relaxed">
                {entry.body}
              </div>

              {entry.autopsy && (
                <div className="mt-2 pt-2 border-t border-[var(--down)]/10 -mx-3 px-3 pb-0">
                  <div className="text-tiny font-semibold uppercase tracking-widest text-[var(--down)] mb-1.5">
                    Forecast autopsy
                  </div>
                  {[
                    { key: "Locked probability", val: entry.autopsy.lockedLine },
                    { key: "Result", val: entry.autopsy.resultLine },
                    { key: "Historical frequency", val: entry.autopsy.freqLine },
                  ].map(({ key, val }) => (
                    <div key={key} className="flex justify-between text-slight mb-0.5">
                      <span className="text-[var(--ink-faint)]">{key}</span>
                      <span className="text-[var(--ink-muted)] font-medium">{val}</span>
                    </div>
                  ))}
                  <div className="text-fine text-[var(--ink-faint)] mt-1.5 pt-1.5 border-t border-[var(--hairline)]">
                    {entry.autopsy.patternNote}
                  </div>
                </div>
              )}

              <div className="flex items-center gap-1.5 mt-1.5 text-fine">
                <div className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[entry.statusColor]}`} />
                <span className={STATUS_COLORS[entry.statusColor]}>{entry.statusLine}</span>
              </div>
            </Surface>
          );
        })}
      </div>
    </div>
  );
}
