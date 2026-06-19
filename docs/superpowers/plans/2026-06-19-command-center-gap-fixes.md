# Command Center Gap Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Close the four in-scope deltas between the live `/command` route and the WC26 Forecast Command Center directive — fix the undefined `--warn` token, load a monospace face for data, enlarge + make the Score Probability Surface interactive, and add a Reliability Timeline.

**Architecture:** Surgical, additive changes to the existing `/command` route. Pure logic (scoreline parsing, reliability tick building) lands in `lib/command-data.ts` with vitest unit tests; CSS/visual changes verify via build + lint + a Playwright screenshot. No existing component is rebuilt.

**Tech Stack:** Next.js 16.2.6 (App Router), React 19, Tailwind v4 (`@theme inline` + `@utility`), `next/font/google`, framer-motion (installed, optional), vitest.

## Global Constraints

- **Next.js 16.2.6 has breaking changes.** Per `app/AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing layout/font code. Do not assume training-data Next.js.
- **No regressions.** All changes additive or surgical. Existing `/command` behavior preserved.
- **Real data only.** Tooltip/timeline values come from the actual `Prediction` type (`lambdas`, `elo`, `grid`) and `data/predictions.json` ledger. Never fabricate numbers.
- **Keep house style.** `--up: #7cffb2`, `--down: #ff674d`, and the body gradient atmosphere stay. Only `--warn`/`--warn-2` are added to the palette.
- **Monospace scope:** `data-mono` applies to high-signal numeric displays only (surface cell %s + scoreline chips, 3-way split %s, System Health metrics, championship %s, lock countdown, Reliability Timeline tooltip). Never on labels or prose.
- **Run from `app/`.** All commands and paths are relative to `/Users/sanjaym/Desktop/KALSHI/README/app`.

---

## File Structure

- `app/globals.css` — add `--warn`/`--warn-2`, `--font-mono`, `data-mono` utility, `settle-flash` keyframe
- `app/layout.tsx` — load JetBrains Mono via `next/font/google`
- `lib/command-data.ts` — add `parseSettledScoreline()` and `buildReliabilityTicks()` pure helpers
- `tests/command-data.test.ts` — add tests for the two new helpers
- `components/command/score-probability-surface.tsx` — enlarge, hover tooltip, click readout, settlement flash
- `components/command/match-detail.tsx` — pass `lambdas`/`elo`/`settledScoreline`; apply `data-mono`
- `components/command/command-shell.tsx` — mount Reliability Timeline; `data-mono` on System Health metrics
- `components/command/championship-projection.tsx` — `data-mono` on percentages
- `components/command/reliability-timeline.tsx` — **new**
- `app/command/page.tsx` — compute settled grids, build reliability ticks

---

### Task 1: Define the `--warn` token (bug fix)

`var(--warn)` is referenced in 26 places across command components but never defined, so every amber state renders as broken inherited color. Defining the token fixes all of them with zero component edits.

**Files:**
- Modify: `app/globals.css`

**Interfaces:**
- Produces: CSS custom properties `--warn`, `--warn-2`, and Tailwind theme colors `--color-warn`, `--color-warn-2`.

- [ ] **Step 1: Verify the bug exists**

Run: `grep -rn "var(--warn)" components/ app/ | wc -l` and `grep -c -- "--warn:" app/globals.css`
Expected: first prints `26` (or more), second prints `0` — confirming usages with no definition.

- [ ] **Step 2: Add the tokens to `@theme inline`**

In `app/globals.css`, inside the `@theme inline { … }` block, after the line `--color-down: var(--down);` add:

```css
  --color-warn: var(--warn);
  --color-warn-2: var(--warn-2);
```

- [ ] **Step 3: Add the tokens to `:root`**

In `app/globals.css`, inside `:root { … }`, after the line `--down: #ff674d;` add:

```css
  --warn: #fbbf24;
  --warn-2: #fb923c;
```

- [ ] **Step 4: Add the tokens to `.dark`**

In `app/globals.css`, inside `.dark { … }`, after the line `--down: #ff674d;` add:

```css
  --warn: #fbbf24;
  --warn-2: #fb923c;
```

- [ ] **Step 5: Verify it resolves and build passes**

