"use client";

import { useState } from "react";
import Link from "next/link";
import { BrierBar } from "./brier-bar";
import { VerdictChip } from "./verdict-chip";
import { sortSettlements, type SortDir } from "@/lib/settlement-sort";
import type { Verdict } from "@/lib/kit-color";

export type SettlementTableRow = {
  slug: string;
  matchName: string;
  context: string;
  result: string;
  brier: number;
  rps: number;
  verdict: Verdict;
  kickoffMs: number;
};

export function SettlementTable({ rows }: { rows: SettlementTableRow[] }) {
  const [brierSort, setBrierSort] = useState<SortDir | null>(null);
  const sorted =
    brierSort === null
      ? sortSettlements(rows, "date", "desc")
      : sortSettlements(rows, "brier", brierSort);
  const arrow = brierSort === "asc" ? "↑" : brierSort === "desc" ? "↓" : "";

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.7fr_0.8fr] gap-4 border-b border-[var(--line)] pb-2 text-micro uppercase tracking-widest text-[var(--ink-faint)]">
        <span>Fixture</span>
        <span>Result</span>
        <button
          type="button"
          onClick={() => setBrierSort((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))}
          className="flex items-center gap-1 text-left uppercase tracking-widest transition-colors duration-300 hover:text-[var(--ink)]"
        >
          Brier {arrow}
        </button>
        <span className="hidden sm:block">RPS</span>
        <span className="text-right">Verdict</span>
      </div>
      {sorted.map((r) => (
        <Link
          key={r.slug}
          href={`/fixture/${r.slug}`}
          className="grid grid-cols-[1.6fr_0.7fr_1fr_0.7fr_0.8fr] items-center gap-4 border-b border-[var(--hairline)] py-3 last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]"
        >
          <div className="min-w-0">
            <div className="text-title truncate">{r.matchName}</div>
            <div className="text-caption text-[var(--ink-faint)] truncate">{r.context}</div>
          </div>
          <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{r.result}</span>
          <span className="flex items-center gap-2">
            <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
              {r.brier.toFixed(3)}
            </span>
            <BrierBar brier={r.brier} />
          </span>
          <span className="hidden text-mono data-mono tabular text-[var(--ink-muted)] sm:block">
            {r.rps.toFixed(3)}
          </span>
          <span className="flex justify-end">
            <VerdictChip verdict={r.verdict} />
          </span>
        </Link>
      ))}
    </div>
  );
}
