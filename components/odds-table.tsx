"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { kitAccent } from "@/lib/kit-color";

export type OddsRow = {
  id: string;
  name: string;
  color: string;
  group: string;
  elo: number;
  advanceGroup: number;
  reachQF: number;
  reachFinal: number;
  champion: number;
};

type SortKey = keyof Pick<
  OddsRow,
  "elo" | "advanceGroup" | "reachQF" | "reachFinal" | "champion"
>;

const COLS: Array<{ key: SortKey; label: string }> = [
  { key: "elo", label: "Elo" },
  { key: "advanceGroup", label: "Advance" },
  { key: "reachQF", label: "Quarters" },
  { key: "reachFinal", label: "Final" },
  { key: "champion", label: "Champion" },
];

export function OddsTable({ rows }: { rows: OddsRow[] }) {
  const [sortKey, setSortKey] = useState<SortKey>("champion");
  const sorted = useMemo(
    () => [...rows].sort((a, b) => b[sortKey] - a[sortKey]),
    [rows, sortKey],
  );
  const pct = (x: number) =>
    x >= 0.995 ? "100%" : x < 0.001 ? "<0.1%" : `${(x * 100).toFixed(1)}%`;

  return (
    <div className="min-w-0 max-w-full overflow-x-auto">
      <table className="w-full min-w-160">
        <thead>
          <tr className="text-caption border-b border-[var(--hairline)] text-left">
            <th className="px-4 py-3 font-normal">#</th>
            <th className="px-2 py-3 font-normal">Team</th>
            {COLS.map((c) => (
              <th key={c.key} className="px-2 py-3 text-right font-normal">
                <button
                  onClick={() => setSortKey(c.key)}
                  className={`rounded px-1 transition-colors ${
                    sortKey === c.key
                      ? "font-semibold text-[var(--ink)]"
                      : "hover:text-[var(--ink)]"
                  }`}
                >
                  {c.label} {sortKey === c.key ? "↓" : ""}
                </button>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {sorted.map((r, i) => (
            <tr key={r.id} className="border-b border-[var(--hairline)] last:border-0">
              <td className="text-caption tabular px-4 py-2.5">{i + 1}</td>
              <td className="px-2 py-2.5">
                <Link href={`/team/${r.id}`} className="flex items-center gap-2 hover:underline">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: kitAccent(r.color, "up") }}
                    aria-hidden
                  />
                  <span className="font-medium">{r.name}</span>
                  <span className="text-caption">({r.group})</span>
                </Link>
              </td>
              <td className="tabular px-2 py-2.5 text-right">{r.elo}</td>
              <td className="tabular px-2 py-2.5 text-right">{pct(r.advanceGroup)}</td>
              <td className="tabular px-2 py-2.5 text-right">{pct(r.reachQF)}</td>
              <td className="tabular px-2 py-2.5 text-right">{pct(r.reachFinal)}</td>
              <td className="tabular px-2 py-2.5 text-right font-semibold text-[var(--up)]">
                {pct(r.champion)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
