# Parlay Optimizer v2 (Combo-Eligible Slips) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Every emitted parlay slip is purchasable as one Kalshi combo ticket: legs restricted to the 9 model-priced combo-eligible series, first-half legs priced by a binomial goal-split on the existing Dixon-Coles grid, hit-first floors, versioned ledger with all 4 QFs relocked before kickoff.

**Architecture:** New pure module `lib/parlay-v2.ts` (registry + 4-dim lattice + v2 selection + v2 reasoning) built beside the untouched v1 engine `lib/parlay.ts`, so v1 slips keep validating byte-for-byte. The three pipeline scripts (lock/settle/inspect) become version-aware; lock only emits v2 from now on. Page renders both versions with v1 badged.

**Tech Stack:** TypeScript (strict), Next.js app in `app-parlay/` worktree, vitest, plain `fetch` against Kalshi public API. No new dependencies.

**Spec:** `docs/superpowers/specs/2026-07-08-parlay-optimizer-v2-combo-design.md` — read it before starting.

## Global Constraints

- Work in the `app-parlay/` worktree, branch `feat/parlay-v2-combo` (already exists, spec committed).
- **Hard deadline: Task 11's live lock must run before FRA-MAR kickoff 2026-07-09 20:00Z.**
- Pre-registered v2 constants, copied verbatim from spec: `Q_FIRST_HALF = 0.45`, `LEG floor 0.75`, `JOINT floor 0.60`, `2–4 legs`, `REDUNDANCY_CAP = 0.97` (shared with v1). YES-only series: `KXWCGAME`, `KXWC1H`.
- Combo-eligible series (exactly these 9): `KXWCGAME, KXWCSPREAD, KXWCTOTAL, KXWCBTTS, KXWC1H, KXWC1HSPREAD, KXWC1HTOTAL, KXWC1HBTTS, KXWCADVANCE`.
- `lib/parlay.ts` v1 behavior must not change (v1 slips must keep passing the inspector unchanged). Only additive `export` keywords allowed there.
- Kalshi mids are display/benchmark only — never a selection input.
- JSX: literal unicode only (✓ ✗ · — ≈). No HTML entities in new code.
- Keep files under 500 lines.
- NEVER run `npm run matchday`, `ml:fetch`, or `ml:cycle` (wipes seeded results.csv).
- Commits: conventional prefixes, NO `Co-Authored-By` trailer (project rule #2078).
- Before touching `app/**` or `components/**`, skim the relevant guide in `node_modules/next/dist/docs/` (this Next.js version diverges from training data — AGENTS.md).
- Full gate suite before the final commit of each task that says so: `npx vitest run`, `npx eslint .`; and before the PR: `npm run build`, `npm run design:inspect`, `npm run inspect:execution`, `npm run model:inspect`, `npm run parlay:inspect`.

## File Structure

| File | Action | Responsibility |
| --- | --- | --- |
| `lib/parlay-v2.ts` | Create | v2 engine, pure, no I/O: registry constants, `parseMarketV2`, `halfLattice`, `jointProbV2`, `selectSlipV2`, `legReasoningV2`, `comboImpliedProb` |
| `tests/parlay-v2.test.ts` | Create | all v2 engine tests |
| `lib/parlay.ts` | Modify | export `pct1`/`signed` (additive only) |
| `scripts/lock-parlays.mts` | Modify | lock v2 slips (9 series, lattice, v2 floors, versioned ledger, `-v2` snapshots) |
| `scripts/settle-parlays.mts` | Modify | `gradeLegV2` (HT window) + per-version dispatch |
| `scripts/parlay-inspector.mts` | Modify | `inspectSlipV2` (gates 8/9/10) + per-version dispatch |
| `scripts/build-accountability.mts` | Modify | Parlays section split by engine version |
| `lib/parlay-view.ts` | Modify | `engineVersion`/`comboImpliedProb` on rows + views |
| `components/parlay-slip-card.tsx` | Modify | v1 badge + combo-implied line |
| `app/parlay/page.tsx` | Modify | per-version record prose, protocol copy, versioned keys |
| `app/methodology/page.tsx` | Modify | Parlay slips principle: combo universe + q + v2 floors |
| `tests/lock-parlays.test.ts`, `tests/settle-parlays.test.ts`, `tests/parlay-inspector.test.ts`, `tests/parlay-view.test.ts`, `tests/parlay-slip-card.test.tsx` | Modify | version-aware coverage |
| `data/parlays.json`, `data/markets/parlay-snapshots/*-v2.json` | Data (Task 11) | 4 relocked QF v2 slips + snapshots |

---

### Task 1: v2 registry + `parseMarketV2`

**Files:**
- Create: `lib/parlay-v2.ts`
- Modify: `lib/parlay.ts` (add `export` to `pct1`, `signed` — nothing else)
- Test: `tests/parlay-v2.test.ts`

**Interfaces:**
- Consumes: `KalshiMarket`, `REDUNDANCY_CAP`, `REASONING_GRAMMAR`, `pct1`, `signed` from `lib/parlay.ts`.
- Produces (later tasks rely on these exact names):
  `ENGINE_VERSION_V2: "v2-combo"` · `Q_FIRST_HALF: 0.45` · `V2_FLOORS: { leg: 0.75, joint: 0.6, maxLegs: 4 }` · `type V2Floors` · `COMBO_SERIES` (readonly 9-tuple) · `YES_ONLY_SERIES: Set<string>` · `seriesOf(ticker): string` ·
  `type LatticePredicate = (c: { h1: number; a1: number; h: number; a: number }) => boolean` ·
  `type ParsedMarketV2 = { kind: "reg"; window: "90" | "1h"; ticker; title; yesMid; pred: LatticePredicate } | { kind: "advance"; window: "advance"; ticker; title; yesMid; advanceSide: "home" | "away" }` ·
  `parseMarketV2(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarketV2 | null` ·
  `candidateLegsV2(markets: KalshiMarket[], homeAbbr: string, awayAbbr: string): CandidateLegV2[]` ·
  `type CandidateLegV2 = { market: ParsedMarketV2; side: "yes" | "no" }`

- [ ] **Step 1: Export the two format helpers from `lib/parlay.ts`**

In `lib/parlay.ts:160-161`, change:

```ts
const pct1 = (x: number): string => `${(x * 100).toFixed(1)}%`;
const signed = (x: number): string => `${x >= 0 ? "+" : ""}${x}`;
```

to:

```ts
export const pct1 = (x: number): string => `${(x * 100).toFixed(1)}%`;
export const signed = (x: number): string => `${x >= 0 ? "+" : ""}${x}`;
```

- [ ] **Step 2: Write failing tests for the registry and parser**

Create `tests/parlay-v2.test.ts`:

```ts
import { describe, expect, it } from "vitest";
import {
  COMBO_SERIES, ENGINE_VERSION_V2, Q_FIRST_HALF, V2_FLOORS, YES_ONLY_SERIES,
  candidateLegsV2, parseMarketV2, seriesOf, type CandidateLegV2,
} from "../lib/parlay-v2";
import type { KalshiMarket } from "../lib/parlay";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarketV2(mk(t), "FRA", "MAR");

describe("v2 registry", () => {
  it("pre-registered constants", () => {
    expect(ENGINE_VERSION_V2).toBe("v2-combo");
    expect(Q_FIRST_HALF).toBe(0.45);
    expect(V2_FLOORS).toEqual({ leg: 0.75, joint: 0.6, maxLegs: 4 });
    expect(COMBO_SERIES).toEqual([
      "KXWCGAME","KXWCSPREAD","KXWCTOTAL","KXWCBTTS",
      "KXWC1H","KXWC1HSPREAD","KXWC1HTOTAL","KXWC1HBTTS","KXWCADVANCE",
    ]);
    expect([...YES_ONLY_SERIES].sort()).toEqual(["KXWC1H", "KXWCGAME"]);
  });
});

describe("parseMarketV2", () => {
  it("90-minute series carry window '90' and read (h, a)", () => {
    const g = P("KXWCGAME-26JUL09FRAMAR-FRA");
    expect(g!.kind).toBe("reg");
    if (g!.kind === "reg") {
      expect(g!.window).toBe("90");
      expect(g!.pred({ h1: 0, a1: 0, h: 2, a: 1 })).toBe(true);
      expect(g!.pred({ h1: 2, a1: 0, h: 1, a: 1 })).toBe(false); // h1 must not matter
    }
    const s = P("KXWCSPREAD-26JUL09FRAMAR-MAR2");
    if (s!.kind === "reg") expect(s!.pred({ h1: 0, a1: 0, h: 0, a: 2 })).toBe(true);
    const t = P("KXWCTOTAL-26JUL09FRAMAR-3");
    if (t!.kind === "reg") {
      expect(t!.pred({ h1: 0, a1: 0, h: 2, a: 1 })).toBe(true);
      expect(t!.pred({ h1: 0, a1: 0, h: 1, a: 1 })).toBe(false);
    }
    const b = P("KXWCBTTS-26JUL09FRAMAR-BTTS");
    if (b!.kind === "reg") expect(b!.pred({ h1: 0, a1: 0, h: 1, a: 1 })).toBe(true);
  });

  it("1H series carry window '1h' and read (h1, a1)", () => {
    const g = P("KXWC1H-26JUL09FRAMAR-TIE");
    if (g!.kind === "reg") {
      expect(g!.window).toBe("1h");
      expect(g!.pred({ h1: 1, a1: 1, h: 3, a: 1 })).toBe(true);
      expect(g!.pred({ h1: 1, a1: 0, h: 1, a: 1 })).toBe(false); // FT must not matter
    }
    const sp = P("KXWC1HSPREAD-26JUL09FRAMAR-FRA2");
    if (sp!.kind === "reg") {
      expect(sp!.pred({ h1: 2, a1: 0, h: 2, a: 2 })).toBe(true);
      expect(sp!.pred({ h1: 1, a1: 0, h: 4, a: 0 })).toBe(false);
    }
    const tot = P("KXWC1HTOTAL-26JUL09FRAMAR-2");
    if (tot!.kind === "reg") {
      expect(tot!.pred({ h1: 1, a1: 1, h: 1, a: 1 })).toBe(true);
      expect(tot!.pred({ h1: 1, a1: 0, h: 5, a: 4 })).toBe(false);
    }
    const bt = P("KXWC1HBTTS-26JUL09FRAMAR-BTTS");
    if (bt!.kind === "reg") {
      expect(bt!.pred({ h1: 1, a1: 1, h: 1, a: 1 })).toBe(true);
      expect(bt!.pred({ h1: 0, a1: 1, h: 2, a: 1 })).toBe(false);
    }
  });

  it("ADVANCE parses; combo-ineligible + unknown series return null", () => {
    const adv = P("KXWCADVANCE-26JUL09FRAMAR-FRA");
    expect(adv!.kind).toBe("advance");
    if (adv!.kind === "advance") { expect(adv!.window).toBe("advance"); expect(adv!.advanceSide).toBe("home"); }
    expect(P("KXWCSCORE-26JUL09FRAMAR-FRA2MAR0")).toBeNull();
    expect(P("KXWCTEAMTOTAL-26JUL09FRAMAR-FRA2")).toBeNull();
    expect(P("KXWCGOAL-26JUL09FRAMAR-FRAKMBAPP10-1")).toBeNull();
    expect(P("KXWCCORNERS-26JUL09FRAMAR-9")).toBeNull();
    expect(P("KXWCTCORNERS-26JUL09FRAMAR-FRA6")).toBeNull();
  });
});

describe("candidateLegsV2", () => {
  it("YES-only on 3-way moneylines, YES+NO elsewhere, nulls skipped", () => {
    const markets = [
      mk("KXWCGAME-26JUL09FRAMAR-FRA"),
      mk("KXWC1H-26JUL09FRAMAR-TIE"),
      mk("KXWCTOTAL-26JUL09FRAMAR-4"),
      mk("KXWCSCORE-26JUL09FRAMAR-TIE2"), // ineligible → skipped
    ];
    const legs = candidateLegsV2(markets, "FRA", "MAR");
    const bySide = (t: string) => legs.filter((l: CandidateLegV2) => l.market.ticker === t).map((l) => l.side);
    expect(bySide("KXWCGAME-26JUL09FRAMAR-FRA")).toEqual(["yes"]);
    expect(bySide("KXWC1H-26JUL09FRAMAR-TIE")).toEqual(["yes"]);
    expect(bySide("KXWCTOTAL-26JUL09FRAMAR-4").sort()).toEqual(["no", "yes"]);
    expect(legs).toHaveLength(4);
    expect(seriesOf("KXWC1HTOTAL-26JUL09FRAMAR-2")).toBe("KXWC1HTOTAL");
  });
});
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: FAIL — `Cannot find module '../lib/parlay-v2'`

- [ ] **Step 4: Implement `lib/parlay-v2.ts` (registry + parser + candidates)**

```ts
// Parlay engine v2 — combo-eligible universe only. Pure, no I/O.
// Every leg must be purchasable inside one Kalshi combo ticket (user-verified
// combo-builder constraints, 2026-07-08). Pre-registered: Q_FIRST_HALF=0.45,
// LEG floor 0.75, JOINT floor 0.60, 2-4 legs, REDUNDANCY_CAP shared with v1.
// 3-way moneylines are YES-only (the combo builder offers one price per outcome).
import { REDUNDANCY_CAP, pct1, signed, type KalshiMarket } from "./parlay";

export const ENGINE_VERSION_V2 = "v2-combo";
export const Q_FIRST_HALF = 0.45;
export const V2_FLOORS = { leg: 0.75, joint: 0.6, maxLegs: 4 } as const;
export type V2Floors = { leg: number; joint: number; maxLegs: number };

export const COMBO_SERIES = [
  "KXWCGAME", "KXWCSPREAD", "KXWCTOTAL", "KXWCBTTS",
  "KXWC1H", "KXWC1HSPREAD", "KXWC1HTOTAL", "KXWC1HBTTS",
  "KXWCADVANCE",
] as const;
export const YES_ONLY_SERIES = new Set<string>(["KXWCGAME", "KXWC1H"]);

export const seriesOf = (ticker: string): string => ticker.split("-")[0] ?? "";
const suffixOf = (ticker: string): string => ticker.split("-").pop() ?? "";

export type LatticePredicate = (c: { h1: number; a1: number; h: number; a: number }) => boolean;
export type ParsedMarketV2 =
  | { kind: "reg"; window: "90" | "1h"; ticker: string; title: string; yesMid: number | null; pred: LatticePredicate }
  | { kind: "advance"; window: "advance"; ticker: string; title: string; yesMid: number | null; advanceSide: "home" | "away" };
export type CandidateLegV2 = { market: ParsedMarketV2; side: "yes" | "no" };

export function parseMarketV2(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarketV2 | null {
  const s = suffixOf(m.ticker);
  const base = { ticker: m.ticker, title: m.title, yesMid: m.yesMid };
  switch (seriesOf(m.ticker)) {
    case "KXWCGAME": {
      if (s === homeAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.h > c.a };
      if (s === awayAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.a > c.h };
      if (s === "TIE") return { ...base, kind: "reg", window: "90", pred: (c) => c.h === c.a };
      return null;
    }
    case "KXWCSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.h - c.a >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", window: "90", pred: (c) => c.a - c.h >= margin };
      return null;
    }
    case "KXWCTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", window: "90", pred: (c) => c.h + c.a >= n };
    }
    case "KXWCBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", window: "90", pred: (c) => c.h > 0 && c.a > 0 } : null;
    case "KXWC1H": {
      if (s === homeAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 > c.a1 };
      if (s === awayAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.a1 > c.h1 };
      if (s === "TIE") return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 === c.a1 };
      return null;
    }
    case "KXWC1HSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 - c.a1 >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", window: "1h", pred: (c) => c.a1 - c.h1 >= margin };
      return null;
    }
    case "KXWC1HTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 + c.a1 >= n };
    }
    case "KXWC1HBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", window: "1h", pred: (c) => c.h1 > 0 && c.a1 > 0 } : null;
    case "KXWCADVANCE": {
      if (s === homeAbbr) return { ...base, kind: "advance", window: "advance", advanceSide: "home" };
      if (s === awayAbbr) return { ...base, kind: "advance", window: "advance", advanceSide: "away" };
      return null;
    }
    default:
      return null; // combo-ineligible or unmodeled: structurally unpriceable
  }
}

