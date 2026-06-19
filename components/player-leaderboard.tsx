"use client";

import { useState } from "react";
import Link from "next/link";
import type { PlayerRowView } from "@/lib/player-view";

type SortKey = "goals" | "assists" | "impact";

const SORT_LABELS: Record<SortKey, string> = {
  goals: "Goals",
  assists: "Assists",
  impact: "Impact",
};

export function PlayerLeaderboard({ players }: { players: PlayerRowView[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("impact");

  const sorted = [...players].sort((a, b) => {
    if (sortKey === "goals") return b.goals - a.goals;
    if (sortKey === "assists") return b.assists - a.assists;
    return b.impact - a.impact;
  });

  return (
    <div>
      {/* Sort controls */}
      <div className="mb-6 flex items-center gap-3">
        <span className="text-label">Rank by</span>
        <div className="flex gap-2">
          {(Object.keys(SORT_LABELS) as SortKey[]).map((key) => (
            <button
              key={key}
              onClick={() => setSortKey(key)}
              className={[
                "border px-3 py-1 text-label transition-colors duration-300",
                sortKey === key
                  ? "border-[var(--tint)] bg-[var(--panel)] text-[var(--ink)]"
                  : "border-[var(--line)] text-[var(--ink-muted)] hover:border-[var(--ink-muted)]",
              ].join(" ")}
            >
              {SORT_LABELS[key]}
            </button>
          ))}
        </div>
      </div>

      {/* Table */}
      <ul className="divide-y divide-[var(--line)]">
        {sorted.map((p, i) => (
          <li key={p.id}>
            <Link
              href={`/players/${p.id}`}
              className="grid grid-cols-[2rem_1fr_auto] items-center gap-4 py-3 transition-colors duration-300 hover:bg-[var(--panel)] sm:grid-cols-[2rem_1fr_auto_auto_auto]"
            >
              <span className="text-caption tabular w-6">{i + 1}</span>

              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span
                    className="inline-block h-2 w-2 shrink-0 rounded-full"
                    style={{ background: p.teamPrimary }}
                  />
                  <span className="text-title truncate">{p.name}</span>
                  {p.isSeeded && (
                    <span className="ml-1 shrink-0 rounded-sm border border-[var(--stage-sf)] px-1 py-px text-caption text-[var(--stage-sf)]">
                      seeded
                    </span>
                  )}
                </div>
                <span className="text-caption block truncate">
                  {p.teamName} · {p.position}
                </span>
              </div>

              <span className="hidden text-right tabular text-title sm:block">
                {p.goals}G {p.assists}A
              </span>

              <span className="hidden text-right tabular text-caption text-[var(--ink-muted)] sm:block">
                {p.minutes}′
              </span>

              <span
                className="text-right tabular text-title"
                style={{
                  color:
                    p.impact > 0.1
                      ? "var(--up)"
                      : p.impact > 0.05
                        ? "var(--ink)"
                        : "var(--ink-muted)",
                }}
              >
                {p.impact.toFixed(3)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