Run: `grep -c -- "--warn:" app/globals.css` → Expected: `2`
Run: `npm run lint` → Expected: no new errors
Run: `npm run build` → Expected: build succeeds

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "fix(command): define missing --warn/--warn-2 tokens for amber states"
```

---

### Task 2: Load JetBrains Mono + `data-mono` utility

**Files:**
- Modify: `app/layout.tsx`
- Modify: `app/globals.css`
- Modify: `components/command/command-shell.tsx`
- Modify: `components/command/championship-projection.tsx`

**Interfaces:**
- Produces: CSS var `--font-mono`, utility class `data-mono` (monospace + tabular figures). Consumed by Tasks 5 and 7.

- [ ] **Step 1: Read the Next 16 font guide**

Run: `ls node_modules/next/dist/docs/ 2>/dev/null && grep -rl "next/font" node_modules/next/dist/docs/ 2>/dev/null | head`
Read any matching font guide before editing `layout.tsx`. Confirm `next/font/google` import + `variable` usage is unchanged from the existing `Inter` setup.

- [ ] **Step 2: Add the JetBrains Mono import in `app/layout.tsx`**

Change the import line:

```tsx
import { Inter, JetBrains_Mono } from "next/font/google";
```

After the `const inter = Inter({ … });` block add:

```tsx
const jetbrainsMono = JetBrains_Mono({
  variable: "--font-jetbrains-mono",
  subsets: ["latin"],
  display: "swap",
});
```

- [ ] **Step 3: Apply the font variable to `<html>`**

Change the `className` on `<html>` from:

```tsx
      className={`${inter.variable} h-full antialiased`}
