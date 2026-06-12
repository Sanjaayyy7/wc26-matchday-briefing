import { describe, it, expect } from "vitest";
import { lockNew, settle, type LockedEntry } from "@/lib/predictions-ledger";

const split = { home: 50, draw: 30, away: 20 };

describe("lockNew", () => {
  const fixtures = [
    { slug: "a-vs-b", kickoffISO: "2026-06-20T18:00:00Z" },
    { slug: "c-vs-d", kickoffISO: "2026-06-10T18:00:00Z" }, // already kicked off
  ];
  const predictFn = () => ({ split, mostLikely: { home: 1, away: 0 } });

  it("locks only future, not-yet-locked fixtures", () => {
    const out = lockNew([], fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    expect(out.map((e) => e.slug)).toEqual(["a-vs-b"]);
    expect(out[0].split).toEqual(split);
    expect(out[0].lockedAt).toBe("2026-06-12T00:00:00.000Z");
  });

  it("NEVER mutates an existing lock (immutability is the integrity core)", () => {
    const existing: LockedEntry[] = [
      {
        slug: "a-vs-b",
        lockedAt: "2026-06-11T00:00:00.000Z",
        split: { home: 99, draw: 1, away: 0 },
        mostLikely: { home: 9, away: 0 },
      },
    ];
    const out = lockNew(existing, fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    const entry = out.find((e) => e.slug === "a-vs-b")!;
    expect(entry.split.home).toBe(99);
    expect(entry.lockedAt).toBe("2026-06-11T00:00:00.000Z");
  });

  it("never creates a lock for an already-started fixture (no retroactive predictions)", () => {
    const out = lockNew([], fixtures, predictFn, new Date("2026-06-12T00:00:00Z"));
    expect(out.find((e) => e.slug === "c-vs-d")).toBeUndefined();
  });
});

describe("settle", () => {
  const locked: LockedEntry[] = [
    {
      slug: "a-vs-b",
      lockedAt: "2026-06-11T00:00:00.000Z",
      split,
      mostLikely: { home: 1, away: 0 },
      market: { home: 0.6, draw: 0.25, away: 0.15 },
    },
  ];

  it("computes outcome, correctness, Brier and RPS for model and market", () => {
    const out = settle(locked, [
      { slug: "a-vs-b", homeScore: 2, awayScore: 1 },
    ]);
    const e = out[0];
    expect(e.result).toBe("2-1");
    expect(e.realized).toBe("home");
    expect(e.correctPick).toBe(true); // top of split was home at 50
    // Brier: (0.5-1)^2+(0.3)^2+(0.2)^2 = 0.25+0.09+0.04 = 0.38
    expect(e.modelBrier).toBeCloseTo(0.38, 10);
    // RPS: cum (0.5-1)^2 + (0.8-1)^2 over 2 = (0.25+0.04)/2
    expect(e.modelRps).toBeCloseTo(0.145, 10);
    expect(e.marketBrier).toBeCloseTo(0.4 ** 2 + 0.25 ** 2 + 0.15 ** 2, 10);
  });

  it("leaves unsettled entries untouched and is idempotent", () => {
    const once = settle(locked, [{ slug: "a-vs-b", homeScore: 2, awayScore: 1 }]);
    const twice = settle(once, [{ slug: "a-vs-b", homeScore: 2, awayScore: 1 }]);
    expect(twice).toEqual(once);
    const none = settle(locked, [{ slug: "a-vs-b" }]);
    expect(none[0].result).toBeUndefined();
  });
});
