export type SettlementSortKey = "date" | "brier";
export type SortDir = "asc" | "desc";

/** Pure sort for the settlement table. Date uses kickoffMs; never mutates input. */
export function sortSettlements<T extends { brier: number; kickoffMs: number }>(
  rows: T[],
  key: SettlementSortKey,
  dir: SortDir,
): T[] {
  const sorted = [...rows].sort((a, b) =>
    key === "brier" ? a.brier - b.brier : a.kickoffMs - b.kickoffMs,
  );
  return dir === "desc" ? sorted.reverse() : sorted;
}
