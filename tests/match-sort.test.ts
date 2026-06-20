import { describe, it, expect } from "vitest";
import { sortMatchesByBrier } from "@/lib/match-sort";

const rows = [
  { id: "a", grade: { brier: 0.9 } },
  { id: "b" },
  { id: "c", grade: { brier: 0.2 } },
  { id: "d" },
  { id: "e", grade: { brier: 0.5 } },
];

describe("sortMatchesByBrier", () => {
  it("sorts graded rows ascending, ungraded keep chronological order after", () => {
    expect(sortMatchesByBrier(rows, "asc").map((r) => r.id)).toEqual(["c", "e", "a", "b", "d"]);
  });
  it("sorts graded rows descending, ungraded keep chronological order after", () => {
    expect(sortMatchesByBrier(rows, "desc").map((r) => r.id)).toEqual(["a", "e", "c", "b", "d"]);
  });
  it("does not mutate the input", () => {
    const copy = rows.map((r) => r.id);
    sortMatchesByBrier(rows, "asc");
    expect(rows.map((r) => r.id)).toEqual(copy);
  });
});