/** Candidate legs under combo rules: YES everywhere, NO except 3-way moneylines. */
export function candidateLegsV2(markets: KalshiMarket[], homeAbbr: string, awayAbbr: string): CandidateLegV2[] {
  const out: CandidateLegV2[] = [];
  for (const m of markets) {
    const parsed = parseMarketV2(m, homeAbbr, awayAbbr);
    if (!parsed) continue;
    out.push({ market: parsed, side: "yes" });
    if (!YES_ONLY_SERIES.has(seriesOf(parsed.ticker))) out.push({ market: parsed, side: "no" });
  }
  return out;
}
```

(`REDUNDANCY_CAP`, `pct1`, `signed` are imported now and used from Task 3/4 — eslint may flag unused imports until then; if it does, add them in the task that uses them instead.)

- [ ] **Step 5: Run tests to verify they pass**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: PASS (all describe blocks)

- [ ] **Step 6: Run the full suite + lint, then commit**

Run: `npx vitest run && npx eslint .`
Expected: all green (466 existing + new), 0 errors.

```bash
git add lib/parlay-v2.ts lib/parlay.ts tests/parlay-v2.test.ts
git commit -m "feat(parlay-v2): combo-eligible registry + lattice-predicate market parser"
```

---

### Task 2: half-split lattice + exact joint

**Files:**
- Modify: `lib/parlay-v2.ts`
- Test: `tests/parlay-v2.test.ts`

**Interfaces:**
- Consumes: `scoreGrid(λh, λa, ρ): number[][]` from `lib/poisson-model` (GRID_SIZE = 9); Task 1 types.
- Produces: `type LatticeCell = { h1: number; a1: number; h: number; a: number; mass: number }` · `binomRow(n: number, q: number): number[]` · `halfLattice(grid: number[][], q: number): LatticeCell[]` · `jointProbV2(legs: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number): number` · `legProbV2(leg, lattice, etWinProbHome): number`

- [ ] **Step 1: Write failing tests**

Append to `tests/parlay-v2.test.ts`:

```ts
import { binomRow, halfLattice, jointProbV2, legProbV2 } from "../lib/parlay-v2";
import { jointProb, legProb, parseMarket, type CandidateLeg } from "../lib/parlay";
import { scoreGrid } from "../lib/poisson-model";

const grid = scoreGrid(1.4, 0.9, -0.05);
const lattice = halfLattice(grid, 0.45);
const ET = 0.62;
const yes2 = (t: string): CandidateLegV2 => ({ market: parseMarketV2(mk(t), "FRA", "MAR")!, side: "yes" });
const no2 = (t: string): CandidateLegV2 => ({ market: parseMarketV2(mk(t), "FRA", "MAR")!, side: "no" });

describe("halfLattice", () => {
  it("binomRow: Pascal weights, q edge cases exact", () => {
    expect(binomRow(2, 0.5)).toEqual([0.25, 0.5, 0.25]);
    expect(binomRow(3, 0)).toEqual([1, 0, 0, 0]);
    expect(binomRow(3, 1)).toEqual([0, 0, 0, 1]);
  });

  it("total lattice mass equals total grid mass", () => {
    const latticeMass = lattice.reduce((s, c) => s + c.mass, 0);
    const gridMass = grid.flat().reduce((s, m) => s + m, 0);
    expect(Math.abs(latticeMass - gridMass)).toBeLessThan(1e-12);
  });

  it("marginal over (h1, a1) reproduces each grid cell", () => {
    const marg = new Map<string, number>();
    for (const c of lattice) marg.set(`${c.h}-${c.a}`, (marg.get(`${c.h}-${c.a}`) ?? 0) + c.mass);
    for (let h = 0; h < grid.length; h++)
      for (let a = 0; a < grid.length; a++)
        if (grid[h][a] > 0) expect(Math.abs((marg.get(`${h}-${a}`) ?? 0) - grid[h][a])).toBeLessThan(1e-12);
  });

  it("q=0 puts all 1H mass on 0-0; q=1 makes 1H ≡ FT", () => {
    for (const c of halfLattice(grid, 0)) if (c.mass > 0) { expect(c.h1).toBe(0); expect(c.a1).toBe(0); }
    for (const c of halfLattice(grid, 1)) if (c.mass > 0) { expect(c.h1).toBe(c.h); expect(c.a1).toBe(c.a); }
  });
});

