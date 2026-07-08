# Parlay Optimizer Plan A (Engine + Pipeline + Inspector) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Model-optimized Kalshi parlay slips per WC26 match — grid-exact joint probability, confidence-tiered hit-max selection, locked immutable ledger, grading, and a parlay-inspector gate.

**Architecture:** Pure engine `lib/parlay.ts` (market parsing → grid predicates → exact joint → greedy selection → templated reasoning); `scripts/lock-parlays.mts` fetches 7 Kalshi series, snapshots them, locks slips into `data/parlays.json`; `scripts/settle-parlays.mts` grades post-FT via `lib/knockout-grading` semantics; `scripts/parlay-inspector.mts` recomputes everything and gates.

**Tech Stack:** TypeScript, tsx scripts, vitest, Kalshi trade-api v2 (public GET, no key), existing `lib/poisson-model` (`scoreGrid`, `lambdasFromElo`, `summarizeGrid`, `topKScorelines`, `advancementProb`, `GRID_SIZE`).

## Global Constraints (verbatim from spec)

- Pre-registered: `LEG_FLOOR = 0.60`, `JOINT_FLOOR = 0.35`, `REDUNDANCY_CAP = 0.97`, `MAX_LEGS = 5`, min 2 legs.
- Legs STRICTLY from Kalshi-listed markets with a grid predicate; player props/corners/mentions structurally impossible (unparseable ⇒ excluded ⇒ inspector-enforced).
- Joint probability computed EXACTLY on the score grid; ADVANCE uses `advancementProb` convention: `etWinProbHome = 1/(1+10^(−eloDiff/800))` applied to draw cells only.
- Reasoning = fixed grammar over recomputable quantities ONLY. No freeform text.
- Slips lock pre-kickoff only; locked fields byte-immutable; idempotent re-run "0 new"; no-slip days recorded.
- Determinism: same inputs ⇒ byte-identical slip; ties broken by ticker lexicographic order.
- Kalshi mids are display/benchmark only — NEVER a selection input.
- Never run `npm run matchday`/`ml:fetch`/`ml:cycle`. Work in the `app-parlay/` worktree on branch `feat/parlay-optimizer`.
- Gates before claiming done: `npx vitest run`, `npx eslint .`, `npm run build`, `npm run design:inspect`, `npm run inspect:execution`, `npm run model:inspect` (+ `npm run parlay:inspect` once it exists).
- Conventional commits; no Co-Authored-By trailer.

---

### Task 1: Market parsing → grid predicates

**Files:**
- Create: `lib/parlay.ts`
- Test: `tests/parlay.test.ts`

**Interfaces:**
- Consumes: nothing (pure).
- Produces:
  ```ts
  export type KalshiMarket = { ticker: string; title: string; yesMid: number | null };
  export type GridPredicate = (h: number, a: number) => boolean;
  export type ParsedMarket =
    | { kind: "reg"; ticker: string; title: string; yesMid: number | null; pred: GridPredicate }
    | { kind: "advance"; ticker: string; title: string; yesMid: number | null; advanceSide: "home" | "away" };
  export function parseMarket(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarket | null;
  ```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/parlay.test.ts
import { describe, expect, it } from "vitest";
import { parseMarket, type KalshiMarket } from "../lib/parlay";

const mk = (ticker: string, title = "t"): KalshiMarket => ({ ticker, title, yesMid: 0.5 });
const P = (t: string) => parseMarket(mk(t), "FRA", "MAR");

