"use client";

/**
 * DateGroupedMatches — client shell that owns date-nav selection state.
 *
 * Receives pre-serialized match groups from the server page (no server-only
 * imports here). Renders <DateNav> as the primary navigator and the selected
 * day's matches as a Surface card grid, with <MatchesFilter> as a secondary
 * status/team filter row below the date bar.
 */

import { useState } from "react";
import { DateNav } from "./date-nav";
import type { DateNavGroup } from "./date-nav";
import { MatchesFilter } from "./matches-filter";
import { Surface } from "./ui/surface";
import { Crest } from "./crest";
import { VerdictChip } from "./verdict-chip";
import Link from "next/link";
import type { MatchRowData } from "@/lib/match-view";

export type MatchDayRowGroup = DateNavGroup & {
  rows: MatchRowData[];
};

interface DateGroupedMatchesProps {
  groups: MatchDayRowGroup[];
  defaultSelected: number;
}

export function DateGroupedMatches({
  groups,
  defaultSelected,
}: DateGroupedMatchesProps) {
  const [selected, setSelected] = useState(defaultSelected);

  const safeSelected = Math.max(0, Math.min(selected, groups.length - 1));
  const currentGroup = groups[safeSelected];
  const rows = currentGroup?.rows ?? [];

  return (
    <div className="flex flex-col gap-0">
      {/* Primary nav — sticky date bar */}
      <DateNav
        groups={groups}
        selected={safeSelected}
        onSelect={setSelected}
      />

      {/* Secondary filter row + match grid */}
      <div className="flex flex-col gap-6 pt-6">
        <MatchesFilter rows={rows} />
      </div>
    </div>
  );
}

// ── Match card grid for a single day ──────────────────────────────────────
// (Not used in the current wiring — MatchesFilter owns the list view.
//  Kept here as a separate export in case a future task wants a card-grid
//  view for a single day without the filter chrome.)

export function MatchCardGrid({ rows }: { rows: MatchRowData[] }) {
  if (rows.length === 0) {
    return <p className="text-caption py-6 text-[var(--ink-faint)]">No matches on this day.</p>;
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
      {rows.map((r) => (
        <MatchDayCard key={r.slug} row={r} />
      ))}
    </div>
  );
}

function MatchDayCard({ row }: { row: MatchRowData }) {
  return (
    <Surface interactive className="p-4 transition-colors duration-300">
      <Link href={`/fixture/${row.slug}`} className="flex flex-col gap-3 outline-none">
        {/* Teams */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Crest
              short={row.homeShort}
              primary={row.homeColor}
              name={row.homeName}
              size={32}
            />
            <span className="text-title truncate">{row.homeShort}</span>
          </div>

          <div className="flex flex-col items-center shrink-0 px-2">
            {row.score ? (
              <span className="text-mono data-mono tabular font-semibold">{row.score}</span>
            ) : (
              <span className="text-caption uppercase tracking-widest text-[var(--ink-faint)]">
                {row.status === "locked" ? "Locked" : row.status === "upcoming" ? "vs" : "—"}
              </span>
            )}
          </div>

          <div className="flex items-center gap-2 min-w-0 flex-row-reverse">
            <Crest
              short={row.awayShort}
              primary={row.awayColor}
              name={row.awayName}
              size={32}
            />
            <span className="text-title truncate">{row.awayShort}</span>
          </div>
        </div>

        {/* Model split */}
        {row.split && (
          <div className="text-caption text-[var(--ink-muted)] flex justify-between">
            <span className="text-[var(--up)]">{row.split.home}%</span>
            <span>Draw {row.split.draw}%</span>
            <span className="text-[var(--down)]">{row.split.away}%</span>
          </div>
        )}

        {/* Verdict + meta */}
        <div className="flex items-center justify-between">
          <span className="text-caption text-[var(--ink-faint)]">
            {row.stage}{row.group ? ` · Grp ${row.group}` : ""}
          </span>
          {row.verdict ? (
            <VerdictChip verdict={row.verdict} />
          ) : (
            <span className="text-caption uppercase tracking-widest text-[var(--ink-faint)]">
              {row.status}
            </span>
          )}
        </div>
      </Link>
    </Surface>
  );
}
