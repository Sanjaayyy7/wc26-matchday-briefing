/** Sort graded rows by Brier; ungraded rows keep their original order, appended after. Pure. */
export function sortMatchesByBrier<T extends { grade?: { brier: number } }>(
  rows: T[],
  dir: "asc" | "desc",
): T[] {
  const graded = rows.filter((r) => r.grade);
  const ungraded = rows.filter((r) => !r.grade);
  graded.sort((a, b) =>
    dir === "asc" ? a.grade!.brier - b.grade!.brier : b.grade!.brier - a.grade!.brier,
  );
  return [...graded, ...ungraded];
}