describe("parseMarket", () => {
  it("GAME: home / away / tie", () => {
    const h = P("KXWCGAME-26JUL09FRAMAR-FRA");
    const a = P("KXWCGAME-26JUL09FRAMAR-MAR");
    const t = P("KXWCGAME-26JUL09FRAMAR-TIE");
    expect(h!.kind).toBe("reg");
    if (h!.kind === "reg") { expect(h!.pred(2, 1)).toBe(true); expect(h!.pred(1, 1)).toBe(false); }
    if (a!.kind === "reg") { expect(a!.pred(0, 1)).toBe(true); expect(a!.pred(1, 0)).toBe(false); }
    if (t!.kind === "reg") { expect(t!.pred(2, 2)).toBe(true); expect(t!.pred(2, 1)).toBe(false); }
  });

  it("SPREAD: team wins by >= digit", () => {
    const s = P("KXWCSPREAD-26JUL09FRAMAR-FRA2");
    if (s!.kind === "reg") {
      expect(s!.pred(2, 0)).toBe(true);
      expect(s!.pred(3, 2)).toBe(false);
      expect(s!.pred(0, 3)).toBe(false);
    }
    const m = P("KXWCSPREAD-26JUL09FRAMAR-MAR2");
    if (m!.kind === "reg") expect(m!.pred(0, 2)).toBe(true);
  });

  it("TOTAL: combined goals >= digit", () => {
    const t = P("KXWCTOTAL-26JUL09FRAMAR-3");
    if (t!.kind === "reg") { expect(t!.pred(2, 1)).toBe(true); expect(t!.pred(2, 0)).toBe(false); }
  });

  it("TEAMTOTAL: team goals >= digit", () => {
    const f = P("KXWCTEAMTOTAL-26JUL09FRAMAR-FRA2");
    if (f!.kind === "reg") { expect(f!.pred(2, 5)).toBe(true); expect(f!.pred(1, 5)).toBe(false); }
    const m = P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR1");
    if (m!.kind === "reg") expect(m!.pred(0, 1)).toBe(true);
  });

  it("BTTS", () => {
    const b = P("KXWCBTTS-26JUL09FRAMAR-BTTS");
    if (b!.kind === "reg") { expect(b!.pred(1, 1)).toBe(true); expect(b!.pred(2, 0)).toBe(false); }
  });

  it("SCORE: exact cell, oriented by abbr", () => {
    const s = P("KXWCSCORE-26JUL09FRAMAR-FRA3MAR0");
    if (s!.kind === "reg") { expect(s!.pred(3, 0)).toBe(true); expect(s!.pred(0, 3)).toBe(false); }
    const r = P("KXWCSCORE-26JUL09FRAMAR-MAR2FRA1"); // away listed first
    if (r!.kind === "reg") { expect(r!.pred(1, 2)).toBe(true); expect(r!.pred(2, 1)).toBe(false); }
    const d = P("KXWCSCORE-26JUL09FRAMAR-TIE1");
    if (d!.kind === "reg") { expect(d!.pred(1, 1)).toBe(true); expect(d!.pred(0, 0)).toBe(false); }
  });

  it("ADVANCE: kind advance with side", () => {
    const h = P("KXWCADVANCE-26JUL09FRAMAR-FRA");
    expect(h).toEqual(expect.objectContaining({ kind: "advance", advanceSide: "home" }));
    const a = P("KXWCADVANCE-26JUL09FRAMAR-MAR");
    expect(a).toEqual(expect.objectContaining({ kind: "advance", advanceSide: "away" }));
  });

  it("returns null for unpriceable series (player props, corners, unknown)", () => {
    expect(P("KXWCGOALSCORER-26JUL09FRAMAR-MBAPPE1")).toBeNull();
    expect(P("KXWCCORNERS-26JUL09FRAMAR-10")).toBeNull();
    expect(P("KXWCSCORE-26JUL09FRAMAR-WEIRDFORMAT")).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/parlay.test.ts` → FAIL (module missing).

- [ ] **Step 3: Implement**

```ts
// lib/parlay.ts
//
// Parlay engine: Kalshi markets → grid predicates → exact joint probability →
// confidence-tiered hit-max selection → templated reasoning. Pure, no I/O.
// Pre-registered: LEG_FLOOR=0.60, JOINT_FLOOR=0.35, REDUNDANCY_CAP=0.97,
// MAX_LEGS=5, min 2 legs; ties broken by ticker; Kalshi mids display-only.

export type KalshiMarket = { ticker: string; title: string; yesMid: number | null };
export type GridPredicate = (h: number, a: number) => boolean;
export type ParsedMarket =
  | { kind: "reg"; ticker: string; title: string; yesMid: number | null; pred: GridPredicate }
  | { kind: "advance"; ticker: string; title: string; yesMid: number | null; advanceSide: "home" | "away" };

/** Suffix after the event code, e.g. "FRA2", "TIE", "3", "FRA3MAR0", "BTTS". */
const suffixOf = (ticker: string): string => ticker.split("-").pop() ?? "";
const seriesOf = (ticker: string): string => ticker.split("-")[0] ?? "";

export function parseMarket(m: KalshiMarket, homeAbbr: string, awayAbbr: string): ParsedMarket | null {
  const s = suffixOf(m.ticker);
  const base = { ticker: m.ticker, title: m.title, yesMid: m.yesMid };
  switch (seriesOf(m.ticker)) {
    case "KXWCGAME": {
      if (s === homeAbbr) return { ...base, kind: "reg", pred: (h, a) => h > a };
      if (s === awayAbbr) return { ...base, kind: "reg", pred: (h, a) => a > h };
      if (s === "TIE") return { ...base, kind: "reg", pred: (h, a) => h === a };
      return null;
    }
    case "KXWCSPREAD": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const margin = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", pred: (h, a) => h - a >= margin };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", pred: (h, a) => a - h >= margin };
      return null;
    }
    case "KXWCTOTAL": {
      if (!/^\d$/.test(s)) return null;
      const n = Number(s);
      return { ...base, kind: "reg", pred: (h, a) => h + a >= n };
    }
    case "KXWCTEAMTOTAL": {
      const mm = s.match(/^([A-Z]+)(\d)$/);
      if (!mm) return null;
      const n = Number(mm[2]);
      if (mm[1] === homeAbbr) return { ...base, kind: "reg", pred: (h) => h >= n };
      if (mm[1] === awayAbbr) return { ...base, kind: "reg", pred: (_h, a) => a >= n };
      return null;
    }
    case "KXWCBTTS":
      return s === "BTTS" ? { ...base, kind: "reg", pred: (h, a) => h > 0 && a > 0 } : null;
    case "KXWCSCORE": {
      const tie = s.match(/^TIE(\d)$/);
      if (tie) {
        const n = Number(tie[1]);
        return { ...base, kind: "reg", pred: (h, a) => h === n && a === n };
      }
      const mm = s.match(/^([A-Z]+)(\d)([A-Z]+)(\d)$/);
      if (!mm) return null;
      const [, t1, g1, t2, g2] = mm;
      const hg = t1 === homeAbbr ? Number(g1) : t2 === homeAbbr ? Number(g2) : null;
      const ag = t1 === awayAbbr ? Number(g1) : t2 === awayAbbr ? Number(g2) : null;
      if (hg === null || ag === null) return null;
      return { ...base, kind: "reg", pred: (h, a) => h === hg && a === ag };
    }
    case "KXWCADVANCE": {
      if (s === homeAbbr) return { ...base, kind: "advance", advanceSide: "home" };
      if (s === awayAbbr) return { ...base, kind: "advance", advanceSide: "away" };
      return null;
    }
    default:
      return null; // player props, corners, mentions, unknown: unpriceable
  }
}
```

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/parlay.test.ts` → 8 passed.
- [ ] **Step 5: Full suite once** — `npx vitest run` → green.
- [ ] **Step 6: Commit**

```bash
git add lib/parlay.ts tests/parlay.test.ts
git commit -m "feat(parlay): Kalshi market parser with grid predicates (7 series, unpriceable=null)"
```

---

### Task 2: Exact joint probability (reg + ADVANCE branch)

**Files:**
- Modify: `lib/parlay.ts` (append)
- Test: `tests/parlay.test.ts` (append)

**Interfaces:**
- Consumes: `ParsedMarket`; `GRID_SIZE` from `./poisson-model`.
- Produces:
  ```ts
  export type CandidateLeg = { market: ParsedMarket; side: "yes" | "no" };
  export function legProb(leg: CandidateLeg, grid: number[][], etWinProbHome: number): number;
  export function jointProb(legs: CandidateLeg[], grid: number[][], etWinProbHome: number): number;
  ```
  Semantics: `grid[h][a]` = P(90' score h-a). Reg leg passes a cell per its predicate (NO side = negation). Advance legs: win cells resolve by sign; draw cells contribute `etWinProbHome` (home advances) or `1 − etWinProbHome`; contradictory advance demands ⇒ 0 for that cell. `jointProb([])` = 1.

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { jointProb, legProb, type CandidateLeg } from "../lib/parlay";
import { scoreGrid } from "../lib/poisson-model";

const grid = scoreGrid(1.4, 0.9, -0.05);
const yes = (m: ReturnType<typeof parseMarket>): CandidateLeg => ({ market: m!, side: "yes" });
const no = (m: ReturnType<typeof parseMarket>): CandidateLeg => ({ market: m!, side: "no" });
const ET = 0.62;

const bruteJoint = (legs: CandidateLeg[]): number => {
  let p = 0;
  for (let h = 0; h < grid.length; h++)
    for (let a = 0; a < grid.length; a++) {
      let cell = grid[h][a];
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          const pass = leg.market.pred(h, a) === (leg.side === "yes");
          if (!pass) { cell = 0; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (h > a) { if (!wantsHome) { cell = 0; break; } }
          else if (h < a) { if (wantsHome) { cell = 0; break; } }
          else {
            const f = wantsHome ? ET : 1 - ET;
            if (advFactor === null) advFactor = f;
            else if (advFactor !== f) { cell = 0; break; } // contradictory demands
          }
        }
      }
      p += cell * (advFactor ?? 1);
    }
  return p;
};

describe("jointProb", () => {
  const home = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
  const o15 = yes(P("KXWCTOTAL-26JUL09FRAMAR-2"));
  const noMar1 = no(P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR1"));
  const adv = yes(P("KXWCADVANCE-26JUL09FRAMAR-FRA"));

  it("empty slip has probability 1", () => {
    expect(jointProb([], grid, ET)).toBeCloseTo(1, 6);
  });

  it("single reg leg equals legProb equals brute force", () => {
    expect(jointProb([home], grid, ET)).toBeCloseTo(bruteJoint([home]), 12);
    expect(legProb(home, grid, ET)).toBeCloseTo(bruteJoint([home]), 12);
  });

  it("correlated legs: joint != product of marginals, == brute force", () => {
    const legs = [home, o15, noMar1];
    const j = jointProb(legs, grid, ET);
    expect(j).toBeCloseTo(bruteJoint(legs), 12);
    const naive = legs.reduce((p, l) => p * legProb(l, grid, ET), 1);
    expect(Math.abs(j - naive)).toBeGreaterThan(0.01);
  });

  it("advance leg mixes win cells + ET share of draw cells", () => {
    expect(jointProb([adv], grid, ET)).toBeCloseTo(bruteJoint([adv]), 12);
    expect(jointProb([adv, home], grid, ET)).toBeCloseTo(bruteJoint([adv, home]), 12);
  });

  it("contradictory advance demands give 0 on draw branch", () => {
    const advAwayNo = no(P("KXWCADVANCE-26JUL09FRAMAR-MAR")); // == home advances
    const advHomeNo = no(P("KXWCADVANCE-26JUL09FRAMAR-FRA")); // == away advances
    expect(jointProb([advAwayNo, advHomeNo], grid, ET)).toBeCloseTo(bruteJoint([advAwayNo, advHomeNo]), 12);
  });
});
```

- [ ] **Step 2: Run to verify fail**, then **Step 3: Implement (append)** — the implementation IS the brute-force semantics, written once:

```ts
export type CandidateLeg = { market: ParsedMarket; side: "yes" | "no" };

/** Exact probability over the 90' score grid. Advance legs resolve win/loss
 *  cells by sign and draw cells by the shared ET Bernoulli (etWinProbHome) —
 *  a slip's advance demands must agree on the draw branch or that branch is 0. */
export function jointProb(legs: CandidateLeg[], grid: number[][], etWinProbHome: number): number {
  let p = 0;
  for (let h = 0; h < grid.length; h++) {
    for (let a = 0; a < grid.length; a++) {
      const mass = grid[h][a];
      if (mass === 0) continue;
      let pass = true;
      let advFactor: number | null = null;
      for (const leg of legs) {
        if (leg.market.kind === "reg") {
          if (leg.market.pred(h, a) !== (leg.side === "yes")) { pass = false; break; }
        } else {
          const wantsHome = (leg.market.advanceSide === "home") === (leg.side === "yes");
          if (h > a && !wantsHome) { pass = false; break; }
          if (h < a && wantsHome) { pass = false; break; }
          if (h === a) {
            const f = wantsHome ? etWinProbHome : 1 - etWinProbHome;
            if (advFactor === null) advFactor = f;
            else if (advFactor !== f) { pass = false; break; }
          }
        }
      }
      if (pass) p += mass * (advFactor ?? 1);
    }
  }
  return p;
}

export function legProb(leg: CandidateLeg, grid: number[][], etWinProbHome: number): number {
  return jointProb([leg], grid, etWinProbHome);
}
```

- [ ] **Step 4: Run to verify pass** (13 total). **Step 5: Full suite once** → green. **Step 6: Commit**

```bash
git add lib/parlay.ts tests/parlay.test.ts
git commit -m "feat(parlay): grid-exact joint probability with ADVANCE ET-branch fold"
```

---

### Task 3: Slip selection (confidence-tiered hit-max)

**Files:**
- Modify: `lib/parlay.ts` (append)
- Test: `tests/parlay.test.ts` (append)

**Interfaces:**
- Consumes: `CandidateLeg`, `jointProb`, `legProb`.
- Produces:
  ```ts
  export const LEG_FLOOR = 0.6;
  export const JOINT_FLOOR = 0.35;
  export const REDUNDANCY_CAP = 0.97;
  export const MAX_LEGS = 5;
  export type Selection =
    | { verdict: "slip"; legs: CandidateLeg[]; jointProb: number }
    | { verdict: "no-slip"; reason: string };
  export function selectSlip(candidates: CandidateLeg[], grid: number[][], etWinProbHome: number): Selection;
  ```
  Algorithm (pre-registered, deterministic): filter to `legProb ≥ LEG_FLOOR`; sort by (prob desc, ticker asc, side asc); seed = first; repeatedly add the candidate with highest conditional `P(L|slip) = joint(slip∪L)/joint(slip)` among those with conditional ≤ REDUNDANCY_CAP and resulting joint ≥ JOINT_FLOOR (ties: ticker asc, side asc); stop at MAX_LEGS or no qualifying candidate; if final slip has < 2 legs → `no-slip` with reason `"no 2-leg combo ≥ floors"`.

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { JOINT_FLOOR, LEG_FLOOR, MAX_LEGS, REDUNDANCY_CAP, selectSlip } from "../lib/parlay";

describe("selectSlip", () => {
  const home = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
  const adv = yes(P("KXWCADVANCE-26JUL09FRAMAR-FRA"));
  const o05 = yes(P("KXWCTOTAL-26JUL09FRAMAR-1"));
  const noMar2 = no(P("KXWCTEAMTOTAL-26JUL09FRAMAR-MAR2"));
  const noSpread = no(P("KXWCSPREAD-26JUL09FRAMAR-MAR2"));

  it("emits a deterministic multi-leg slip meeting every floor", () => {
    const sel = selectSlip([home, adv, o05, noMar2, noSpread], grid, ET);
    expect(sel.verdict).toBe("slip");
    if (sel.verdict === "slip") {
      expect(sel.legs.length).toBeGreaterThanOrEqual(2);
      expect(sel.legs.length).toBeLessThanOrEqual(MAX_LEGS);
      expect(sel.jointProb).toBeGreaterThanOrEqual(JOINT_FLOOR);
      for (const l of sel.legs) expect(legProb(l, grid, ET)).toBeGreaterThanOrEqual(LEG_FLOOR);
      // determinism: same inputs, same output
      expect(selectSlip([home, adv, o05, noMar2, noSpread], grid, ET)).toEqual(sel);
    }
  });

  it("rejects redundant legs (conditional above cap)", () => {
    // "FRA advances" is near-implied by "FRA wins reg time" — conditional ≈ 1.
    const sel = selectSlip([home, adv], grid, ET);
    if (sel.verdict === "slip") {
      const conditional = jointProb(sel.legs, grid, ET) / jointProb([sel.legs[0]], grid, ET);
      expect(conditional).toBeLessThanOrEqual(REDUNDANCY_CAP + 1e-9);
    }
  });

  it("returns no-slip when fewer than 2 candidates clear the leg floor", () => {
    const longshot = yes(P("KXWCSCORE-26JUL09FRAMAR-FRA3MAR0"));
    const sel = selectSlip([longshot], grid, ET);
    expect(sel).toEqual({ verdict: "no-slip", reason: "no 2-leg combo ≥ floors" });
  });
});
```

- [ ] **Step 2: verify fail**, **Step 3: Implement (append)**

```ts
export const LEG_FLOOR = 0.6;
export const JOINT_FLOOR = 0.35;
export const REDUNDANCY_CAP = 0.97;
export const MAX_LEGS = 5;

export type Selection =
  | { verdict: "slip"; legs: CandidateLeg[]; jointProb: number }
  | { verdict: "no-slip"; reason: string };

const legOrder = (a: { leg: CandidateLeg; p: number }, b: { leg: CandidateLeg; p: number }): number =>
  b.p - a.p ||
  a.leg.market.ticker.localeCompare(b.leg.market.ticker) ||
  a.leg.side.localeCompare(b.leg.side);

/** Confidence-tiered hit-max (pre-registered): greedy on conditional
 *  probability, capped for redundancy, floored on leg + joint. Deterministic. */
export function selectSlip(candidates: CandidateLeg[], grid: number[][], etWinProbHome: number): Selection {
  const eligible = candidates
    .map((leg) => ({ leg, p: legProb(leg, grid, etWinProbHome) }))
    .filter((c) => c.p >= LEG_FLOOR)
    .sort(legOrder);
  if (eligible.length < 2) return { verdict: "no-slip", reason: "no 2-leg combo ≥ floors" };

  const slip: CandidateLeg[] = [eligible[0].leg];
  let joint = eligible[0].p;
  let pool = eligible.slice(1);

  while (slip.length < MAX_LEGS && pool.length > 0) {
    const scored = pool
      .map((c) => {
        const j = jointProb([...slip, c.leg], grid, etWinProbHome);
        return { ...c, j, conditional: j / joint };
      })
      .filter((c) => c.conditional <= REDUNDANCY_CAP && c.j >= JOINT_FLOOR)
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

  if (slip.length < 2) return { verdict: "no-slip", reason: "no 2-leg combo ≥ floors" };
  return { verdict: "slip", legs: slip, jointProb: joint };
}
```

- [ ] **Step 4: verify pass** (16 total). **Step 5: full suite.** **Step 6: Commit**

```bash
git add lib/parlay.ts tests/parlay.test.ts
git commit -m "feat(parlay): confidence-tiered hit-max slip selection (floors, redundancy cap, no-slip path)"
```

---

### Task 4: Templated reasoning

**Files:**
- Modify: `lib/parlay.ts` (append)
- Test: `tests/parlay.test.ts` (append)

**Interfaces:**
- Consumes: `CandidateLeg`, `legProb`; `topKScorelines` NOT used (leg-specific cells computed inline).
- Produces:
  ```ts
  export function legReasoning(
    leg: CandidateLeg,
    grid: number[][],
    etWinProbHome: number,
    ctx: { eloDiff: number; homeAbbr: string; awayAbbr: string },
  ): string;
  export const REASONING_GRAMMAR: RegExp;
  ```
  Grammar (fixed, all digits recomputable):
  `"<title> — <YES|NO>: model <P>%; top scorelines <A x-y> <m1>% / <A x-y> <m2>% / <A x-y> <m3>%; Elo <±D>; Kalshi <K>% (edge <±E>) | Kalshi n/a."`
  where the top-3 scorelines are the highest-mass grid cells SATISFYING the leg (for advance legs: satisfying the win branch or the draw branch), percentages rounded to 1 dp, Elo diff to nearest integer with sign, edge = model − kalshi in points with sign.

- [ ] **Step 1: Write the failing tests (append)**

```ts
import { legReasoning, REASONING_GRAMMAR } from "../lib/parlay";

describe("legReasoning", () => {
  const ctx = { eloDiff: 181, homeAbbr: "FRA", awayAbbr: "MAR" };

  it("emits grammar-conforming string with recomputable numbers", () => {
    const leg = yes(P("KXWCGAME-26JUL09FRAMAR-FRA"));
    const r = legReasoning(leg, grid, ET, ctx);
    expect(r).toMatch(REASONING_GRAMMAR);
    expect(r).toContain(`model ${(legProb(leg, grid, ET) * 100).toFixed(1)}%`);
    expect(r).toContain("Elo +181");
  });

  it("handles null kalshiMid as 'Kalshi n/a'", () => {
    const m = parseMarket({ ticker: "KXWCBTTS-26JUL09FRAMAR-BTTS", title: "Both teams score?", yesMid: null }, "FRA", "MAR");
    const r = legReasoning({ market: m!, side: "no" }, grid, ET, ctx);
    expect(r).toMatch(REASONING_GRAMMAR);
    expect(r).toContain("Kalshi n/a");
  });
});
```

- [ ] **Step 2: verify fail**, **Step 3: Implement (append)**

```ts
const pct1 = (x: number): string => `${(x * 100).toFixed(1)}%`;
const signed = (x: number): string => `${x >= 0 ? "+" : ""}${x}`;

export const REASONING_GRAMMAR =
  /^.+ — (YES|NO): model \d{1,3}\.\d%; top scorelines [A-Z]+ \d-\d \d{1,3}\.\d% \/ [A-Z]+ \d-\d \d{1,3}\.\d% \/ [A-Z]+ \d-\d \d{1,3}\.\d%; Elo [+-]\d+; (Kalshi \d{1,3}\.\d% \(edge [+-]\d{1,3}\.\d\)|Kalshi n\/a)\.$/;

/** Fixed-grammar reasoning: every number recomputable from (grid, etWinProbHome,
 *  eloDiff, yesMid). No freeform text — the parlay inspector re-derives all of it. */
export function legReasoning(
  leg: CandidateLeg,
  grid: number[][],
  etWinProbHome: number,
  ctx: { eloDiff: number; homeAbbr: string; awayAbbr: string },
): string {
  const p = legProb(leg, grid, etWinProbHome);
  const cells: Array<{ h: number; a: number; mass: number }> = [];
  for (let h = 0; h < grid.length; h++)
    for (let a = 0; a < grid.length; a++)
      if (jointProb([leg], [[...Array(grid.length)].map(() => 0)].map((_, i) => grid[i].map((m, j) => (i === h && j === a ? m : 0))) as unknown as number[][], etWinProbHome) > 0)
        cells.push({ h, a, mass: grid[h][a] });
  cells.sort((x, y) => y.mass - x.mass || x.h - y.h || x.a - y.a);
  const top = cells
    .slice(0, 3)
    .map((c) => `${c.h >= c.a ? ctx.homeAbbr : ctx.awayAbbr} ${Math.max(c.h, c.a)}-${Math.min(c.h, c.a)} ${pct1(c.mass)}`)
    .join(" / ");
  const mid = leg.market.yesMid;
  const sideMid = mid === null ? null : leg.side === "yes" ? mid : 1 - mid;
  const kalshi =
    sideMid === null
      ? "Kalshi n/a"
      : `Kalshi ${pct1(sideMid)} (edge ${signed(Number(((p - sideMid) * 100).toFixed(1)))})`;
  return `${leg.market.title} — ${leg.side.toUpperCase()}: model ${pct1(p)}; top scorelines ${top}; Elo ${signed(Math.round(ctx.eloDiff))}; ${kalshi}.`;
}
```

**Implementation note (simplify the cell filter):** the nested `jointProb` call above is the plan's intent expressed clumsily — the implementer should instead compute cell pass/fail directly: for reg legs `leg.market.pred(h,a) === (side==="yes")`; for advance legs include win-branch cells and draw cells whose ET direction matches. Write it as a small local helper `cellSatisfies(leg, h, a): boolean` (draw cells count as satisfying when the ET factor for the leg is > 0). The tests only constrain grammar + recomputability, and the inspector recomputes with the same helper.

- [ ] **Step 4: verify pass** (18 total). **Step 5: full suite.** **Step 6: Commit**

```bash
git add lib/parlay.ts tests/parlay.test.ts
git commit -m "feat(parlay): fixed-grammar templated leg reasoning (recomputable numbers only)"
```

---

### Task 5: Lock pipeline — `scripts/lock-parlays.mts`

**Files:**
- Create: `scripts/lock-parlays.mts`
- Modify: `package.json` (add `"parlay:lock": "tsx scripts/lock-parlays.mts"`, `"parlay:settle": "tsx scripts/settle-parlays.mts"`, `"parlay:inspect": "tsx scripts/parlay-inspector.mts"` — all three now so later tasks don't touch package.json again)
- Modify: `scripts/shared.mts` (add `kalshiEventCode`)
- Test: `tests/lock-parlays.test.ts` (pure helpers only)

**Interfaces:**
- Consumes: engine (Tasks 1-4); `advancementProb`, `lambdasFromElo`, `scoreGrid`, `summarizeGrid` from `../lib/poisson-model`; `fixtures`, `teams`, `appDir` from `./shared.mts`; `data/model.json` (`params`, `ratings` keyed by team display name).
- Produces:
  - `data/parlays.json`: array of slips `{ slug, lockedAt, modelDataThrough, eloDiff, lambdas: { home, away }, rho, etWinProbHome, legs: [{ ticker, side, title, modelProb, kalshiMid, reasoning }], jointProb }` or `{ slug, lockedAt, verdict: "no-slip", reason }`.
  - `data/markets/parlay-snapshots/<slug>.json`: `{ fetchedAt, markets: [{ ticker, title, yesMid }] }` for ALL candidate markets.
  - In `scripts/shared.mts`: `export function kalshiEventCode(f: FixtureRow): string` — the `26JUL09FRAMAR` part, refactored out of `kalshiEventTicker` (which becomes `` `KXWCGAME-${kalshiEventCode(f)}` ``).
  - In `scripts/lock-parlays.mts`: `export const PARLAY_SERIES = ["KXWCGAME","KXWCADVANCE","KXWCSPREAD","KXWCTOTAL","KXWCTEAMTOTAL","KXWCBTTS","KXWCSCORE"] as const;` and `export function marketMid(m: { yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }): number | null` (bid/ask mid when both > 0, else last price, else null — the lock-predictions idiom with null instead of 0).

- [ ] **Step 1: Failing tests for the pure helpers**

```ts
// tests/lock-parlays.test.ts
import { describe, expect, it } from "vitest";
import { marketMid, PARLAY_SERIES } from "../scripts/lock-parlays.mts";
import { kalshiEventCode, kalshiEventTicker } from "../scripts/shared.mts";

describe("marketMid", () => {
  it("uses bid/ask mid when both present", () => {
    expect(marketMid({ yes_bid_dollars: "0.71", yes_ask_dollars: "0.72" })).toBeCloseTo(0.715, 10);
  });
  it("falls back to last price, then null", () => {
    expect(marketMid({ last_price_dollars: "0.55" })).toBeCloseTo(0.55, 10);
    expect(marketMid({})).toBeNull();
  });
});

describe("kalshiEventCode", () => {
  const f = { homeId: "fra", awayId: "mar", kickoffISO: "2026-07-09T20:00:00Z", tzOffsetMinutes: -240 } as never;
  it("builds venue-local date code and ticker stays backwards-compatible", () => {
    expect(kalshiEventCode(f)).toBe("26JUL09FRAMAR");
    expect(kalshiEventTicker(f)).toBe("KXWCGAME-26JUL09FRAMAR");
  });
});

describe("PARLAY_SERIES", () => {
  it("is exactly the 7 priceable series", () => {
    expect(PARLAY_SERIES).toEqual(["KXWCGAME","KXWCADVANCE","KXWCSPREAD","KXWCTOTAL","KXWCTEAMTOTAL","KXWCBTTS","KXWCSCORE"]);
  });
});
```

- [ ] **Step 2: verify fail**, **Step 3: Implement**

3a. `scripts/shared.mts` — refactor:

```ts
/** Event code for a fixture, e.g. "26JUL09FRAMAR" (venue-local date). */
export function kalshiEventCode(f: FixtureRow): string {
  const local = new Date(
    new Date(f.kickoffISO).getTime() + (f.tzOffsetMinutes ?? 0) * 60 * 1000,
  );
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const yy = String(local.getUTCFullYear()).slice(2);
  const mon = months[local.getUTCMonth()];
  const dd = String(local.getUTCDate()).padStart(2, "0");
  return `${yy}${mon}${dd}${f.homeId.toUpperCase()}${f.awayId.toUpperCase()}`;
}

/** Kalshi event ticker for a fixture: KXWCGAME-<code>. */
export function kalshiEventTicker(f: FixtureRow): string {
  return `KXWCGAME-${kalshiEventCode(f)}`;
}
```

3b. `scripts/lock-parlays.mts`:

```ts
// Locks one model-optimized parlay slip per upcoming fixture into
// data/parlays.json (immutable, append-only) + full market snapshot per slug.
// Selection is pure model (hit-max); Kalshi mids are display/benchmark only.
// Refuses past kickoffs. Idempotent: existing slugs never rewritten.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, fixtures, teams, kalshiEventCode, type FixtureRow } from "./shared.mts";
import { lambdasFromElo, scoreGrid, advancementProb, summarizeGrid, type ModelParams } from "../lib/poisson-model";
import { legReasoning, parseMarket, selectSlip, legProb, type CandidateLeg, type KalshiMarket } from "../lib/parlay";

const API = "https://api.elections.kalshi.com/trade-api/v2";
export const PARLAY_SERIES = ["KXWCGAME","KXWCADVANCE","KXWCSPREAD","KXWCTOTAL","KXWCTEAMTOTAL","KXWCBTTS","KXWCSCORE"] as const;

export function marketMid(m: { yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }): number | null {
  const bid = Number(m.yes_bid_dollars ?? "0");
  const ask = Number(m.yes_ask_dollars ?? "0");
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  const last = Number(m.last_price_dollars ?? "0");
  return last > 0 ? last : null;
}

async function fetchSeries(series: string, code: string): Promise<KalshiMarket[]> {
  try {
    const res = await fetch(`${API}/markets?event_ticker=${series}-${code}&limit=100`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const { markets } = (await res.json()) as {
      markets?: Array<{ ticker: string; title?: string; yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }>;
    };
    return (markets ?? []).map((m) => ({ ticker: m.ticker, title: m.title ?? m.ticker, yesMid: marketMid(m) }));
  } catch {
    return [];
  }
}

const PARLAYS_PATH = path.join(appDir, "data", "parlays.json");
const SNAP_DIR = path.join(appDir, "data", "markets", "parlay-snapshots");

async function main(): Promise<void> {
  const model = JSON.parse(readFileSync(path.join(appDir, "data", "model.json"), "utf8")) as {
    params: ModelParams;
    dataThrough: string;
    ratings: Record<string, number>;
  };
  const nameOf = new Map(teams().map((t) => [t.id, t.name]));
  const existing: Array<{ slug: string }> = existsSync(PARLAYS_PATH)
    ? JSON.parse(readFileSync(PARLAYS_PATH, "utf8"))
    : [];
  const have = new Set(existing.map((e) => e.slug));
  const now = Date.now();
  const upcoming = fixtures().filter(
    (f) => !have.has(f.slug) && new Date(f.kickoffISO).getTime() > now && f.stage !== "group",
  );

  const out: unknown[] = [...existing];
  let added = 0;
  for (const f of upcoming) {
    const code = kalshiEventCode(f);
    const all: KalshiMarket[] = [];
    for (const s of PARLAY_SERIES) all.push(...(await fetchSeries(s, code)));
    if (all.length === 0) {
      console.error(`[lock-parlays] ${f.slug}: Kalshi returned no markets — skipping (retry later)`);
      continue;
    }
    mkdirSync(SNAP_DIR, { recursive: true });
    writeFileSync(
      path.join(SNAP_DIR, `${f.slug}.json`),
      `${JSON.stringify({ fetchedAt: new Date().toISOString(), markets: all }, null, 1)}\n`,
    );

    const eloH = model.ratings[nameOf.get(f.homeId) ?? ""] ?? 1500;
    const eloA = model.ratings[nameOf.get(f.awayId) ?? ""] ?? 1500;
    const lambdas = lambdasFromElo(eloH, eloA, f.neutral, model.params);
    const grid = scoreGrid(lambdas.home, lambdas.away, model.params.rho);
    const eloDiff = eloH - eloA;
    const s = summarizeGrid(grid);
    const etWinProbHome = (advancementProb(s.home, s.draw, eloDiff) - s.home) / s.draw;

    const homeAbbr = f.homeId.toUpperCase();
    const awayAbbr = f.awayId.toUpperCase();
    const candidates: CandidateLeg[] = [];
    for (const m of all) {
      const parsed = parseMarket(m, homeAbbr, awayAbbr);
      if (!parsed) continue;
      candidates.push({ market: parsed, side: "yes" }, { market: parsed, side: "no" });
    }

    const sel = selectSlip(candidates, grid, etWinProbHome);
    const lockedAt = new Date().toISOString();
    if (sel.verdict === "no-slip") {
      out.push({ slug: f.slug, lockedAt, verdict: "no-slip", reason: sel.reason });
      console.log(`[lock-parlays] ${f.slug}: no-slip (${sel.reason})`);
    } else {
      const ctx = { eloDiff, homeAbbr, awayAbbr };
      out.push({
        slug: f.slug,
        lockedAt,
        modelDataThrough: model.dataThrough,
        eloDiff,
        lambdas,
        rho: model.params.rho,
        etWinProbHome,
        legs: sel.legs.map((leg) => ({
          ticker: leg.market.ticker,
          side: leg.side,
          title: leg.market.title,
          modelProb: legProb(leg, grid, etWinProbHome),
          kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
          reasoning: legReasoning(leg, grid, etWinProbHome, ctx),
        })),
        jointProb: sel.jointProb,
      });
      console.log(`[lock-parlays] ${f.slug}: ${sel.legs.length}-leg slip, joint ${(sel.jointProb * 100).toFixed(1)}%`);
    }
    added += 1;
  }
  writeFileSync(PARLAYS_PATH, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`[lock-parlays] locked ${added} new (total ${out.length})`);
}

if (process.argv[1] && process.argv[1].endsWith("lock-parlays.mts")) {
  main().catch((e) => {
    console.error("[lock-parlays] fatal:", e);
    process.exitCode = 1;
  });
}
```

**Implementation note:** `etWinProbHome` derived via `advancementProb` algebra keeps one convention (`(adv − pWin)/pDraw` recovers the tiebreak logistic exactly); guard `s.draw > 0` (it always is on real grids; if 0, set `etWinProbHome = 0.5` and log).

- [ ] **Step 4: verify helper tests pass; full suite green.**
- [ ] **Step 5: Manual smoke** — `npm run parlay:lock` (QF fixtures upcoming): expect per-slug lines, `data/parlays.json` + snapshots written; re-run → `locked 0 new`. Inspect one slip by eye for sanity.
- [ ] **Step 6: Commit**

```bash
git add scripts/lock-parlays.mts scripts/shared.mts package.json tests/lock-parlays.test.ts data/parlays.json data/markets/parlay-snapshots
git commit -m "feat(parlay): lock pipeline — 7-series snapshot + immutable slip ledger"
```

---

### Task 6: Grading — `scripts/settle-parlays.mts`

**Files:**
- Create: `scripts/settle-parlays.mts`
- Test: `tests/settle-parlays.test.ts`

**Interfaces:**
- Consumes: `data/parlays.json`, `data/fixtures.json` (homeScore/awayScore), `data/knockout-results.json` (`after`, `homeScore90/awayScore90`, `winnerId`), `applyKnockoutScores90` + `KnockoutResultRow` from `../lib/knockout-grading`, `parseMarket` from `../lib/parlay`.
- Produces: `result` appended to each gradable slip: `{ legs: [{ ticker, hit }], slipHit, gradedAt }`; and exported pure `export function gradeLeg(leg: { ticker: string; side: "yes" | "no" }, ctx: { h90: number; a90: number; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string }): boolean | null` (null = ungradable, e.g. ADVANCE with unknown winner).

Grading semantics: reg legs evaluate their predicate on the **90' score** (pens/ET matches grade reg-time legs off the level 90' score — identical to prediction grading); ADVANCE legs from `winnerId`. `slipHit` = every leg hit. Slips for unsettled fixtures skipped. Locked fields never mutated (append `result` only). Idempotent: slips with `result` skipped.

- [ ] **Step 1: Failing tests**

```ts
// tests/settle-parlays.test.ts
import { describe, expect, it } from "vitest";
import { gradeLeg } from "../scripts/settle-parlays.mts";

const ctx90 = { h90: 0, a90: 0, advancedHome: true, homeAbbr: "SUI", awayAbbr: "COL" };

describe("gradeLeg", () => {
  it("grades reg-time legs on the 90' score (pens match: draw)", () => {
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-TIE", side: "yes" }, ctx90)).toBe(true);
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-COL", side: "yes" }, ctx90)).toBe(false);
    expect(gradeLeg({ ticker: "KXWCTOTAL-26JUL07SUICOL-1", side: "no" }, ctx90)).toBe(true); // under 0.5
  });

  it("grades ADVANCE from the advancement outcome, not the 90' score", () => {
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-SUI", side: "yes" }, ctx90)).toBe(true);
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-COL", side: "yes" }, ctx90)).toBe(false);
    expect(gradeLeg({ ticker: "KXWCADVANCE-26JUL07SUICOL-SUI", side: "yes" }, { ...ctx90, advancedHome: null })).toBeNull();
  });

  it("NO side is the negation", () => {
    expect(gradeLeg({ ticker: "KXWCGAME-26JUL07SUICOL-TIE", side: "no" }, ctx90)).toBe(false);
  });
});
```

- [ ] **Step 2: verify fail**, **Step 3: Implement**

```ts
// scripts/settle-parlays.mts
// Grades locked parlay slips post-FT. Reg-time legs grade on the 90' score
// (same knockout semantics as prediction grading); ADVANCE legs on winnerId.
// Appends `result` only — locked fields are immutable. Idempotent.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, fixtures, teams } from "./shared.mts";
import { parseMarket } from "../lib/parlay";

export function gradeLeg(
  leg: { ticker: string; side: "yes" | "no" },
  ctx: { h90: number; a90: number; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string },
): boolean | null {
  const parsed = parseMarket({ ticker: leg.ticker, title: "", yesMid: null }, ctx.homeAbbr, ctx.awayAbbr);
  if (!parsed) return null;
  if (parsed.kind === "advance") {
    if (ctx.advancedHome === null) return null;
    const yesOutcome = parsed.advanceSide === "home" ? ctx.advancedHome : !ctx.advancedHome;
    return leg.side === "yes" ? yesOutcome : !yesOutcome;
  }
  const yesOutcome = parsed.pred(ctx.h90, ctx.a90);
  return leg.side === "yes" ? yesOutcome : !yesOutcome;
}

const PARLAYS_PATH = path.join(appDir, "data", "parlays.json");

function main(): void {
  if (!existsSync(PARLAYS_PATH)) {
    console.log("no parlays.json yet — nothing to grade");
    return;
  }
  const slips = JSON.parse(readFileSync(PARLAYS_PATH, "utf8")) as Array<Record<string, unknown>>;
  const fx = new Map(fixtures().map((f) => [f.slug, f]));
  const ko = JSON.parse(readFileSync(path.join(appDir, "data", "knockout-results.json"), "utf8")) as {
    roundOf16: Array<{ homeId: string; awayId: string; homeScore: number; awayScore: number; homeScore90?: number; awayScore90?: number; winnerId: string; after: string }>;
    [k: string]: unknown;
  };
  const koRows = Object.values(ko).flatMap((v) => (Array.isArray(v) ? v : []));
  let graded = 0;
  for (const slip of slips) {
    if (slip.result || slip.verdict === "no-slip") continue;
    const f = fx.get(slip.slug as string);
    if (!f || f.homeScore === undefined || f.awayScore === undefined) continue;
    const row = koRows.find((r) => r.homeId === f.homeId && r.awayId === f.awayId);
    const h90 = row && row.after !== "90" ? (row.homeScore90 as number) : (f.homeScore as number);
    const a90 = row && row.after !== "90" ? (row.awayScore90 as number) : (f.awayScore as number);
    const advancedHome = row ? row.winnerId === f.homeId : null;
    const ctx = { h90, a90, advancedHome, homeAbbr: f.homeId.toUpperCase(), awayAbbr: f.awayId.toUpperCase() };
    const legs = (slip.legs as Array<{ ticker: string; side: "yes" | "no" }>).map((l) => ({
      ticker: l.ticker,
      hit: gradeLeg(l, ctx),
    }));
    if (legs.some((l) => l.hit === null)) {
      console.error(`[settle-parlays] ${slip.slug}: ungradable leg — skipped`);
      continue;
    }
    slip.result = { legs, slipHit: legs.every((l) => l.hit === true), gradedAt: new Date().toISOString() };
    graded += 1;
    console.log(`[settle-parlays] ${slip.slug}: ${legs.filter((l) => l.hit).length}/${legs.length} legs, slip ${slip.result && (slip.result as { slipHit: boolean }).slipHit ? "HIT" : "MISS"}`);
  }
  writeFileSync(PARLAYS_PATH, `${JSON.stringify(slips, null, 1)}\n`);
  console.log(`[settle-parlays] graded ${graded} new`);
}

if (process.argv[1] && process.argv[1].endsWith("settle-parlays.mts")) main();
```

(`teams` import only if needed for names — drop if unused. Note fixtures homeScore/awayScore for knockouts hold the FULL-match score; the `after !== "90"` branch pulls the 90' scores from knockout-results — same source prediction grading uses.)

- [ ] **Step 4: verify pass; full suite.** **Step 5: Commit**

```bash
git add scripts/settle-parlays.mts tests/settle-parlays.test.ts
git commit -m "feat(parlay): grading — 90-minute semantics for reg legs, winnerId for advance"
```

---

### Task 7: Inspector — `scripts/parlay-inspector.mts`

**Files:**
- Create: `scripts/parlay-inspector.mts`
- Test: `tests/parlay-inspector.test.ts`

**Interfaces:**
- Consumes: `data/parlays.json`, `data/markets/parlay-snapshots/*.json`, engine exports, `data/model.json`.
- Produces: `npm run parlay:inspect` exits 0 with "Parlay inspector passed." or exits 1 listing failures. Exported pure check: `export function inspectSlip(slip: SlipRecord, snapshot: { markets: KalshiMarket[] }): string[]` (empty = clean; else failure strings). `SlipRecord` = the ledger entry type from Task 5.

Checks per spec §7 (each failure string prefixed by gate number):
1. every leg ticker ∈ snapshot tickers
2. every leg parseable (`parseMarket` non-null)
3. recomputed `modelProb` per leg and `jointProb` (from stored `lambdas`, `rho`, `etWinProbHome`) match stored ±1e-9
4. floors: every leg ≥ LEG_FLOOR, joint ≥ JOINT_FLOOR, 2 ≤ legs ≤ MAX_LEGS, non-seed conditionals ≤ REDUNDANCY_CAP (recompute greedily in stored leg order)
5. every reasoning matches `REASONING_GRAMMAR` AND recomputing `legReasoning` with stored inputs reproduces the string byte-for-byte
6. immutability handled by re-running lock (idempotence) — inspector checks that no slip has `lockedAt` in the future and that `result`, when present, only adds the grading keys
7. no-slip records have `reason` string

- [ ] **Step 1: Failing tests** — fixture a valid slip via the engine itself (build markets, run selectSlip, assemble record), then break one field per gate:

```ts
// tests/parlay-inspector.test.ts
import { describe, expect, it } from "vitest";
import { inspectSlip } from "../scripts/parlay-inspector.mts";
import { scoreGrid } from "../lib/poisson-model";
import { legProb, legReasoning, parseMarket, selectSlip, type CandidateLeg, type KalshiMarket } from "../lib/parlay";

const markets: KalshiMarket[] = [
  { ticker: "KXWCGAME-26JUL09FRAMAR-FRA", title: "France vs Morocco Winner?", yesMid: 0.62 },
  { ticker: "KXWCTOTAL-26JUL09FRAMAR-1", title: "Will over 0.5 goals be scored?", yesMid: 0.9 },
  { ticker: "KXWCTEAMTOTAL-26JUL09FRAMAR-MAR2", title: "Will Morocco score over 1.5 goals?", yesMid: 0.2 },
];
const lambdas = { home: 1.4, away: 0.9 };
const rho = -0.05;
const et = 0.62;
const grid = scoreGrid(lambdas.home, lambdas.away, rho);

function buildSlip() {
  const candidates: CandidateLeg[] = markets.flatMap((m) => {
    const p = parseMarket(m, "FRA", "MAR");
    return p ? [{ market: p, side: "yes" as const }, { market: p, side: "no" as const }] : [];
  });
  const sel = selectSlip(candidates, grid, et);
  if (sel.verdict !== "slip") throw new Error("fixture must produce slip");
  const ctx = { eloDiff: 181, homeAbbr: "FRA", awayAbbr: "MAR" };
  return {
    slug: "france-vs-morocco",
    lockedAt: "2026-07-08T12:00:00Z",
    modelDataThrough: "2026-07-07",
    eloDiff: 181,
    lambdas, rho, etWinProbHome: et,
    legs: sel.legs.map((leg) => ({
      ticker: leg.market.ticker, side: leg.side, title: leg.market.title,
      modelProb: legProb(leg, grid, et),
      kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
      reasoning: legReasoning(leg, grid, et, ctx),
    })),
    jointProb: sel.jointProb,
  };
}

describe("inspectSlip", () => {
  it("clean slip passes all gates", () => {
    expect(inspectSlip(buildSlip() as never, { markets })).toEqual([]);
  });
  it("gate 1: leg ticker missing from snapshot", () => {
    const s = buildSlip(); s.legs[0].ticker = "KXWCGAME-26JUL09FRAMAR-XXX";
    expect(inspectSlip(s as never, { markets }).some((f) => f.startsWith("gate1"))).toBe(true);
  });
  it("gate 3: tampered jointProb detected", () => {
    const s = buildSlip(); s.jointProb += 0.05;
    expect(inspectSlip(s as never, { markets }).some((f) => f.startsWith("gate3"))).toBe(true);
  });
  it("gate 5: tampered reasoning detected", () => {
    const s = buildSlip(); s.legs[0].reasoning = "France will definitely dominate this game.";
    expect(inspectSlip(s as never, { markets }).some((f) => f.startsWith("gate5"))).toBe(true);
  });
});
```

- [ ] **Step 2: verify fail**, **Step 3: Implement** — `inspectSlip` recomputes grid from stored `lambdas`/`rho`, re-parses legs, recomputes leg/joint probs, greedy conditionals in stored order, regenerates reasoning strings (needs `homeAbbr`/`awayAbbr` from slug's fixture at CLI level; `inspectSlip` takes them via slip's leg tickers — parse abbrs out of the first leg's event code: the two abbrs are recoverable from fixture lookup in `main()`; `inspectSlip` signature gains `ctx: { homeAbbr: string; awayAbbr: string }` — adjust tests accordingly, implementer note). `main()` loads all slips + snapshots, runs `inspectSlip`, prints per-slug results, exits 1 on any failure, else prints "Parlay inspector passed."

- [ ] **Step 4: verify pass; full suite; run `npm run parlay:inspect` against the real ledger from Task 5 — must pass.**
- [ ] **Step 5: Commit**

```bash
git add scripts/parlay-inspector.mts tests/parlay-inspector.test.ts
git commit -m "feat(parlay): parlay-inspector — snapshot, recompute, floors, grammar, immutability gates"
```

---

### Task 8: Accountability section + full gates

**Files:**
- Modify: `scripts/build-accountability.mts` (slips summary)
- Test: extend `tests/parlay.test.ts` only if a pure helper is extracted; otherwise manual verify via report output

- [ ] **Step 1:** In `build-accountability.mts`, after the existing summary assembly, load `data/parlays.json` (if present) and add to the JSON + markdown report: `parlays: { slips, noSlips, graded, slipHits, slipHitRate, legHits, legs, legHitRate, meanLockedJoint, realizedSlipHitRate }`. Console prints one line: `Parlays: X graded, slip hit rate Y%, leg hit rate Z%, locked joint avg W% vs realized Y%`. Guard: absent/empty file → section omitted, no throw.
- [ ] **Step 2:** `npm run report:accountability` — verify section renders (or is cleanly absent).
- [ ] **Step 3:** Full gates: `npx vitest run && npx eslint . && npm run build && npm run design:inspect && npm run inspect:execution && npm run model:inspect && npm run parlay:inspect` → all green.
- [ ] **Step 4: Commit**

```bash
git add scripts/build-accountability.mts
git commit -m "feat(parlay): accountability report gains slip/leg hit rates + joint calibration"
```

---

### Task 9: Push + PR (Plan A complete)

- [ ] `git push -u origin feat/parlay-optimizer`
- [ ] `gh pr create` — title `feat(parlay): model-optimized Kalshi parlay slips — engine, locked ledger, grading, inspector`; body: summary (grid-exact joint, hit-max selection, pre-registered floors, inspector gates), first live slips (which QFs/SFs got locked), test plan checklist (suite count, eslint, build, all four inspectors). End with the Claude Code attribution line.
- [ ] Plan B (`/parlay` page) is a separate plan+PR after this merges.
