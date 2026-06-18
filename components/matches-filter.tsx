"use client";

import { useMemo, useState } from "react";
import { MatchMarketLine } from "./cinematic";
import type { MatchRowData } from "@/lib/match-view";

const GROUPS = "ABCDEFGHIJKL".split("");

export function MatchesFilter({ rows }: { rows: MatchRowData[] }) {
  const [group, setGroup] = useState<string>("all");
  const [status, setStatus] = useState<"all" | "played" | "upcoming">("all");
  const [query, setQuery] = useState("");

  const filtered = useMemo(
    () =>
      rows.filter((m) => {
        if (group !== "all" && m.group !== group) return false;
        if (status === "played" && !m.score) return false;
        if (status === "upcoming" && m.score) return false;
        if (
          query &&
          !`${m.homeName} ${m.awayName}`.toLowerCase().includes(query.toLowerCase())
        )
          return false;
        return true;
      }),
    [rows, group, status, query],
  );

  const chip = (active: boolean) =>
    `text-label h-8 shrink-0 border-b px-1 transition-colors duration-300 ${
      active
        ? "border-[var(--ink)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
    }`;

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-2">
        {(["all", "played", "upcoming"] as const).map((s) => (
          <button key={s} className={chip(status === s)} onClick={() => setStatus(s)}>
            {s === "all" ? "All" : s === "played" ? "Played" : "Upcoming"}
          </button>
        ))}
        <span className="mx-1 h-5 w-px bg-[var(--hairline)]" aria-hidden />
        <div className="flex min-w-0 max-w-full gap-2 overflow-x-auto">
          <button className={chip(group === "all")} onClick={() => setGroup("all")}>
            All groups
          </button>
          {GROUPS.map((g) => (
            <button key={g} className={chip(group === g)} onClick={() => setGroup(g)}>
              {g}
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team"
          aria-label="Search team"
          className="text-label h-8 min-w-0 flex-1 border-b border-[var(--line)] bg-transparent px-1 outline-none placeholder:text-[var(--ink-faint)] sm:max-w-48"
        />
      </div>
      <p className="text-caption tabular">{filtered.length} matches</p>
      <div>
        {filtered.map((m) => (
          <MatchMarketLine key={m.slug} row={m} />
        ))}
      </div>
    </div>
  );
}
