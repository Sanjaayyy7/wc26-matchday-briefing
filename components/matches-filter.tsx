"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { VerdictChip } from "./verdict-chip";
import { BrierBar } from "./brier-bar";
import { sortMatchesByBrier } from "@/lib/match-sort";
import type { MatchRowData } from "@/lib/match-view";

type FilterKey = "all" | "settled" | "locked" | "upcoming";
const FILTERS: FilterKey[] = ["all", "settled", "upcoming", "locked"];
const LABEL: Record<FilterKey, string> = {
  all: "All matches",
  settled: "Settled",
  upcoming: "Upcoming",
  locked: "Locked",
};

function matches(row: MatchRowData, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "settled") return row.status === "official";
  if (key === "locked") return row.status === "locked";
  return row.status === "upcoming";
}

const COLS = "grid grid-cols-[1.8fr_0.9fr_1fr_0.9fr_0.8fr] gap-4";

export function MatchesFilter({ rows }: { rows: MatchRowData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = (params.get("filter") as FilterKey) ?? "all";
  const [filter, setFilter] = useState<FilterKey>(FILTERS.includes(initial) ? initial : "all");
  const [query, setQuery] = useState("");
  const [brierDir, setBrierDir] = useState<"asc" | "desc" | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      settled: rows.filter((r) => r.status === "official").length,
      upcoming: rows.filter((r) => r.status === "upcoming").length,
      locked: rows.filter((r) => r.status === "locked").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const base = rows.filter(
      (r) =>
        matches(r, filter) &&
        (!query || `${r.homeName} ${r.awayName}`.toLowerCase().includes(query.toLowerCase())),
    );
    return brierDir ? sortMatchesByBrier(base, brierDir) : base;
  }, [rows, filter, query, brierDir]);

  function pick(key: FilterKey) {
    setFilter(key);
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete("filter");
    else next.set("filter", key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const tab = (active: boolean) =>
    `text-label h-9 shrink-0 border-b px-1 transition-colors duration-300 ${
      active
        ? "border-[var(--ink)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
    }`;
  const arrow = brierDir === "asc" ? "↑" : brierDir === "desc" ? "↓" : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 gap-4 overflow-x-auto">
          {FILTERS.map((key) => (
            <button key={key} className={tab(filter === key)} onClick={() => pick(key)}>
              {LABEL[key]}{" "}
              <span className="text-mono data-mono tabular text-[var(--ink-faint)]">{counts[key]}</span>
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

      <div
        className={`${COLS} border-b border-[var(--line)] pb-2 text-micro uppercase tracking-widest text-[var(--ink-faint)]`}
      >
        <span>Fixture</span>
        <span>Result · Status</span>
        <span className="hidden sm:block">H · D · A</span>
        <button
          type="button"
          onClick={() => setBrierDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))}
          className="flex items-center gap-1 text-left uppercase tracking-widest transition-colors duration-300 hover:text-[var(--ink)]"
        >
          Brier {arrow}
        </button>
        <span className="text-right">Verdict</span>
      </div>

      <div>
        {visible.map((r) => (
          <Link
            key={r.slug}
            href={`/fixture/${r.slug}`}
            className={`${COLS} items-center border-b border-[var(--hairline)] py-3 last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]`}
          >
            <div className="min-w-0">
              <div className="text-title truncate">
                {r.homeShort} vs {r.awayShort}
              </div>
              <div className="text-caption text-[var(--ink-faint)] truncate">
                {r.stage} · {r.dateLabel}
                {r.group ? ` · Group ${r.group}` : ""}
              </div>
            </div>
            <div className="min-w-0">
              {r.score ? (
                <span className="text-mono data-mono tabular">{r.score}</span>
              ) : (
                <span className="text-caption uppercase tracking-widest text-[var(--ink-faint)]">
                  {r.status === "locked" ? "Locked" : r.status === "upcoming" ? "Upcoming" : "—"}
                </span>
              )}
            </div>
            <div className="hidden sm:block">
              {r.split ? (
                <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
                  <span className="text-[var(--up)]">{r.split.home}</span> / {r.split.draw} /{" "}
                  <span className="text-[var(--down)]">{r.split.away}</span>
                </span>
              ) : (
                <span className="text-[var(--ink-faint)]">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {r.grade ? (
                <>
                  <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
                    {r.grade.brier.toFixed(3)}
                  </span>
                  <BrierBar brier={r.grade.brier} />
                </>
              ) : (
                <span className="text-[var(--ink-faint)]">—</span>
              )}
            </div>
            <div className="flex justify-end">
              {r.verdict ? (
                <VerdictChip verdict={r.verdict} />
              ) : (
                <span className="text-[var(--ink-faint)]">—</span>
              )}
            </div>
          </Link>
        ))}
        {visible.length === 0 && <p className="text-caption py-6">No matches in this view.</p>}
      </div>
    </div>
  );
}