```

to:

```tsx
      className={`${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}
```

- [ ] **Step 4: Map `--font-mono` and add the `data-mono` utility in `app/globals.css`**

In the `@theme inline { … }` block, after the `--font-sans:` line add:

```css
  --font-mono: var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, "SF Mono", monospace;
```

After the existing `@utility tabular { … }` block add:

```css
@utility data-mono {
  font-family: var(--font-mono);
  font-variant-numeric: tabular-nums;
  font-feature-settings: "tnum";
}
```

- [ ] **Step 5: Apply `data-mono` to System Health metric values**

In `components/command/command-shell.tsx`, the System Health metric value span currently reads:

```tsx
                <span className={`text-slight font-semibold tabular-nums ${metricColor(key, systemHealth.status)}`}>{val}</span>
```

Change `tabular-nums` to `data-mono`:

```tsx
                <span className={`text-slight font-semibold data-mono ${metricColor(key, systemHealth.status)}`}>{val}</span>
```

Also in the status rail, the ECE value span:

```tsx
          <span className={`font-semibold tabular-nums ${textCls}`}>{(systemHealth.ece * 100).toFixed(1)}%</span>
```

→ change `tabular-nums` to `data-mono`.

- [ ] **Step 6: Apply `data-mono` to championship percentages**

In `components/command/championship-projection.tsx`, add the `data-mono` class to the span(s) that render the projection percentage value (the numeric `%` text). Leave team-name and label spans untouched.

- [ ] **Step 7: Verify build + lint + visual**

Run: `npm run lint` → Expected: clean
Run: `npm run build` → Expected: succeeds
(Visual confirmation of mono numerals happens in the Task 8 screenshot.)

- [ ] **Step 8: Commit**

```bash
git add app/layout.tsx app/globals.css components/command/command-shell.tsx components/command/championship-projection.tsx
git commit -m "feat(command): load JetBrains Mono and apply data-mono to high-signal numerics"
```

---

### Task 3: `parseSettledScoreline()` helper (TDD)

Parses a `"H-A"` result string into a 6-bucket display cell, clamping goals ≥6 into the `5+` bucket. Matches `compressGrid`'s `Math.min(r, DISPLAY-1)` folding so the flashed cell aligns with rendered buckets.

**Files:**
- Modify: `lib/command-data.ts`
- Test: `tests/command-data.test.ts`

**Interfaces:**
- Produces: `parseSettledScoreline(result: string | undefined): { home: number; away: number } | undefined`. Consumed by Task 4 (`match-detail`).

- [ ] **Step 1: Write the failing test**

Add to `tests/command-data.test.ts` (import `parseSettledScoreline` from `../lib/command-data` alongside existing imports):

```ts
import { describe, it, expect } from "vitest";
import { parseSettledScoreline } from "../lib/command-data";

describe("parseSettledScoreline", () => {
  it("parses a normal scoreline to row/col", () => {
    expect(parseSettledScoreline("4-1")).toEqual({ home: 4, away: 1 });
  });
  it("clamps home goals >= 6 into the 5+ bucket", () => {
    expect(parseSettledScoreline("6-2")).toEqual({ home: 5, away: 2 });
  });
  it("clamps away goals >= 6 into the 5+ bucket", () => {
    expect(parseSettledScoreline("2-7")).toEqual({ home: 2, away: 5 });
  });
  it("returns undefined for missing input", () => {
    expect(parseSettledScoreline(undefined)).toBeUndefined();
  });
  it("returns undefined for malformed input", () => {
    expect(parseSettledScoreline("abc")).toBeUndefined();
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/command-data.test.ts -t parseSettledScoreline`
Expected: FAIL — `parseSettledScoreline is not a function` / not exported.

- [ ] **Step 3: Implement the helper**

Add to `lib/command-data.ts`:

```ts
// ─── Settled Scoreline → display cell ─────────────────────────────────────────
const DISPLAY_MAX = 5; // index 5 == the "5+" overflow bucket

export function parseSettledScoreline(
  result: string | undefined
): { home: number; away: number } | undefined {
  if (!result) return undefined;
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(result.trim());
  if (!m) return undefined;
  return {
    home: Math.min(parseInt(m[1], 10), DISPLAY_MAX),
    away: Math.min(parseInt(m[2], 10), DISPLAY_MAX),
  };
}
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/command-data.test.ts -t parseSettledScoreline`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/command-data.ts tests/command-data.test.ts
git commit -m "feat(command): add parseSettledScoreline with 5+ clamp"
```

---

### Task 4: Wire settled grids + `settledScoreline` into the surface

Lets settled fixtures render their Score Probability Surface (currently skipped) and supplies the realized scoreline for the settlement flash.

**Files:**
- Modify: `app/command/page.tsx`
- Modify: `components/command/match-detail.tsx`

**Interfaces:**
- Consumes: `parseSettledScoreline` (Task 3).
- Produces: `MatchDetail` now passes `lambdas`, `elo`, `settledScoreline` to `ScoreProbabilitySurface` (Task 5 consumes these).

- [ ] **Step 1: Compute predictions for settled fixtures in `page.tsx`**

In `app/command/page.tsx`, the loop at section "3. Compute predictions for operational locks" begins:

```tsx
  for (const cf of commandFixtures) {
    if (!cf.isOperational) continue;
    const fixture = fixtureBySlug(cf.slug);
```

Remove the `if (!cf.isOperational) continue;` line so predictions are computed for settled fixtures too. The `operationalPredictions` array now holds every fixture with a predictable grid (name kept for prop compatibility).

- [ ] **Step 2: Pass `lambdas`, `elo`, `settledScoreline` from `match-detail.tsx`**

In `components/command/match-detail.tsx`, add the import near the top:

```tsx
import { parseSettledScoreline } from "@/lib/command-data";
```

Replace the Score Probability Surface block:

```tsx
      {/* Score Probability Surface */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ScoreProbabilitySurface
          grid={prediction.grid}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          lockExpiresISO={fixture.isOperational ? fixture.kickoffISO : undefined}
        />
      </div>
```

with:

```tsx
      {/* Score Probability Surface */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ScoreProbabilitySurface
          grid={prediction.grid}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          lambdas={prediction.lambdas}
          elo={prediction.elo}
          settledScoreline={!fixture.isOperational ? parseSettledScoreline(fixture.result) : undefined}
          lockExpiresISO={fixture.isOperational ? fixture.kickoffISO : undefined}
        />
      </div>
```

(`prediction.lambdas` and `prediction.elo` exist on the `Prediction` type — verified in `lib/predict.ts`.)

- [ ] **Step 3: Verify build (surface props compile after Task 5)**

NOTE: `npm run build` will fail here because `ScoreProbabilitySurface` does not yet accept the new props. That is expected — Task 5 adds them. If executing strictly task-by-task, run only:
Run: `npm run lint` → Expected: may flag the unknown props; that is resolved by Task 5. Do not commit until Task 5 compiles.

- [ ] **Step 4: Defer commit**

Commit Task 4 and Task 5 together at the end of Task 5 (they form one compilable unit). Proceed to Task 5.

---

### Task 5: Enlarge + interactive Score Probability Surface

The centerpiece. Enlarge cells, add hover tooltip (real `lambdas`/`elo`), click-to-readout, and settlement flash.

**Files:**
- Modify: `components/command/score-probability-surface.tsx`
- Modify: `app/globals.css` (add `settle-flash` keyframe)

**Interfaces:**
- Consumes: `grid`, `homeTeam`, `awayTeam`, `lambdas: { home: number; away: number }`, `elo: { home: number; away: number }`, `settledScoreline?: { home: number; away: number }`, `lockExpiresISO?` (from Task 4).

- [ ] **Step 1: Add the settlement-flash keyframe in `app/globals.css`**

After the existing `@keyframes rise { … }` block add:

```css
@keyframes settle-flash {
  0%   { box-shadow: inset 0 0 0 1px rgba(244,244,239,0.9), 0 0 0 0 rgba(244,244,239,0.0); }
  35%  { box-shadow: inset 0 0 0 1px rgba(244,244,239,0.9), 0 0 18px 2px rgba(244,244,239,0.35); }
  100% { box-shadow: inset 0 0 0 1px rgba(244,244,239,0.9), 0 0 0 0 rgba(244,244,239,0.0); }
}
@utility settle-cell {
  animation: settle-flash 0.4s ease-out 1 both;
}
@media (prefers-reduced-motion: reduce) {
  .settle-cell { animation: none; box-shadow: inset 0 0 0 1px rgba(244,244,239,0.9); }
}
```

- [ ] **Step 2: Update the props and add interaction state**

In `components/command/score-probability-surface.tsx`, replace the `Props` type and component signature. New `Props`:

```tsx
type Props = {
  grid: number[][];
  homeTeam: string;
  awayTeam: string;
  lambdas: { home: number; away: number };
  elo: { home: number; away: number };
  settledScoreline?: { home: number; away: number };
  lockExpiresISO?: string;
};
```

Add `import { useMemo, useState } from "react";` at the top (replacing the existing react import if unused).

Inside the component, after `const bestCell = topK[0];`, add:

```tsx
  const [hoverCell, setHoverCell] = useState<{ r: number; c: number } | null>(null);
  const [selectedCell, setSelectedCell] = useState<{ r: number; c: number } | null>(null);
  const eloGap = Math.round(elo.home - elo.away);
```

- [ ] **Step 3: Enlarge cells and wire hover/click/settlement**

Replace the grid-row render block. The current cell `<div className="flex-1 h-6 …">` becomes a larger square, interactive cell. Replace the inner `row.map(...)` cell element with:

```tsx
            {row.map((prob, c) => {
              const type = cellType(r, c);
              const isBest = bestCell && r === bestCell.home && c === bestCell.away;
              const isSettled = settledScoreline && r === settledScoreline.home && c === settledScoreline.away;
              const isHover = hoverCell?.r === r && hoverCell?.c === c;
              const settleColor = type === "home" ? "var(--up)" : type === "away" ? "var(--down)" : "var(--ink-muted)";
              return (
                <button
                  key={c}
                  type="button"
                  onMouseEnter={() => setHoverCell({ r, c })}
                  onMouseLeave={() => setHoverCell(null)}
                  onClick={() => setSelectedCell((s) => (s?.r === r && s?.c === c ? null : { r, c }))}
                  className={[
                    "flex-1 aspect-square min-h-[44px] flex items-center justify-center rounded-sm",
                    "text-sm font-semibold data-mono transition-transform duration-150",
                    isSettled ? "settle-cell" : "",
                  ].join(" ")}
                  style={{
                    background: cellBg(type, prob),
                    color: isSettled ? settleColor : CELL_TEXT[type],
                    outline: isBest && !isSettled ? "1px solid rgba(255,255,255,0.22)" : isSettled ? `1px solid ${settleColor}` : undefined,
                    transform: isHover ? "scale(1.02)" : undefined,
                    zIndex: isHover ? 2 : undefined,
                  }}
                >
                  {isBest ? <strong>{pctStr(prob)}</strong> : pctStr(prob)}
                </button>
              );
            })}
```

Also remove the `h-6` size on the row container if it constrains height; keep `className="flex flex-1 gap-0.5"` (the cells now drive height via `aspect-square`).

- [ ] **Step 4: Add the hover tooltip + click readout below the grid**

Immediately after the closing of the grid-rows `{grid6.map(...)}` block and the `↑ {homeTeam} goals` label, insert a readout panel. Add before the legend:

```tsx
      {/* Hover/click readout — real model drivers, no fabricated values */}
      {(hoverCell || selectedCell) && (() => {
        const cell = hoverCell ?? selectedCell!;
        const prob = grid6[cell.r][cell.c];
        const label = cell.r === cell.c
          ? `${cell.r}–${cell.c}`
          : cell.r > cell.c
            ? `${homeTeam} ${cell.r}–${cell.c}`
            : `${awayTeam} ${cell.c}–${cell.r}`;
        return (
          <div className="mb-2.5 px-3 py-2 rounded border border-[var(--hairline)] bg-[var(--surface)] flex flex-wrap items-center gap-x-4 gap-y-1">
            <span className="text-slight font-semibold text-[var(--ink)]">{label}</span>
            <span className="text-fine text-[var(--ink-faint)]">P <span className="data-mono text-[var(--ink-muted)]">{pctStr(prob)}</span></span>
            <span className="text-fine text-[var(--ink-faint)]">xG <span className="data-mono text-[var(--ink-muted)]">{lambdas.home.toFixed(2)}–{lambdas.away.toFixed(2)}</span></span>
            <span className="text-fine text-[var(--ink-faint)]">Elo gap <span className="data-mono text-[var(--ink-muted)]">{eloGap > 0 ? "+" : ""}{eloGap}</span></span>
          </div>
        );
      })()}
```

- [ ] **Step 5: Run lint + build (Task 4 + Task 5 now compile together)**

Run: `npm run lint` → Expected: clean
Run: `npm run build` → Expected: succeeds (the new props from Task 4 now match).
Run: `npx vitest run` → Expected: all green (no logic regressions).

- [ ] **Step 6: Commit (Tasks 4 + 5 together)**

```bash
git add app/command/page.tsx components/command/match-detail.tsx components/command/score-probability-surface.tsx app/globals.css
git commit -m "feat(command): enlarge Score Probability Surface with hover/click readout and settlement flash"
```

---

### Task 6: `buildReliabilityTicks()` helper (TDD)

Derives the Reliability Timeline ticks from the predictions ledger.

**Files:**
- Modify: `lib/command-data.ts`
- Test: `tests/command-data.test.ts`

**Interfaces:**
- Consumes: `LockedEntry[]` (from `lib/predictions-ledger`, already imported in `command-data.ts`).
- Produces:
  ```ts
  type ReliabilityTick = {
    slug: string;
    lockedAt: string;
    result: string;
    brier: number;
    grade: ForecastGrade;
    outcome: "hit" | "correct" | "miss" | "neutral";
  };
  function buildReliabilityTicks(entries: LockedEntry[], limit?: number): ReliabilityTick[];
  ```
  Consumed by Task 7 (`page.tsx` → `ReliabilityTimeline`).

- [ ] **Step 1: Write the failing test**

Add to `tests/command-data.test.ts`:

```ts
import { buildReliabilityTicks } from "../lib/command-data";

describe("buildReliabilityTicks", () => {
  const base = (over: Record<string, unknown>) => ({
    slug: "a-vs-b", lockedAt: "2026-06-10T00:00:00Z", split: { home: 40, draw: 30, away: 30 },
    ...over,
  });

  it("includes only settled entries, sorted by lockedAt ascending", () => {
    const ticks = buildReliabilityTicks([
      base({ lockedAt: "2026-06-12T00:00:00Z", result: "1-0", correctPick: true, modelBrier: 0.2, scorelineHit: true }),
      base({ lockedAt: "2026-06-10T00:00:00Z", result: "2-1", correctPick: false, modelBrier: 0.8, scorelineHit: false }),
      base({ result: undefined }),
    ] as never);
    expect(ticks.map((t) => t.lockedAt)).toEqual(["2026-06-10T00:00:00Z", "2026-06-12T00:00:00Z"]);
  });

  it("maps outcome categories", () => {
    const ticks = buildReliabilityTicks([
      base({ result: "1-0", correctPick: true, modelBrier: 0.2, scorelineHit: true }),
      base({ result: "1-0", correctPick: true, modelBrier: 0.4, scorelineHit: false }),
      base({ result: "0-2", correctPick: false, modelBrier: 0.9, scorelineHit: false }),
    ] as never);
    expect(ticks.map((t) => t.outcome)).toEqual(["hit", "correct", "miss"]);
  });

  it("limits to the last N", () => {
    const many = Array.from({ length: 60 }, (_, i) =>
      base({ lockedAt: `2026-04-${String((i % 28) + 1).padStart(2, "0")}T00:00:00Z`, result: "1-0", correctPick: true, modelBrier: 0.3 }));
    expect(buildReliabilityTicks(many as never, 50)).toHaveLength(50);
  });
});
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `npx vitest run tests/command-data.test.ts -t buildReliabilityTicks`
Expected: FAIL — `buildReliabilityTicks is not a function`.

- [ ] **Step 3: Implement the helper**

Add to `lib/command-data.ts`:

```ts
// ─── Reliability Timeline ─────────────────────────────────────────────────────
export type ReliabilityTick = {
  slug: string;
  lockedAt: string;
  result: string;
  brier: number;
  grade: ForecastGrade;
  outcome: "hit" | "correct" | "miss" | "neutral";
};

export function buildReliabilityTicks(
  entries: LockedEntry[],
  limit = 50
): ReliabilityTick[] {
  return entries
    .filter((e) => e.result !== undefined && e.modelBrier !== undefined)
    .sort((a, b) => new Date(a.lockedAt).getTime() - new Date(b.lockedAt).getTime())
    .slice(-limit)
    .map((e) => {
      const brier = e.modelBrier!;
      const outcome: ReliabilityTick["outcome"] = e.scorelineHit
        ? "hit"
        : e.correctPick === true
          ? "correct"
          : e.correctPick === false
            ? "miss"
            : "neutral";
      return {
        slug: e.slug,
        lockedAt: e.lockedAt,
        result: e.result!,
        brier,
        grade: forecastGrade(brier),
        outcome,
      };
    });
}
```

(`forecastGrade`, `LockedEntry` are already defined/imported in this file.)

- [ ] **Step 4: Run the test to verify it passes**

Run: `npx vitest run tests/command-data.test.ts -t buildReliabilityTicks`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/command-data.ts tests/command-data.test.ts
git commit -m "feat(command): add buildReliabilityTicks ledger helper"
```

---

### Task 7: Reliability Timeline component + mount

**Files:**
- Create: `components/command/reliability-timeline.tsx`
- Modify: `app/command/page.tsx`
- Modify: `components/command/command-shell.tsx`

**Interfaces:**
- Consumes: `ReliabilityTick[]` (Task 6).
- Produces: `<ReliabilityTimeline ticks={...} />`; `CommandShell` gains a `reliabilityTicks` prop.

- [ ] **Step 1: Create the component**

Create `components/command/reliability-timeline.tsx`:

```tsx
"use client";

import { useState } from "react";
import type { ReliabilityTick } from "@/lib/command-data";

const TICK_COLOR: Record<ReliabilityTick["outcome"], string> = {
  hit: "var(--up)",
  correct: "var(--up)",
  miss: "var(--down)",
  neutral: "var(--ink-faint)",
};

export function ReliabilityTimeline({ ticks }: { ticks: ReliabilityTick[] }) {
  const [active, setActive] = useState<number | null>(null);
  if (ticks.length === 0) return null;
  const cur = active !== null ? ticks[active] : null;

  return (
    <section className="border-t border-[var(--line)] px-6 py-3">
      <div className="flex items-center gap-3 mb-2">
        <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest">
          Reliability Timeline
        </div>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
        <div className="text-fine text-[var(--ink-faint)]">last {ticks.length} settled</div>
      </div>
      <div className="flex items-end gap-[3px] h-[40px]">
        {ticks.map((t, i) => (
          <button
            key={t.slug + i}
            type="button"
            onMouseEnter={() => setActive(i)}
            onMouseLeave={() => setActive(null)}
            className="w-[3px] rounded-sm transition-opacity"
            style={{
              height: `${Math.max(20, 100 - t.brier * 80)}%`,
              backgroundColor: TICK_COLOR[t.outcome],
              opacity: active === null || active === i ? 1 : 0.4,
            }}
            aria-label={`${t.slug} ${t.result}`}
          />
        ))}
      </div>
      <div className="mt-2 h-4 text-fine text-[var(--ink-faint)]">
        {cur ? (
          <span>
            {cur.slug.replace(/-vs-/, " – ").replace(/-/g, " ")} · {cur.result} · Brier{" "}
            <span className="data-mono text-[var(--ink-muted)]">{cur.brier.toFixed(3)}</span> ·{" "}
            <span className="uppercase">{cur.grade}</span>
          </span>
        ) : (
          <span className="opacity-50">Hover a forecast for settlement detail</span>
        )}
      </div>
    </section>
  );
}
```

- [ ] **Step 2: Build ticks in `app/command/page.tsx`**

Add to the imports from `@/lib/command-data`:

```tsx
  buildReliabilityTicks,
```

After the `const learningSignals = ...` line (near the end, before `return`), add:

```tsx
  const reliabilityTicks = buildReliabilityTicks(predictions, 50);
```

Add the prop to the `<CommandShell … />` JSX:

```tsx
      reliabilityTicks={reliabilityTicks}
```

- [ ] **Step 3: Accept + render in `components/command/command-shell.tsx`**

Add the import:

```tsx
import { ReliabilityTimeline } from "./reliability-timeline";
import type { ReliabilityTick } from "@/lib/command-data";
```

Add to the `Props` type:

```tsx
  reliabilityTicks?: ReliabilityTick[];
```

Add `reliabilityTicks = []` to the destructured params.

Insert the timeline between the 3-column body's closing `</div>` and the Learning Signals block:

```tsx
      {reliabilityTicks.length > 0 && (
        <div className="flex-shrink-0">
          <ReliabilityTimeline ticks={reliabilityTicks} />
        </div>
      )}
```

- [ ] **Step 4: Verify build + lint + tests**

Run: `npm run lint` → Expected: clean
Run: `npm run build` → Expected: succeeds
Run: `npx vitest run` → Expected: all green

- [ ] **Step 5: Commit**

```bash
git add components/command/reliability-timeline.tsx app/command/page.tsx components/command/command-shell.tsx
git commit -m "feat(command): add Reliability Timeline strip from ledger ticks"
```

---

### Task 8: Full verification + visual confirmation

**Files:** none (verification only).

- [ ] **Step 1: Full gate**

Run: `npm run lint && npm run build && npx vitest run`
Expected: all pass, no errors.

- [ ] **Step 2: Confirm no broken `--warn` remains**

Run: `grep -rn "var(--warn)" components/ app/ | wc -l` (usages) and `grep -c -- "--warn:" app/globals.css` (definitions → 2). Confirm the token is defined.

- [ ] **Step 3: Visual screenshot of `/command`**

Start the dev server (background) and capture `/command` with Playwright (the `.playwright-mcp` tooling already present). Confirm visually:
- amber states render (lock countdown, "closes in Xh", MONITORING/PENDING badges, next-review)
- Score Probability Surface is enlarged; hovering a cell shows the scale + readout (prob/xG/Elo); clicking holds the readout
- selecting a settled fixture flashes its realized cell once then holds the outline
- Reliability Timeline strip renders below the 3-column body with hover detail
- numeric data renders in JetBrains Mono

- [ ] **Step 4: Final commit (if any screenshot/docs artifacts)**

```bash
git add -A
git commit -m "chore(command): verification screenshot for directive gap fixes"
```

---

## Self-Review

**Spec coverage:**
- W1 `--warn` bug → Task 1 ✓
- W2 monospace → Task 2 ✓
- W3 surface enlarge → Task 5; hover tooltip → Task 5 (real `lambdas`/`elo`); click readout → Task 5; settlement flash → Tasks 3+4+5; scoreline clamp → Task 3 ✓
- W4 Reliability Timeline → Tasks 6+7 ✓
- Out-of-scope items (palette retune, background, renames, Active-Investigation split) → correctly absent ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Every code step has concrete code. ✓

**Type consistency:** `parseSettledScoreline` returns `{home,away}` used identically in `match-detail` and surface `settledScoreline`. `ReliabilityTick` shape defined in Task 6 matches consumption in Task 7. `ScoreProbabilitySurface` new props (`lambdas`, `elo`, `settledScoreline`) defined in Task 5, produced by Task 4. Task 4 intentionally defers its commit to Task 5 (noted) since the props don't compile until Task 5 — flagged explicitly to avoid a red-build commit. ✓