describe("jointProbV2", () => {
  it("90-minute legs price identically to the v1 engine", () => {
    const tickers = ["KXWCGAME-26JUL09FRAMAR-FRA", "KXWCTOTAL-26JUL09FRAMAR-4", "KXWCSPREAD-26JUL09FRAMAR-FRA2", "KXWCBTTS-26JUL09FRAMAR-BTTS"];
    for (const t of tickers) {
      const v1: CandidateLeg = { market: parseMarket(mk(t), "FRA", "MAR")!, side: "no" };
      expect(Math.abs(legProbV2(no2(t), lattice, ET) - legProb(v1, grid, ET))).toBeLessThan(1e-12);
    }
    const v1Joint = jointProb(
      [{ market: parseMarket(mk(tickers[0]), "FRA", "MAR")!, side: "yes" },
       { market: parseMarket(mk(tickers[1]), "FRA", "MAR")!, side: "no" }],
      grid, ET);
    expect(Math.abs(jointProbV2([yes2(tickers[0]), no2(tickers[1])], lattice, ET) - v1Joint)).toBeLessThan(1e-12);
  });

  it("matches brute-force enumeration over the lattice (mixed 1H + FT + ADVANCE)", () => {
    const legs = [yes2("KXWCADVANCE-26JUL09FRAMAR-FRA"), no2("KXWC1HTOTAL-26JUL09FRAMAR-3"), no2("KXWCTOTAL-26JUL09FRAMAR-5")];
    let p = 0;
    for (const c of lattice) {
      let cell = c.mass;
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          if (leg.market.pred(c) !== (leg.side === "yes")) { cell = 0; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (c.h > c.a) { if (!wantsHome) { cell = 0; break; } }
          else if (c.h < c.a) { if (wantsHome) { cell = 0; break; } }
          else { advFactor = wantsHome ? ET : 1 - ET; }
        }
      }
      p += cell * (advFactor !== null && cell > 0 ? advFactor : cell > 0 ? 1 : 0);
    }
    expect(Math.abs(jointProbV2(legs, lattice, ET) - p)).toBeLessThan(1e-12);
  });

  it("hand case: 1H-TIE ∧ FT France on a two-cell grid", () => {
    // grid: P(1,0)=0.6, P(2,0)=0.4 with q=0.5:
    // (1,0): 1H tie needs h1=0 → 0.5; FT France always true → 0.6·0.5 = 0.30
    // (2,0): 1H tie needs h1=0 → 0.25;                       → 0.4·0.25 = 0.10
    const tiny: number[][] = [[0, 0, 0], [0.6, 0, 0], [0.4, 0, 0]];
    const lat = halfLattice(tiny, 0.5);
    const p = jointProbV2([yes2("KXWC1H-26JUL09FRAMAR-TIE"), yes2("KXWCGAME-26JUL09FRAMAR-FRA")], lat, 0.5);
    expect(Math.abs(p - 0.4)).toBeLessThan(1e-12);
  });

  it("cross-half correlation is real: joint ≠ product of marginals", () => {
    const a = yes2("KXWC1HTOTAL-26JUL09FRAMAR-1"); // over 0.5 1H goals
    const b = no2("KXWCTOTAL-26JUL09FRAMAR-3");    // under 2.5 FT goals
    const joint = jointProbV2([a, b], lattice, ET);
    const prod = legProbV2(a, lattice, ET) * legProbV2(b, lattice, ET);
    expect(Math.abs(joint - prod)).toBeGreaterThan(1e-4);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: FAIL — `binomRow` / `halfLattice` / `jointProbV2` not exported.

- [ ] **Step 3: Implement lattice + joint in `lib/parlay-v2.ts`**

```ts
export type LatticeCell = { h1: number; a1: number; h: number; a: number; mass: number };

/** C(n,k)·q^k·(1−q)^(n−k) for k = 0..n, Pascal recurrence; exact at q = 0 and 1. */
export function binomRow(n: number, q: number): number[] {
  if (q <= 0) return Array.from({ length: n + 1 }, (_, k) => (k === 0 ? 1 : 0));
  if (q >= 1) return Array.from({ length: n + 1 }, (_, k) => (k === n ? 1 : 0));
  const row: number[] = [(1 - q) ** n];
  for (let k = 1; k <= n; k++) row.push(row[k - 1] * ((n - k + 1) / k) * (q / (1 - q)));
  return row;
}

/** 4-dim half-split lattice: DC grid stays ground truth; each goal lands in the
 *  first half independently with probability q (spec §3, Q_FIRST_HALF pre-registered). */
export function halfLattice(grid: number[][], q: number): LatticeCell[] {
  const cells: LatticeCell[] = [];
  for (let h = 0; h < grid.length; h++) {
    const bh = binomRow(h, q);
    for (let a = 0; a < grid.length; a++) {
      const mass = grid[h][a];
      if (mass === 0) continue;
      const ba = binomRow(a, q);
      for (let h1 = 0; h1 <= h; h1++)
        for (let a1 = 0; a1 <= a; a1++) cells.push({ h1, a1, h, a, mass: mass * bh[h1] * ba[a1] });
    }
  }
  return cells;
}

/** Exact joint over the lattice. Advance legs: win/loss cells by FT sign, draw
 *  cells by the shared ET Bernoulli — same convention as the v1 engine. */
export function jointProbV2(legs: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number): number {
  let p = 0;
  for (const c of lattice) {
    let pass = true;
    let advFactor: number | null = null;
    for (const leg of legs) {
      if (leg.market.kind === "reg") {
        if (leg.market.pred(c) !== (leg.side === "yes")) { pass = false; break; }
      } else {
        const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
        if (c.h > c.a && !wantsHome) { pass = false; break; }
        if (c.h < c.a && wantsHome) { pass = false; break; }
        if (c.h === c.a) {
          const f = wantsHome ? etWinProbHome : 1 - etWinProbHome;
          if (advFactor === null) advFactor = f;
          else if (advFactor !== f) { pass = false; break; }
        }
      }
    }
    if (pass) p += c.mass * (advFactor ?? 1);
  }
  return p;
}

export const legProbV2 = (leg: CandidateLegV2, lattice: LatticeCell[], etWinProbHome: number): number =>
  jointProbV2([leg], lattice, etWinProbHome);
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add lib/parlay-v2.ts tests/parlay-v2.test.ts
git commit -m "feat(parlay-v2): binomial half-split lattice + exact joint (q=0.45 pre-registered)"
```

---

### Task 3: v2 selection under hit-first floors

**Files:**
- Modify: `lib/parlay-v2.ts`
- Test: `tests/parlay-v2.test.ts`

**Interfaces:**
- Consumes: Task 1–2 exports; `REDUNDANCY_CAP` from `lib/parlay.ts`.
- Produces: `type SelectionV2 = { verdict: "slip"; legs: CandidateLegV2[]; jointProb: number } | { verdict: "no-slip"; reason: string }` · `selectSlipV2(candidates: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number, floors: V2Floors): SelectionV2` · no-slip reason string is exactly `"no 2-leg combo ≥ v2 floors"`.

- [ ] **Step 1: Write failing tests**

Append to `tests/parlay-v2.test.ts`:

```ts
import { selectSlipV2 } from "../lib/parlay-v2";

describe("selectSlipV2", () => {
  const floors = { leg: 0.75, joint: 0.6, maxLegs: 4 };
  const pool = candidateLegsV2(
    ["KXWCGAME-26JUL09FRAMAR-FRA", "KXWCGAME-26JUL09FRAMAR-TIE",
     "KXWCTOTAL-26JUL09FRAMAR-4", "KXWCTOTAL-26JUL09FRAMAR-5", "KXWCTOTAL-26JUL09FRAMAR-6",
     "KXWCSPREAD-26JUL09FRAMAR-MAR2", "KXWC1HTOTAL-26JUL09FRAMAR-3", "KXWC1HSPREAD-26JUL09FRAMAR-MAR2",
     "KXWC1H-26JUL09FRAMAR-FRA", "KXWCADVANCE-26JUL09FRAMAR-FRA"].map((t) => mk(t)),
    "FRA", "MAR");

  it("emits a deterministic 2-4 leg slip meeting every floor", () => {
    const sel = selectSlipV2(pool, lattice, ET, floors);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict !== "slip") return;
    expect(sel.legs.length).toBeGreaterThanOrEqual(2);
    expect(sel.legs.length).toBeLessThanOrEqual(4);
    expect(sel.jointProb).toBeGreaterThanOrEqual(0.6);
    for (const leg of sel.legs) expect(legProbV2(leg, lattice, ET)).toBeGreaterThanOrEqual(0.75);
    const again = selectSlipV2(pool, lattice, ET, floors);
    expect(again).toEqual(sel); // determinism
  });

  it("respects maxLegs from floors", () => {
    const sel = selectSlipV2(pool, lattice, ET, { ...floors, maxLegs: 2 });
    if (sel.verdict === "slip") expect(sel.legs.length).toBe(2);
  });

  it("no-slip when floors unreachable, with the registered v2 reason", () => {
    const sel = selectSlipV2(pool, lattice, ET, { leg: 0.999, joint: 0.99, maxLegs: 4 });
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" });
  });

  it("never selects a NO side of a YES-only series (enforced upstream)", () => {
    const sel = selectSlipV2(pool, lattice, ET, floors);
    if (sel.verdict !== "slip") return;
    for (const leg of sel.legs) {
      if (YES_ONLY_SERIES.has(seriesOf(leg.market.ticker))) expect(leg.side).toBe("yes");
    }
  });

  it("redundancy cap rejects an implied leg", () => {
    // Synthetic deep-tail totals: NO 'over 7.5' (-8) is near-certain given the
    // seed NO 'over 8.5' (-9) — conditional P(total≤7 | total≤8) ≈ 0.999 > 0.97.
    // (Kalshi lists totals only up to -6, but the parser accepts any digit; this
    // is a pure-engine test.)
    const tight = candidateLegsV2(
      ["KXWCTOTAL-26JUL09FRAMAR-8", "KXWCTOTAL-26JUL09FRAMAR-9"].map((t) => mk(t)), "FRA", "MAR");
    const sel = selectSlipV2(tight, lattice, ET, { leg: 0.5, joint: 0.3, maxLegs: 4 });
    // both NO legs clear the leg floor, but the second is implied → single leg → no-slip
    expect(sel.verdict).toBe("no-slip");
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: FAIL — `selectSlipV2` not exported.

- [ ] **Step 3: Implement `selectSlipV2`**

Append to `lib/parlay-v2.ts` (this is the v1 greedy verbatim with parameterized floors — one algorithm, two registrations):

```ts
export type SelectionV2 =
  | { verdict: "slip"; legs: CandidateLegV2[]; jointProb: number }
  | { verdict: "no-slip"; reason: string };

const NO_SLIP_V2 = { verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" } as const;

const legOrderV2 = (
  a: { leg: CandidateLegV2; p: number }, b: { leg: CandidateLegV2; p: number },
): number =>
  b.p - a.p ||
  a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
  a.leg.side.localeCompare(b.leg.side);

/** Confidence-tiered hit-max under caller-registered floors. Deterministic. */
export function selectSlipV2(
  candidates: CandidateLegV2[], lattice: LatticeCell[], etWinProbHome: number, floors: V2Floors,
): SelectionV2 {
  const eligible = candidates
    .map((leg) => ({ leg, p: legProbV2(leg, lattice, etWinProbHome) }))
    .filter((c) => c.p >= floors.leg)
    .sort(legOrderV2);
  if (eligible.length < 2) return NO_SLIP_V2;

  const slip: CandidateLegV2[] = [eligible[0].leg];
  let joint = eligible[0].p;
  let pool = eligible.slice(1);

  while (slip.length < floors.maxLegs && pool.length > 0) {
    const scored = pool
      .map((c) => {
        const j = jointProbV2([...slip, c.leg], lattice, etWinProbHome);
        return { ...c, j, conditional: j / joint };
      })
      .filter((c) => c.conditional <= REDUNDANCY_CAP && c.j >= floors.joint)
      .sort(
        (a, b) =>
          b.conditional - a.conditional ||
          a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
          a.leg.side.localeCompare(b.leg.side),
      );
    if (scored.length === 0) break;
    slip.push(scored[0].leg);
    joint = scored[0].j;
    pool = pool.filter((c) => c.leg !== scored[0].leg);
  }

  if (slip.length < 2) return NO_SLIP_V2;
  return { verdict: "slip", legs: slip, jointProb: joint };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: PASS. If "redundancy cap rejects an implied leg" fails because the conditional of NO-over-5.5 given NO-over-4.5 lands below 0.97 on this grid, verify by printing the conditional and swap the pair to `KXWCTOTAL-...-6` given `-5` (higher implication) — do not weaken the cap.

- [ ] **Step 5: Commit**

```bash
git add lib/parlay-v2.ts tests/parlay-v2.test.ts
git commit -m "feat(parlay-v2): hit-first selection under pre-registered v2 floors (0.75/0.60/2-4)"
```

---

### Task 4: v2 reasoning + combo-implied probability

**Files:**
- Modify: `lib/parlay-v2.ts`
- Test: `tests/parlay-v2.test.ts`

**Interfaces:**
- Consumes: `REASONING_GRAMMAR`, `pct1`, `signed`, `legReasoning`, v1 types from `lib/parlay.ts`.
- Produces: `legReasoningV2(leg: CandidateLegV2, lattice: LatticeCell[], etWinProbHome: number, ctx: { eloDiff: number; homeAbbr: string; awayAbbr: string }): string` (same fixed grammar as v1 — `REASONING_GRAMMAR` must match) · `comboImpliedProb(mids: Array<number | null>): number | null`.

- [ ] **Step 1: Write failing tests**

Append to `tests/parlay-v2.test.ts`:

```ts
import { comboImpliedProb, legReasoningV2 } from "../lib/parlay-v2";
import { REASONING_GRAMMAR, legReasoning } from "../lib/parlay";

describe("legReasoningV2", () => {
  const ctx = { eloDiff: 187, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("matches the v1 grammar for 1H, FT and ADVANCE legs", () => {
    for (const leg of [no2("KXWC1HTOTAL-26JUL09FRAMAR-3"), yes2("KXWCGAME-26JUL09FRAMAR-FRA"), yes2("KXWCADVANCE-26JUL09FRAMAR-FRA")]) {
      expect(legReasoningV2(leg, lattice, ET, ctx)).toMatch(REASONING_GRAMMAR);
    }
  });

  it("byte-identical to v1 reasoning for a pure 90-minute leg", () => {
    const t = "KXWCTOTAL-26JUL09FRAMAR-5";
    const v1 = legReasoning({ market: parseMarket(mk(t), "FRA", "MAR")!, side: "no" }, grid, ET, ctx);
    expect(legReasoningV2(no2(t), lattice, ET, ctx)).toBe(v1);
  });

  it("null mid renders 'Kalshi n/a'", () => {
    const m: KalshiMarket = { ticker: "KXWC1HBTTS-26JUL09FRAMAR-BTTS", title: "t", yesMid: null };
    const leg: CandidateLegV2 = { market: parseMarketV2(m, "FRA", "MAR")!, side: "no" };
    expect(legReasoningV2(leg, lattice, ET, ctx)).toContain("Kalshi n/a.");
  });
});

describe("comboImpliedProb", () => {
  it("product of mids; null-propagating", () => {
    expect(comboImpliedProb([0.5, 0.8])).toBeCloseTo(0.4, 12);
    expect(comboImpliedProb([0.5, null, 0.8])).toBeNull();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/parlay-v2.test.ts`
Expected: FAIL — functions not exported.

- [ ] **Step 3: Implement**

Append to `lib/parlay-v2.ts`:

```ts
/** Display-only Kalshi combo estimate: product of side-adjusted leg mids.
 *  Approximate by construction (Kalshi adds vig/fees) — never a selection input. */
export function comboImpliedProb(mids: Array<number | null>): number | null {
  let p = 1;
  for (const m of mids) {
    if (m === null) return null;
    p *= m;
  }
  return p;
}

/** Fixed-grammar reasoning, v1 grammar reused. Top scorelines are FULL-TIME
 *  scorelines: a leg's passing lattice mass is aggregated by (h, a), which for
 *  90-minute legs reproduces the v1 string byte-for-byte. */
export function legReasoningV2(
  leg: CandidateLegV2,
  lattice: LatticeCell[],
  etWinProbHome: number,
  ctx: { eloDiff: number; homeAbbr: string; awayAbbr: string },
): string {
  const cellSatisfies = (c: LatticeCell): boolean => {
    if (leg.market.kind === "reg") return leg.market.pred(c) === (leg.side === "yes");
    const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
    if (c.h > c.a) return wantsHome;
    if (c.h < c.a) return !wantsHome;
    return (wantsHome ? etWinProbHome : 1 - etWinProbHome) > 0;
  };

  const p = legProbV2(leg, lattice, etWinProbHome);
  const byScoreline = new Map<string, { h: number; a: number; mass: number }>();
  for (const c of lattice) {
    if (!cellSatisfies(c)) continue;
    const key = `${c.h}-${c.a}`;
    const cur = byScoreline.get(key) ?? { h: c.h, a: c.a, mass: 0 };
    cur.mass += c.mass;
    byScoreline.set(key, cur);
  }
  const cells = [...byScoreline.values()].filter((c) => c.mass > 0);
  cells.sort((x, y) => y.mass - x.mass || x.h - y.h || x.a - y.a);
  const top = cells
    .slice(0, 3)
    .map((c) => `${c.h >= c.a ? ctx.homeAbbr : ctx.awayAbbr} ${Math.max(c.h, c.a)}-${Math.min(c.h, c.a)} ${pct1(c.mass)}`)
    .join(" / ");
  const mid = leg.market.yesMid;
  const sideMid = mid === null ? null : leg.side === "yes" ? mid : 1 - mid;
  const edgePts = sideMid === null ? null : (p - sideMid) * 100;
  const kalshi =
    sideMid === null || edgePts === null
      ? "Kalshi n/a"
      : `Kalshi ${pct1(sideMid)} (edge ${edgePts >= 0 ? "+" : ""}${edgePts.toFixed(1)})`;
  return `${leg.market.title} — ${leg.side.toUpperCase()}: model ${pct1(p)}; top scorelines ${top}; Elo ${signed(Math.round(ctx.eloDiff))}; ${kalshi}.`;
}
```

Note the aggregated-mass float caveat: summing sub-cell masses per (h,a) can drift at the 1e-16 level from the raw grid cell, but `pct1` rounds to 0.1% so the byte-identity test with v1 holds. If it ever fails, compare the two strings — the fix is aggregation order, never a grammar change.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/parlay-v2.test.ts && npx eslint lib/parlay-v2.ts`
Expected: PASS, 0 lint errors (all Task-1 imports now used).

- [ ] **Step 5: Commit**

```bash
git add lib/parlay-v2.ts tests/parlay-v2.test.ts
git commit -m "feat(parlay-v2): grammar-locked v2 reasoning + display-only combo-implied product"
```

---

### Task 5: lock pipeline emits v2 slips

**Files:**
- Modify: `scripts/lock-parlays.mts`
- Test: `tests/lock-parlays.test.ts`

**Interfaces:**
- Consumes: everything from Tasks 1–4; `lambdasFromElo`, `scoreGrid`, `advancementProb`, `summarizeGrid` from `lib/poisson-model`; `appDir`, `fixtures`, `teams`, `kalshiEventCode` from `scripts/shared.mts`; existing `marketMid` (unchanged).
- Produces: `PARLAY_SERIES_V2` re-export (equal to `COMBO_SERIES`) · `haveV2Slugs(existing: Array<{ slug: string; engineVersion?: string }>): Set<string>` · `snapshotFileV2(slug: string): string` returning `"<slug>-v2.json"` · v2 ledger records shaped:

```jsonc
{ "slug": "...", "engineVersion": "v2-combo", "lockedAt": "...", "modelDataThrough": "...",
  "eloDiff": 0, "lambdas": {"home":0,"away":0}, "rho": 0, "etWinProbHome": 0,
  "qFirstHalf": 0.45, "floors": { "leg": 0.75, "joint": 0.6, "maxLegs": 4 },
  "legs": [{ "ticker": "...", "side": "yes", "title": "...", "modelProb": 0, "kalshiMid": 0, "reasoning": "..." }],
  "jointProb": 0, "comboImpliedProb": 0 }
// no-slip: { "slug", "engineVersion": "v2-combo", "lockedAt", "verdict": "no-slip", "reason": "no 2-leg combo ≥ v2 floors" }
```

- [ ] **Step 1: Update the series test + add version-idempotence tests (failing first)**

In `tests/lock-parlays.test.ts`, replace the `PARLAY_SERIES` describe block (lines 24-27) with:

```ts
import { PARLAY_SERIES_V2, haveV2Slugs, snapshotFileV2, marketMid } from "../scripts/lock-parlays.mts";
import { COMBO_SERIES } from "../lib/parlay-v2";

describe("v2 lock plumbing", () => {
  it("locks exactly the combo-eligible series", () => {
    expect(PARLAY_SERIES_V2).toEqual(COMBO_SERIES);
  });

  it("haveV2Slugs keys idempotence on (slug, v2) — v1 entries never block a v2 relock", () => {
    const have = haveV2Slugs([
      { slug: "france-vs-morocco" },                                  // v1 (no engineVersion)
      { slug: "spain-vs-belgium", engineVersion: "v2-combo" },
      { slug: "norway-vs-england", engineVersion: "v1" },
    ]);
    expect(have.has("france-vs-morocco")).toBe(false);
    expect(have.has("spain-vs-belgium")).toBe(true);
    expect(have.has("norway-vs-england")).toBe(false);
  });

  it("v2 snapshots live beside v1 with a -v2 suffix", () => {
    expect(snapshotFileV2("france-vs-morocco")).toBe("france-vs-morocco-v2.json");
  });
});
```

Keep the existing `marketMid` tests untouched. Remove the old `PARLAY_SERIES` import.

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/lock-parlays.test.ts`
Expected: FAIL — `PARLAY_SERIES_V2`/`haveV2Slugs`/`snapshotFileV2` not exported.

- [ ] **Step 3: Rewrite `scripts/lock-parlays.mts` for v2**

Replace the v1 series constant (line 13) and the marked parts of `main()`. Full new shape (keep `marketMid`, `fetchSeries`, the model-load block, and the HOSTS neutral idiom exactly as they are):

```ts
// (header comment: add) v2: legs restricted to Kalshi combo-eligible series so
// every slip is purchasable as one combo ticket; ledger is versioned — v1
// entries are history, lock only emits engineVersion "v2-combo" from now on.
import {
  COMBO_SERIES, ENGINE_VERSION_V2, Q_FIRST_HALF, V2_FLOORS,
  candidateLegsV2, comboImpliedProb, halfLattice, legProbV2, legReasoningV2, selectSlipV2,
} from "../lib/parlay-v2";
import type { KalshiMarket } from "../lib/parlay";

export const PARLAY_SERIES_V2 = COMBO_SERIES;

export function haveV2Slugs(existing: Array<{ slug: string; engineVersion?: string }>): Set<string> {
  return new Set(existing.filter((e) => e.engineVersion === ENGINE_VERSION_V2).map((e) => e.slug));
}

export const snapshotFileV2 = (slug: string): string => `${slug}-v2.json`;
```

Inside `main()`:
1. `const have = haveV2Slugs(existing as Array<{ slug: string; engineVersion?: string }>);`
2. Fetch loop: `for (const s of PARLAY_SERIES_V2) all.push(...(await fetchSeries(s, code)));`
3. Snapshot write: `path.join(SNAP_DIR, snapshotFileV2(f.slug))`.
4. After `grid` is computed: `const latticeCells = halfLattice(grid, Q_FIRST_HALF);`
5. Candidates: `const candidates = candidateLegsV2(all, homeAbbr, awayAbbr);`
6. Selection: `const sel = selectSlipV2(candidates, latticeCells, etWinProbHome, V2_FLOORS);`
7. No-slip record: `out.push({ slug: f.slug, engineVersion: ENGINE_VERSION_V2, lockedAt, verdict: "no-slip", reason: sel.reason });`
8. Slip record (replacing the v1 push):

```ts
const legs = sel.legs.map((leg) => ({
  ticker: leg.market.ticker,
  side: leg.side,
  title: leg.market.title,
  modelProb: legProbV2(leg, latticeCells, etWinProbHome),
  kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
  reasoning: legReasoningV2(leg, latticeCells, etWinProbHome, ctx),
}));
out.push({
  slug: f.slug,
  engineVersion: ENGINE_VERSION_V2,
  lockedAt,
  modelDataThrough: model.dataThrough,
  eloDiff,
  lambdas,
  rho: model.params.rho,
  etWinProbHome,
  qFirstHalf: Q_FIRST_HALF,
  floors: { leg: V2_FLOORS.leg, joint: V2_FLOORS.joint, maxLegs: V2_FLOORS.maxLegs },
  legs,
  jointProb: sel.jointProb,
  comboImpliedProb: comboImpliedProb(legs.map((l) => l.kalshiMid)),
});
console.log(`[lock-parlays] ${f.slug}: v2 ${sel.legs.length}-leg slip, joint ${(sel.jointProb * 100).toFixed(1)}%`);
```

Drop the now-unused v1 imports (`legReasoning`, `parseMarket`, `selectSlip`, `legProb`, `CandidateLeg`) and the old `PARLAY_SERIES` export.

- [ ] **Step 4: Run tests + lint**

Run: `npx vitest run tests/lock-parlays.test.ts && npx eslint scripts/lock-parlays.mts`
Expected: PASS, 0 errors.

- [ ] **Step 5: Full suite, then commit**

Run: `npx vitest run`
Expected: all green — if any other test imported `PARLAY_SERIES`, fix its import to `PARLAY_SERIES_V2` semantics deliberately, not mechanically.

```bash
git add scripts/lock-parlays.mts tests/lock-parlays.test.ts
git commit -m "feat(parlay-v2): lock pipeline emits versioned combo-eligible slips"
```

---

### Task 6: settle pipeline — HT grading + version dispatch

**Files:**
- Modify: `scripts/settle-parlays.mts`
- Test: `tests/settle-parlays.test.ts`

**Interfaces:**
- Consumes: `parseMarketV2`, `ENGINE_VERSION_V2` from `lib/parlay-v2`; existing `gradeLeg` (unchanged, keeps grading v1 slips).
- Produces: `gradeLegV2(leg: { ticker: string; side: "yes" | "no" }, ctx: { h90: number; a90: number; h1: number | null; a1: number | null; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string }): boolean | null` · knockout-results rows may carry optional `ht: { home: number; away: number }`.

- [ ] **Step 1: Write failing tests**

Append to `tests/settle-parlays.test.ts`:

```ts
import { gradeLegV2 } from "../scripts/settle-parlays.mts";

describe("gradeLegV2", () => {
  const base = { h90: 2, a90: 1, h1: 1, a1: 0, advancedHome: true, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("1H legs grade on the half-time score", () => {
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-1", side: "yes" }, base)).toBe(true);  // 1 1H goal ≥ 1
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-2", side: "no" }, base)).toBe(true);   // under 1.5 1H
    expect(gradeLegV2({ ticker: "KXWC1H-26JUL09FRAMAR-FRA", side: "yes" }, base)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWC1HBTTS-26JUL09FRAMAR-BTTS", side: "no" }, base)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWC1HSPREAD-26JUL09FRAMAR-FRA2", side: "yes" }, base)).toBe(false);
  });

  it("missing HT makes 1H legs ungradable but not 90-minute legs", () => {
    const noHt = { ...base, h1: null, a1: null };
    expect(gradeLegV2({ ticker: "KXWC1HTOTAL-26JUL09FRAMAR-1", side: "yes" }, noHt)).toBeNull();
    expect(gradeLegV2({ ticker: "KXWCTOTAL-26JUL09FRAMAR-3", side: "yes" }, noHt)).toBe(true);   // 3 FT goals ≥ 3
  });

  it("90-minute + advance legs grade exactly like v1 (pens-draw case)", () => {
    const pens = { h90: 1, a90: 1, h1: 0, a1: 1, advancedHome: false, homeAbbr: "ARG", awayAbbr: "SUI" };
    expect(gradeLegV2({ ticker: "KXWCGAME-26JUL12ARGSUI-TIE", side: "yes" }, pens)).toBe(true);
    expect(gradeLegV2({ ticker: "KXWCADVANCE-26JUL12ARGSUI-ARG", side: "yes" }, pens)).toBe(false);
    expect(gradeLegV2({ ticker: "KXWCADVANCE-26JUL12ARGSUI-ARG", side: "no" }, pens)).toBe(true);
  });

  it("combo-ineligible ticker is ungradable", () => {
    expect(gradeLegV2({ ticker: "KXWCSCORE-26JUL09FRAMAR-FRA2MAR0", side: "no" }, base)).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/settle-parlays.test.ts`
Expected: FAIL — `gradeLegV2` not exported.

- [ ] **Step 3: Implement `gradeLegV2` + version dispatch in `scripts/settle-parlays.mts`**

Add after `gradeLeg` (which stays byte-identical):

```ts
export function gradeLegV2(
  leg: { ticker: string; side: "yes" | "no" },
  ctx: { h90: number; a90: number; h1: number | null; a1: number | null; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string },
): boolean | null {
  const parsed = parseMarketV2({ ticker: leg.ticker, title: "", yesMid: null }, ctx.homeAbbr, ctx.awayAbbr);
  if (!parsed) return null;
  if (parsed.kind === "advance") {
    if (ctx.advancedHome === null) return null;
    const yesOutcome = parsed.advanceSide === "home" ? ctx.advancedHome : !ctx.advancedHome;
    return leg.side === "yes" ? yesOutcome : !yesOutcome;
  }
  if (parsed.window === "1h" && (ctx.h1 === null || ctx.a1 === null)) return null;
  const yesOutcome = parsed.pred({ h1: ctx.h1 ?? 0, a1: ctx.a1 ?? 0, h: ctx.h90, a: ctx.a90 });
  return leg.side === "yes" ? yesOutcome : !yesOutcome;
}
```

with `import { ENGINE_VERSION_V2, parseMarketV2 } from "../lib/parlay-v2";` at the top.

In `main()`:
1. Extend the `koRows` type with `ht?: { home: number; away: number };`.
2. After `advancedHome`, add: `const h1 = row?.ht ? row.ht.home : null;` and `const a1 = row?.ht ? row.ht.away : null;`
3. Replace the grading line with a version dispatch:

```ts
const isV2 = (slip as { engineVersion?: string }).engineVersion === ENGINE_VERSION_V2;
const legs = (slip.legs as Array<{ ticker: string; side: "yes" | "no" }>).map((l) => ({
  ticker: l.ticker,
  hit: isV2 ? gradeLegV2(l, { ...ctx, h1, a1 }) : gradeLeg(l, ctx),
}));
if (legs.some((l) => l.hit === null)) {
  console.error(
    `[settle-parlays] ${slip.slug}${isV2 ? " (v2)" : ""}: ungradable leg — skipped` +
    (isV2 && h1 === null ? " (1H legs need ht: {home, away} in knockout-results.json)" : ""),
  );
  continue;
}
```

- [ ] **Step 4: Run tests + lint**

Run: `npx vitest run tests/settle-parlays.test.ts && npx eslint scripts/settle-parlays.mts`
Expected: PASS, 0 errors.

- [ ] **Step 5: Commit**

```bash
git add scripts/settle-parlays.mts tests/settle-parlays.test.ts
git commit -m "feat(parlay-v2): half-time grading window + per-version settle dispatch"
```

---

### Task 7: inspector — version dispatch + gates 8/9/10

**Files:**
- Modify: `scripts/parlay-inspector.mts`
- Test: `tests/parlay-inspector.test.ts`

**Interfaces:**
- Consumes: Tasks 1–4 exports; existing `inspectSlip` (v1, byte-unchanged) and its `SlipRecord`.
- Produces: `type SlipRecordV2 = SlipRecord & { engineVersion?: string; qFirstHalf?: number; floors?: { leg: number; joint: number; maxLegs: number }; comboImpliedProb?: number | null }` · `inspectSlipV2(slip: SlipRecordV2, snapshot: { markets: KalshiMarket[] }, ctx: { homeAbbr: string; awayAbbr: string }): string[]` — empty array = pass; fail strings prefixed `gate1:`…`gate10:`.

- [ ] **Step 1: Write failing tests**

Append to `tests/parlay-inspector.test.ts` (build the golden v2 slip exactly the way the lock script does, then tamper per gate):

```ts
import { inspectSlipV2, type SlipRecordV2 } from "../scripts/parlay-inspector.mts";
import {
  ENGINE_VERSION_V2, Q_FIRST_HALF, V2_FLOORS,
  candidateLegsV2, comboImpliedProb, halfLattice, legProbV2, legReasoningV2, selectSlipV2,
} from "../lib/parlay-v2";
import { scoreGrid } from "../lib/poisson-model";
import type { KalshiMarket } from "../lib/parlay";

const mkV2 = (ticker: string, yesMid: number | null = 0.5): KalshiMarket => ({ ticker, title: `T ${ticker}`, yesMid });

describe("inspectSlipV2", () => {
  const ctx = { homeAbbr: "FRA", awayAbbr: "MAR" };
  const lambdas = { home: 1.4, away: 0.9 };
  const rho = -0.05;
  const et = 0.62;
  const snapshot = {
    markets: [
      mkV2("KXWCGAME-26JUL09FRAMAR-FRA", 0.62), mkV2("KXWCGAME-26JUL09FRAMAR-TIE", 0.25),
      mkV2("KXWCTOTAL-26JUL09FRAMAR-4", 0.12), mkV2("KXWCTOTAL-26JUL09FRAMAR-5", 0.05),
      mkV2("KXWC1HTOTAL-26JUL09FRAMAR-3", 0.1), mkV2("KXWC1HSPREAD-26JUL09FRAMAR-MAR2", 0.02),
      mkV2("KXWCSPREAD-26JUL09FRAMAR-MAR2", 0.04), mkV2("KXWCADVANCE-26JUL09FRAMAR-FRA", 0.78),
    ],
  };

  function goldenSlip(): SlipRecordV2 {
    const grid = scoreGrid(lambdas.home, lambdas.away, rho);
    const lat = halfLattice(grid, Q_FIRST_HALF);
    const sel = selectSlipV2(candidateLegsV2(snapshot.markets, ctx.homeAbbr, ctx.awayAbbr), lat, et, V2_FLOORS);
    if (sel.verdict !== "slip") throw new Error("fixture must produce a slip");
    const legs = sel.legs.map((leg) => ({
      ticker: leg.market.ticker,
      side: leg.side,
      title: leg.market.title,
      modelProb: legProbV2(leg, lat, et),
      kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
      reasoning: legReasoningV2(leg, lat, et, { eloDiff: 187, homeAbbr: ctx.homeAbbr, awayAbbr: ctx.awayAbbr }),
    }));
    return {
      slug: "france-vs-morocco", engineVersion: ENGINE_VERSION_V2, lockedAt: "2026-07-08T18:00:00.000Z",
      modelDataThrough: "2026-07-07", eloDiff: 187, lambdas, rho, etWinProbHome: et,
      qFirstHalf: Q_FIRST_HALF, floors: { ...V2_FLOORS },
      legs, jointProb: sel.jointProb, comboImpliedProb: comboImpliedProb(legs.map((l) => l.kalshiMid)),
    };
  }

  it("golden v2 slip passes every gate", () => {
    expect(inspectSlipV2(goldenSlip(), snapshot, ctx)).toEqual([]);
  });

  it("gate8 fires: combo-ineligible leg / NO on a YES-only series / too many legs", () => {
    const a = goldenSlip();
    a.legs![0] = { ...a.legs![0], ticker: "KXWCSCORE-26JUL09FRAMAR-FRA2MAR0" };
    expect(inspectSlipV2(a, snapshot, ctx).some((f) => f.startsWith("gate8:") || f.startsWith("gate1:"))).toBe(true);

    const b = goldenSlip();
    const ml = b.legs!.find((l) => l.ticker.startsWith("KXWCGAME"));
    if (ml) {
      ml.side = "no";
      expect(inspectSlipV2(b, snapshot, ctx).some((f) => f.startsWith("gate8:"))).toBe(true);
    }

    const c = goldenSlip();
    c.floors = { ...c.floors!, maxLegs: 1 };
    expect(inspectSlipV2(c, snapshot, ctx).some((f) => f.startsWith("gate8:") || f.startsWith("gate4:"))).toBe(true);
  });

  it("gate9 fires on jointProb drift and on missing qFirstHalf", () => {
    const a = goldenSlip();
    a.jointProb = a.jointProb! + 0.01;
    expect(inspectSlipV2(a, snapshot, ctx).some((f) => f.startsWith("gate3:") || f.startsWith("gate9:"))).toBe(true);

    const b = goldenSlip();
    delete b.qFirstHalf;
    expect(inspectSlipV2(b, snapshot, ctx).length).toBeGreaterThan(0);
  });

  it("gate10 fires when comboImpliedProb does not re-derive from stored mids", () => {
    const a = goldenSlip();
    a.comboImpliedProb = 0.123456;
    expect(inspectSlipV2(a, snapshot, ctx).some((f) => f.startsWith("gate10:"))).toBe(true);
  });

  it("v2 no-slip record needs reason + engineVersion", () => {
    const ok: SlipRecordV2 = { slug: "spain-vs-belgium", engineVersion: ENGINE_VERSION_V2, lockedAt: "2026-07-08T18:00:00.000Z", verdict: "no-slip", reason: "no 2-leg combo ≥ v2 floors" };
    expect(inspectSlipV2(ok, { markets: [] }, { homeAbbr: "ESP", awayAbbr: "BEL" })).toEqual([]);
    const bad = { ...ok, reason: "" };
    expect(inspectSlipV2(bad, { markets: [] }, { homeAbbr: "ESP", awayAbbr: "BEL" }).length).toBeGreaterThan(0);
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/parlay-inspector.test.ts`
Expected: FAIL — `inspectSlipV2` not exported.

- [ ] **Step 3: Implement `inspectSlipV2` + main-loop dispatch**

In `scripts/parlay-inspector.mts` add:

```ts
import {
  COMBO_SERIES, ENGINE_VERSION_V2, YES_ONLY_SERIES, halfLattice, jointProbV2, legProbV2,
  legReasoningV2, parseMarketV2, seriesOf, comboImpliedProb as comboImplied, type CandidateLegV2,
} from "../lib/parlay-v2";

export type SlipRecordV2 = SlipRecord & {
  engineVersion?: string;
  qFirstHalf?: number;
  floors?: { leg: number; joint: number; maxLegs: number };
  comboImpliedProb?: number | null;
};

const SLIP_KEYS_V2 = new Set([...SLIP_KEYS, "engineVersion", "qFirstHalf", "floors", "comboImpliedProb"]);
const COMBO_SET = new Set<string>(COMBO_SERIES);

export function inspectSlipV2(
  slip: SlipRecordV2,
  snapshot: { markets: KalshiMarket[] },
  ctx: { homeAbbr: string; awayAbbr: string },
): string[] {
  const fails: string[] = [];

  if (slip.engineVersion !== ENGINE_VERSION_V2) fails.push(`gate8: engineVersion "${slip.engineVersion}" is not "${ENGINE_VERSION_V2}"`);
  if (!slip.lockedAt || new Date(slip.lockedAt).getTime() > Date.now()) {
    fails.push(`gate6: lockedAt missing or in the future (${slip.lockedAt})`);
  }

  if (slip.verdict === "no-slip") {
    if (typeof slip.reason !== "string" || slip.reason.length === 0) fails.push("gate7: no-slip record missing reason string");
    return fails;
  }

  for (const k of Object.keys(slip)) if (!SLIP_KEYS_V2.has(k)) fails.push(`gate6: unexpected slip key "${k}"`);
  if (slip.result) for (const k of Object.keys(slip.result)) if (!RESULT_KEYS.has(k)) fails.push(`gate6: unexpected result key "${k}"`);

  const legs = slip.legs ?? [];
  const bySnapTicker = new Map(snapshot.markets.map((m) => [m.ticker, m]));

  // gate 1 (snapshot membership) + gate 8 (combo eligibility, YES-only MLs)
  for (const leg of legs) {
    if (!bySnapTicker.has(leg.ticker)) fails.push(`gate1: leg ticker not in snapshot (${leg.ticker})`);
    const series = seriesOf(leg.ticker);
    if (!COMBO_SET.has(series)) fails.push(`gate8: series not combo-eligible (${leg.ticker})`);
    if (YES_ONLY_SERIES.has(series) && leg.side !== "yes") fails.push(`gate8: NO side on YES-only series (${leg.ticker})`);
  }

  // gate 2: parseable under the v2 registry
  const candidates: Array<CandidateLegV2 | null> = legs.map((leg) => {
    const snap = bySnapTicker.get(leg.ticker);
    const parsed = parseMarketV2(snap ?? { ticker: leg.ticker, title: leg.title, yesMid: leg.kalshiMid }, ctx.homeAbbr, ctx.awayAbbr);
    if (!parsed) { fails.push(`gate2: leg not parseable (${leg.ticker})`); return null; }
    return { market: parsed, side: leg.side };
  });
  if (candidates.some((c) => c === null)) return fails;
  const legCandidates = candidates as CandidateLegV2[];

  if (
    slip.lambdas === undefined || slip.rho === undefined || slip.etWinProbHome === undefined ||
    slip.jointProb === undefined || slip.eloDiff === undefined ||
    slip.qFirstHalf === undefined || slip.floors === undefined
  ) {
    fails.push("gate9: slip missing stored model inputs (lambdas/rho/etWinProbHome/eloDiff/jointProb/qFirstHalf/floors)");
    return fails;
  }
  const lattice = halfLattice(scoreGrid(slip.lambdas.home, slip.lambdas.away, slip.rho), slip.qFirstHalf);
  const et = slip.etWinProbHome;
  const floors = slip.floors;

  // gate 9 (v2 form of gate 3): lattice reproduction ±1e-9
  legs.forEach((leg, i) => {
    const p = legProbV2(legCandidates[i], lattice, et);
    if (Math.abs(p - leg.modelProb) > TOL) fails.push(`gate9: leg modelProb drift (${leg.ticker}: stored ${leg.modelProb}, recomputed ${p})`);
  });
  const joint = jointProbV2(legCandidates, lattice, et);
  if (Math.abs(joint - slip.jointProb) > TOL) fails.push(`gate9: jointProb drift (stored ${slip.jointProb}, recomputed ${joint})`);

  // gate 4: the slip's OWN stored floors
  if (legs.length < 2 || legs.length > floors.maxLegs) fails.push(`gate4: leg count ${legs.length} outside [2, ${floors.maxLegs}]`);
  legs.forEach((leg, i) => {
    if (legProbV2(legCandidates[i], lattice, et) < floors.leg - TOL) fails.push(`gate4: leg below stored floor (${leg.ticker})`);
  });
  if (joint < floors.joint - TOL) fails.push(`gate4: joint ${joint} below stored floor ${floors.joint}`);
  let running = legCandidates.length > 0 ? legProbV2(legCandidates[0], lattice, et) : 0;
  for (let i = 1; i < legCandidates.length; i++) {
    const j = jointProbV2(legCandidates.slice(0, i + 1), lattice, et);
    const conditional = j / running;
    if (conditional > REDUNDANCY_CAP + TOL) fails.push(`gate4: conditional ${conditional.toFixed(6)} above REDUNDANCY_CAP (${legs[i].ticker})`);
    running = j;
  }

  // gate 5: grammar + byte reproduction (v2 generator)
  legs.forEach((leg, i) => {
    if (!REASONING_GRAMMAR.test(leg.reasoning)) { fails.push(`gate5: reasoning fails grammar (${leg.ticker})`); return; }
    const regenerated = legReasoningV2(legCandidates[i], lattice, et, {
      eloDiff: slip.eloDiff as number, homeAbbr: ctx.homeAbbr, awayAbbr: ctx.awayAbbr,
    });
    if (regenerated !== leg.reasoning) fails.push(`gate5: reasoning not reproducible (${leg.ticker})`);
  });

  // gate 10: combo-implied product re-derives from stored mids
  const expected = comboImplied(legs.map((l) => l.kalshiMid));
  const stored = slip.comboImpliedProb ?? null;
  const match = expected === null ? stored === null : stored !== null && Math.abs(stored - expected) <= TOL;
  if (!match) fails.push(`gate10: comboImpliedProb drift (stored ${stored}, recomputed ${expected})`);

  return fails;
}
```

(`SLIP_KEYS` and `RESULT_KEYS` need `export` removed? No — they are module-level consts already visible inside the file; just use them.)

In `main()`, dispatch per record:

```ts
const isV2 = (slip as SlipRecordV2).engineVersion === ENGINE_VERSION_V2;
const snapPath = path.join(SNAP_DIR, `${slip.slug}${isV2 ? "-v2" : ""}.json`);
// ...existing missing-snapshot handling...
const fails = isV2
  ? inspectSlipV2(slip as SlipRecordV2, snapshot, ctxAbbrs)
  : inspectSlip(slip, snapshot, ctxAbbrs);
console.log/`ok` line: append " (v2)" when isV2.
```

Also extend the v1 `SLIP_KEYS` usage carefully: v1 records must NOT accept the new keys — that is why `inspectSlip` stays untouched and dispatch happens outside it.

- [ ] **Step 4: Run tests + lint**

Run: `npx vitest run tests/parlay-inspector.test.ts && npx eslint scripts/parlay-inspector.mts`
Expected: PASS, 0 errors.

- [ ] **Step 5: Real-ledger smoke (still v1-only ledger)**

Run: `npm run parlay:inspect`
Expected: `ok` for all 4 existing v1 slips, `Parlay inspector passed.` — proves v1 path byte-stable.

- [ ] **Step 6: Commit**

```bash
git add scripts/parlay-inspector.mts tests/parlay-inspector.test.ts
git commit -m "feat(parlay-v2): version-aware inspector with combo-eligibility + lattice + combo-implied gates"
```

---

### Task 8: accountability report splits by engine version

**Files:**
- Modify: `scripts/build-accountability.mts` (the `ParlaySummary` type at ~line 128, `parlaySummary()` at ~line 143, `renderParlays()` at ~line 170, the console one-liner at ~line 307)

**Interfaces:**
- Consumes: ledger rows with optional `engineVersion`.
- Produces: `parlaySummary()` becomes `parlaySummaries(): Array<ParlaySummary & { version: string }>` (empty array when no ledger); `renderParlays` takes that array.

- [ ] **Step 1: Refactor summary to group by version**

In `parlaySummary()`: read rows once, then

```ts
const groups = new Map<string, ParlaySlipRow[]>();
for (const r of rows) {
  const v = (r as { engineVersion?: string }).engineVersion ?? "v1";
  groups.set(v, [...(groups.get(v) ?? []), r]);
}
return [...groups.entries()]
  .sort(([a], [b]) => a.localeCompare(b))
  .map(([version, group]) => ({ version, ...summarize(group) }));
```

where `summarize(group)` is the existing body operating on `group` instead of `rows`. `renderParlays` renders one `### Engine ${version}` sub-table per entry (same columns as today). Console line becomes one line per version: `` `  Parlays [${p.version}]: ${p.graded} graded, slip hit rate ...` ``.

- [ ] **Step 2: Verify by smoke run**

Run: `npm run report:accountability`
Expected: report renders one `### Engine v1` sub-table (4 locked / 0 graded), console prints the v1 line, exit 0.

- [ ] **Step 3: Full suite + lint, commit**

Run: `npx vitest run && npx eslint scripts/build-accountability.mts`
Expected: green.

```bash
git add scripts/build-accountability.mts
git commit -m "feat(parlay-v2): accountability parlay section split by engine version"
```

---

### Task 9: view model + slip card + /parlay page

**Files:**
- Modify: `lib/parlay-view.ts`, `components/parlay-slip-card.tsx`, `app/parlay/page.tsx`
- Test: `tests/parlay-view.test.ts`, `tests/parlay-slip-card.test.tsx`

**Interfaces:**
- Consumes: ledger rows (now versioned); existing `buildParlayViews`, `parlayRecord` semantics.
- Produces: `ParlaySlipRow` += `engineVersion?: string; comboImpliedProb?: number | null` · `ParlaySlipView` += `engineVersion: "v1" | "v2-combo"; comboImpliedProb: number | null` · card renders v1 badge text exactly `v1 engine — pre-combo, not purchasable as one ticket` and a combo line `Kalshi combo ≈X% · edge ±Y pts`.

- [ ] **Step 1: Write failing view-model tests**

Append to `tests/parlay-view.test.ts` (reuse that file's existing fixture helpers for rows/fixtures — extend, don't duplicate):

```ts
it("maps engineVersion and comboImpliedProb onto views (absent → v1 / null)", () => {
  const rows: ParlaySlipRow[] = [
    { slug: "france-vs-morocco", lockedAt: "2026-07-08T18:00:00.000Z", legs: [], jointProb: 0.7 },
    { slug: "france-vs-morocco", lockedAt: "2026-07-08T19:00:00.000Z", engineVersion: "v2-combo", comboImpliedProb: 0.41, legs: [], jointProb: 0.66 },
  ];
  const fixtures = [{ slug: "france-vs-morocco", homeId: "fra", awayId: "mar", kickoffISO: "2026-07-09T20:00:00.000Z", stage: "quarter-final" }];
  const views = buildParlayViews(rows, fixtures, (id) => id.toUpperCase());
  expect(views).toHaveLength(2);
  expect(views[0].engineVersion).toBe("v1");
  expect(views[0].comboImpliedProb).toBeNull();
  expect(views[1].engineVersion).toBe("v2-combo");
  expect(views[1].comboImpliedProb).toBe(0.41);
});
```

- [ ] **Step 2: Run to verify failure, then extend `lib/parlay-view.ts`**

Run: `npx vitest run tests/parlay-view.test.ts` → FAIL (property missing).

In `ParlaySlipRow` add `engineVersion?: string; comboImpliedProb?: number | null;`. In `ParlaySlipView` add `engineVersion: "v1" | "v2-combo"; comboImpliedProb: number | null;`. In `buildParlayViews` push:

```ts
engineVersion: row.engineVersion === "v2-combo" ? "v2-combo" : "v1",
comboImpliedProb: row.comboImpliedProb ?? null,
```

Run again → PASS.

- [ ] **Step 3: Write failing card tests**

Append to `tests/parlay-slip-card.test.tsx` (mirror the file's existing `renderToStaticMarkup` pattern and fixture slip, adding the two new fields):

```ts
it("badges v1 slips and shows the combo-implied line on v2 slips", () => {
  const v1Html = renderToStaticMarkup(<ParlaySlipCard slip={{ ...fixtureSlip, engineVersion: "v1", comboImpliedProb: null }} />);
  expect(v1Html).toContain("v1 engine — pre-combo, not purchasable as one ticket");
  expect(v1Html).not.toContain("Kalshi combo ≈");

  const v2Html = renderToStaticMarkup(
    <ParlaySlipCard slip={{ ...fixtureSlip, engineVersion: "v2-combo", comboImpliedProb: 0.415, jointProb: 0.66 }} />,
  );
  expect(v2Html).not.toContain("pre-combo");
  expect(v2Html).toContain("Kalshi combo ≈41.5%");
  expect(v2Html).toContain("edge +24.5 pts");
});
```

(If the file's fixture slip is named differently, use that name; the assertion strings are what matter.)

- [ ] **Step 4: Run to verify failure, then extend the card**

In `components/parlay-slip-card.tsx`, inside the non-no-slip branch after the joint-prob row, add:

```tsx
{slip.comboImpliedProb !== null && slip.jointProb !== undefined && (
  <p className="mt-1 text-caption tabular text-[var(--ink-muted)]">
    Kalshi combo ≈{pct(slip.comboImpliedProb)} · edge{" "}
    {slip.jointProb - slip.comboImpliedProb >= 0 ? "+" : ""}
    {((slip.jointProb - slip.comboImpliedProb) * 100).toFixed(1)} pts · display only
  </p>
)}
```

and in the header block (next to `StageChip`), the badge:

```tsx
{slip.engineVersion === "v1" && (
  <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
    v1 engine — pre-combo, not purchasable as one ticket
  </span>
)}
```

Run: `npx vitest run tests/parlay-slip-card.test.tsx` → PASS.

- [ ] **Step 5: Update `app/parlay/page.tsx`**

1. Card keys become version-aware: `key={`${slip.slug}-${slip.engineVersion}`}` in both Open and Record grids.
2. Record prose: split records per version —

```tsx
const rows = parlayLedger();
const recordV2 = parlayRecord(rows.filter((r) => r.engineVersion === "v2-combo"));
const recordV1 = parlayRecord(rows.filter((r) => r.engineVersion !== "v2-combo"));
```

Replace the single record paragraph with two (same sentence shape, prefixed `v2 combo engine:` and `v1 engine:`), keeping the existing `pct` helper. Rail `SignalLine` counts stay whole-ledger (`record` over all rows — keep computing `parlayRecord(rows)` for it).
3. Protocol paragraph — replace the copy with exactly:

```
One slip per match, locked pre-kickoff into an append-only ledger. v2 slips draw
only from markets Kalshi's combo builder can combine into one ticket — regulation
and first-half moneylines, spreads, totals, both-teams-to-score, and advancement —
priced on the model's score grid with a pre-registered first-half split (q = 0.45).
Selection maximizes exact joint probability under pre-registered v2 floors (every
leg ≥ 75%, joint ≥ 60%, 2–4 legs, redundancy cap 97%). Earlier v1 slips (leg ≥ 60%,
joint ≥ 35%, 2–5 legs) remain in the ledger and grade under their own floors.
Regulation legs grade on the 90-minute score, first-half legs on the half-time
score, advancement legs on the actual winner. Goalscorer and corner markets are
combo-eligible but unmodeled, so they are never selected. A dedicated inspector
recomputes every number from stored inputs on every run.
```

- [ ] **Step 6: Full suite + build + design gate, commit**

Run: `npx vitest run && npx eslint . && npm run build && npm run design:inspect`
Expected: all green, `/parlay` prerenders static (○).

```bash
git add lib/parlay-view.ts components/parlay-slip-card.tsx app/parlay/page.tsx tests/parlay-view.test.ts tests/parlay-slip-card.test.tsx
git commit -m "feat(parlay-v2): versioned slip cards, combo-implied display line, per-version record"
```

---

### Task 10: methodology page — v2 disclosures

**Files:**
- Modify: `app/methodology/page.tsx` (the `Parlay slips` Principle at lines 68-74)

- [ ] **Step 1: Replace the Parlay slips principle copy**

Replace the body of `<Principle title="Parlay slips">` (keep the JSX wrapper untouched, do NOT touch the grandfathered `&amp;` headings elsewhere in the file) with exactly:

```
Parlay legs come only from markets Kalshi's combo builder can combine into one
ticket; goalscorer and corner markets are listed there but unmodeled, so the
engine is structurally unable to select them. First-half legs are priced by a
pre-registered binomial goal split on the model score grid (q = 0.45 — a
tournament-wide constant, deliberately crude, refit only as a new dated
registration). v2 floors are pre-registered at leg ≥ 75%, joint ≥ 60%, 2–4 legs;
tight matches are expected to produce honest no-slip days. Legs grade on the
90-minute score, half-time score, or actual winner per market window. The
extra-time share behind advancement pricing stays the simulator's Elo logistic —
consistency over false precision. Kalshi mids never influence selection.
```

- [ ] **Step 2: Gates + commit**

Run: `npx vitest run && npx eslint . && npm run build && npm run design:inspect`
Expected: green.

```bash
git add app/methodology/page.tsx
git commit -m "docs(methodology): combo-eligible universe, q=0.45 half split, v2 floor registration"
```

---

### Task 11: live relock of all 4 QFs + full gates + PR

**DEADLINE: complete before 2026-07-09 20:00Z (FRA-MAR kickoff).**

**Files:**
- Data: `data/parlays.json` (+4 v2 records), `data/markets/parlay-snapshots/{france-vs-morocco,spain-vs-belgium,norway-vs-england,argentina-vs-switzerland}-v2.json`

- [ ] **Step 1: Run the v2 lock against live Kalshi books**

Run: `npm run parlay:lock`
Expected: `[lock-parlays] locked 4 new (total 8)` — four v2 records (slips or no-slips; ESP-BEL and ARG-SUI may honestly no-slip under v2 floors). If Kalshi is down for a slug: it logs and skips — re-run later, before kickoff.

- [ ] **Step 2: Verify idempotence + inspector on the real ledger**

Run: `npm run parlay:lock` (again) → `locked 0 new`.
Run: `npm run parlay:inspect` → `ok` × 8 (v2 lines tagged), `Parlay inspector passed.`

- [ ] **Step 3: Sanity-read the France slip**

Read the new `france-vs-morocco` v2 record in `data/parlays.json`. Check: every leg's series is one of the 9; no NO-side on KXWCGAME/KXWC1H; joint ≥ 0.60; every `modelProb` ≥ 0.75; `comboImpliedProb` < `jointProb` is plausible-not-required (mid product vs model — either direction possible; what matters is it equals the mid product). Report anything odd to the user before the PR — do not "fix" numbers by hand, ever.

- [ ] **Step 4: Refresh the accountability report**

Run: `npm run report:accountability`
Expected: Parlays section shows `### Engine v1` (4 locked) and `### Engine v2-combo` (new records).

- [ ] **Step 5: Full gate suite**

Run: `npx vitest run && npx eslint . && npm run build && npm run design:inspect && npm run inspect:execution && npm run model:inspect && npm run parlay:inspect`
Expected: everything green.

- [ ] **Step 6: Commit data, push, open PR**

```bash
git add data/parlays.json data/markets/parlay-snapshots/
git commit -m "feat(parlay-v2): relock all 4 QF slips as combo-purchasable v2"
git push -u origin feat/parlay-v2-combo
gh pr create --title "Parlay optimizer v2 — combo-eligible slips" --body "$(cat <<'EOF'
## Summary
- Restricts parlay legs to Kalshi combo-eligible series so every slip is purchasable as one combo ticket (spec: docs/superpowers/specs/2026-07-08-parlay-optimizer-v2-combo-design.md)
- Binomial first-half layer on the DC grid (Q_FIRST_HALF = 0.45, pre-registered), exact 4-dim joint
- Hit-first v2 floors (leg ≥ 0.75, joint ≥ 0.60, 2–4 legs), versioned ledger, all 4 QFs relocked as v2
- Version-aware settle (half-time grading window) + inspector (combo-eligibility, lattice reproduction, combo-implied gates)
- /parlay + methodology updated: v1 badge, display-only Kalshi-combo line, q and floor disclosures

## Test plan
- [ ] vitest suite (v2 engine: lattice identities, brute-force joint, selection floors, grammar byte-reproduction)
- [ ] parlay:lock idempotent per version; v1 records byte-untouched
- [ ] parlay:inspect green on the mixed 8-record ledger
- [ ] build + design/execution/model inspectors green

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

If PR #49 (`feat/parlay-page`) has merged by now, rebase onto main first: `git fetch origin && git rebase origin/main` and re-run the Step 5 gates.

- [ ] **Step 7: Post-merge ops note (hand to the settle cadence, not code)**

When each QF settles: append the result row to `data/knockout-results.json` under a `quarterFinals` key **including `ht: { home, away }`** (ESPN scoreboard linescores period 1; OneFootball cross-check), then `npm run pipeline:settle` → `npm run parlay:settle` (grades v1 + v2; v2 slips with 1H legs stay pending until `ht` is present) → `npm run parlay:inspect` → `npm run report:accountability`.

---

## Self-Review (completed at write time)

- **Spec coverage:** §2 registry → T1; §3 lattice/q/ADVANCE → T2; §4 floors/selection → T3; reasoning + §5 comboImpliedProb → T4; §5 ledger/versioning/relock → T5+T11; §6 HT grading → T6+T11.7; §7 gates → T7; accountability (spec v1 §6 carry-over) → T8; §8 page → T9; §9 methodology → T10; §10 error handling → T5 (skip-and-retry), T6 (pending), T7 (dispatch); §12 rollout/deadline → T11. No gaps found.
- **Placeholder scan:** no TBDs; every code step shows code; test code concrete. Two intentional read-the-file-first steps (card fixture name, accountability `summarize` extraction) state exactly what to preserve.
- **Type consistency:** `CandidateLegV2`/`LatticeCell`/`V2Floors`/`SelectionV2` names match across T1-T7; `gradeLegV2` ctx shape identical in T6 test and implementation; `snapshotFileV2`/`haveV2Slugs` used in both T5 and T7 main-loop dispatch (`-v2` suffix consistent).
