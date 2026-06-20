import { describe, it, expect } from "vitest";
import { sortSettlements } from "@/lib/settlement-sort";

const rows = [
  { brier: 0.6, kickoffMs: 300 },
  { brier: 0.9, kickoffMs: 100 },
  { brier: 0.3, kickoffMs: 200 },
];

describe("sortSettlements", () => {
  it("sorts by brier ascending", () => {
    expect(sortSettlements(rows, "brier", "asc").map((r) => r.brier)).toEqual([0.3, 0.6, 0.9]);
  });
  it("sorts by brier descending", () => {
    expect(sortSettlements(rows, "brier", "desc").map((r) => r.brier)).toEqual([0.9, 0.6, 0.3]);
  });
  it("sorts by date descending (newest first)", () => {
    expect(sortSettlements(rows, "date", "desc").map((r) => r.kickoffMs)).toEqual([300, 200, 100]);
  });
  it("does not mutate the input array", () => {
    const copy = [...rows];
    sortSettlements(rows, "brier", "asc");
    expect(rows).toEqual(copy);
  });
});
