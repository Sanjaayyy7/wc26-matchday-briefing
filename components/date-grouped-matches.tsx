"use client";

/**
 * DateGroupedMatches — client shell that owns date-nav selection state.
 *
 * Receives pre-serialized match groups from the server page (no server-only
 * imports here). Renders <DateNav> as the primary navigator and the selected
 * day's matches as a Surface card grid, with a status/team filter row as a
 * secondary control below the date bar.
 */

import { useMemo, useState } from "react";
import { DateNav } from "./date-nav";
import type { DateNavGroup } from "./date-nav";
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

// ── Filter types ───────────────────────────────────────────────────────────

type StatusFilter = "all" | "settled" | "locked" | "upcoming";
const STATUS_FILTERS: StatusFilter[] = ["all", "settled", "upcoming", "locked"];
const STATUS_LABEL: Record<StatusFilter, string> = {
  all: "All",
  settled: "Settled",
  upcoming: "Upcoming",
  locked: "Locked",
};

function matchesStatus(row: MatchRowData, key: StatusFilter): boolean {
  if (key === "all") return true;
  if (key === "settled") return row.status === "official";
  if (key === "locked") return row.status === "locked";
  return row.status === "upcoming";
}

export function DateGroupedMatches({
  groups,
  defaultSelected,
}: DateGroupedMatchesProps) {
  const [selected, setSelected] = useState(defaultSelected);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [query, setQuery] = useState("");

  const safeSelected = Math.max(0, Math.min(selected, groups.length - 1));
  const currentGroup = groups[safeSelected];
  const rows = currentGroup?.rows ?? [];

  const filteredRows = useMemo(
    () =>
      rows.filter(
        (r) =>
          matchesStatus(r, statusFilter) &&
          (!query ||
            `${r.homeName} ${r.awayName}`
              .toLowerCase()
              .includes(query.toLowerCase())),
      ),
    [rows, statusFilter, query],
  );

  const counts = useMemo(
    () => ({
      all: rows.length,
      settled: rows.filter((r) => r.status === "official").length,
      upcoming: rows.filter((r) => r.status === "upcoming").length,
      locked: rows.filter((r) => r.status === "locked").length,
    }),
    [rows],
  );

  const tabCls = (active: boolean) =>
    `text-label h-9 shrink-0 border-b px-1 transition-colors duration-300 ${
      active
        ? "border-[var(--ink)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
    }`;

  return (
    <div className="flex flex-col gap-0">
      {/* Primary nav — sticky date bar */}
      <DateNav
        groups={groups}
        selected={safeSelected}
        onSelect={(i) => {
          setSelected(i);
          setStatusFilter("all");
          setQuery("");
        }}
      />

      {/* Secondary filter row */}
      <div className="flex flex-wrap items-center gap-4 pt-5 pb-3">
        <div className="flex min-w-0 gap-4 overflow-x-auto">
          {STATUS_FILTERS.map((key) => (
            <button
              key={key}
              className={tabCls(statusFilter === key)}
              onClick={() => setStatusFilter(key)}
            >
              {STATUS_LABEL[key]}{" "}
              <span className="text-mono data-mono tabular text-[var(--ink-faint)]">
                {counts[key]}
              </span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team"
          aria-label="Search team"
          className="text-label h-9 min-w-0 flex-1 border-b border-[var(--line)] bg-transparent px-1 outline-none placeholder:text-[var(--ink-faint)] sm:max-w-48"
        />
      </div>

      {/* Primary display — Surface card grid for selected day */}
      <MatchCardGrid rows={filteredRows} />
    </div>
  );
}

// ── Match card grid for a single day ──────────────────────────────────────

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
