# Command Center — Directive Gap Fixes

**Date:** 2026-06-19
**Scope:** Close real deltas between the live `/command` route and the WC26 Forecast Command Center design directive. Audit-driven, surgical. **Do not rebuild working code.**

## Context

`app/app/command/page.tsx` + `components/command/*` already implement ~90% of the directive's Section 10 architecture (dispatch → ledger / score-probability-surface / integrity → drivers → evolution → learning signals → championship projections). The pasted critique targeted the older live Vercel deploy, not this route.

A section-by-section audit found 9 gaps. After review, 4 are in scope; 5 are explicitly out.

## Constraints

- **Next.js 16.2.6 has breaking changes.** Per `app/AGENTS.md`, read the relevant guide in `node_modules/next/dist/docs/` before writing layout/font/component code. Do not assume training-data Next.js behavior.
- **No regressions.** All changes are additive or surgical. Existing components keep working.
- **Real data only.** Tooltip/timeline values come from the actual `Prediction` type and `data/predictions.json` ledger — never fabricated.
- **Keep house style.** `--up #7cffb2` / `--down #ff674d` and the body gradient atmosphere stay (explicit user decision).

## In Scope

### W1 — Define `--warn` token (BUG FIX)

`var(--warn)` is referenced in **26 places** across command components (status dots, "closes in Xh", lock countdown, learning-signal MONITORING/PENDING badges, next-review dates, forecast-driver edges) but is **never defined** in `app/globals.css`. Those amber states currently render as broken inherited color.

- `app/globals.css`:
  - Add to `:root` and `.dark`: `--warn: #FBBF24;` and `--warn-2: #FB923C;`
  - Add to `@theme inline`: `--color-warn: var(--warn);` `--color-warn-2: var(--warn-2);`
- No component edits needed — all 26 existing usages resolve once the token exists.
- **Verify:** grep confirms no other undefined CSS vars remain in command components.

### W2 — Load monospace typeface (§7.3)

Directive mandates monospace for all numerical data. No mono font is loaded; `font-mono` falls back to browser default.

- `app/app/layout.tsx`: add `JetBrains_Mono` from `next/font/google` with `variable: "--font-jetbrains-mono"`, mirror the existing Inter pattern, append to the `<html>` className.
- `app/globals.css`:
  - `@theme inline`: `--font-mono: var(--font-jetbrains-mono), "JetBrains Mono", ui-monospace, "SF Mono", monospace;`
  - Add `@utility data-mono { font-family: var(--font-mono); font-variant-numeric: tabular-nums; }`
- Apply `data-mono` to the **high-signal numeric displays only** (not every number): Score Probability Surface cell %s + scoreline chips, 3-way split %s (`match-detail`), System Health metrics (brier/ece/rps), championship %s, lock countdown, and the new Reliability Timeline tooltip. Bounded edit list, enumerated in the plan.

### W3 — Score Probability Surface: enlarge + interaction (§9, §11)

File: `components/command/score-probability-surface.tsx` (+ small props from `match-detail.tsx` / `page.tsx`).

1. **Enlarge.** Cells `h-6` (24px) → square, larger cells so the 6×6 grid reads as the dominant center artifact (target ~48–64px/cell). Scale cell `%` font up. Keep semantic heatmap + most-likely outline.
2. **Hover.** Cell hover → `scale(1.02)` (CSS transform, 0.15s) + tooltip showing **real** data: scoreline, exact probability, match expected goals (`prediction.lambdas.home`/`.away`), and Elo gap (`prediction.elo.home - prediction.elo.away`). Pass `lambdas` + `elo` from `match-detail`. No invented per-cell xG.
3. **Click → why.** Cell click sets a `selectedScoreline` state; a compact readout below the grid shows that scoreline's probability and the driving factors (reuse `forecast-drivers` data: lambdas, elo, market). Minimal — no new heavy panel.
4. **Settlement flash.** Surface accepts optional `settledScoreline?: { home: number; away: number }`. When present, that cell renders in settlement color with a one-time CSS flash animation on mount, then holds. Wire data: in `page.tsx`, also compute prediction grids for **settled** fixtures (drop the `if (!cf.isOperational) continue` skip), and have `match-detail` derive `settledScoreline` from `fixture.result`.

   **Scoreline → display-cell compression (explicit):** parse `fixture.result` `"H-A"` into integers, then clamp each to the 6-bucket display index where index `5` = the `"5+"` overflow bucket:
   - `displayRow = Math.min(homeGoals, 5)`, `displayCol = Math.min(awayGoals, 5)`
   - `"4-1"` → `{ home: 4, away: 1 }` (row 4, col 1 — **not** the 5+ row)
   - `"6-2"` → `{ home: 5, away: 2 }` (home goals ≥6 clamp into the `5+` row)
   - `"2-7"` → `{ home: 2, away: 5 }` (away goals ≥6 clamp into the `5+` col)

   This matches `compressGrid`'s `Math.min(r, DISPLAY-1)` folding in `lib/command-data.ts`, so the flashed cell aligns exactly with the rendered probability buckets.

### W4 — Reliability Timeline (§10.2.8)

New component: `components/command/reliability-timeline.tsx`.

- **Data:** settled entries from `data/predictions.json` (currently 21), sorted by `lockedAt`, last ≤50. Built in `page.tsx`, passed through `CommandShell`.
- **Tick:** 2px-wide vertical marks. Color by outcome — `scorelineHit` → bright `--up`; `correctPick` → `--up`; `!correctPick` → `--down`; draw-realized neutral → `--ink-faint`. (Reuse existing `forecastGrade(modelBrier)` banding for shade.)
- **Hover:** tooltip with teams, result, Brier, grade.
- **Placement:** full-width `flex-shrink-0` band inserted between the 3-column body and the Learning Signals section in `command-shell.tsx`. ~60px tall.

## Out of Scope (explicit)

| Gap | Reason |
|-----|--------|
| G4 semantic palette retune to `#2DD4A8`/`#F87171` | Keep tuned house palette (user). Only `--warn` added. |
| G5 strip body gradients to absolute black | Keep house atmosphere (user). |
| G6 rename "System Health" → "Forecast Integrity"; grade → A–F | Not selected. Keep current naming. |
| G8 distinct amber Active-Investigation block | Not selected. Stays folded in Learning Signals. |

## Files Touched

- `app/app/globals.css` — `--warn`/`--warn-2`, `--font-mono`, `data-mono` utility, settlement-flash keyframe
- `app/app/layout.tsx` — JetBrains Mono font load
- `app/components/command/score-probability-surface.tsx` — enlarge, hover tooltip, click-why, settlement flash
- `app/components/command/match-detail.tsx` — pass `lambdas`/`elo`/`settledScoreline`; apply `data-mono`
- `app/components/command/command-shell.tsx` — mount Reliability Timeline; apply `data-mono` to System Health metrics
- `app/components/command/championship-projection.tsx` — apply `data-mono`
- `app/components/command/reliability-timeline.tsx` — **new**
- `app/app/command/page.tsx` — compute settled grids; build reliability ticks

## Verification

1. `npx next build` (or project build script) — passes, no type errors.
2. `npm run lint` — clean.
3. `npx vitest run` for any `lib/command-data` / `lib/derive-heatmap` tests touched — green.
4. Playwright screenshot of `/command` — visually confirm: amber states render, surface enlarged + interactive, settlement flash on a settled fixture, Reliability Timeline strip present, numeric data in mono.

## Success Criteria

- No `var(--warn)` resolves to broken/inherited color anywhere.
- Score Probability Surface is the visually dominant center element with working hover tooltip, click readout, and settlement flash.
- Reliability Timeline renders ≥21 real ticks from the ledger with hover detail.
- All numeric data in the touched components renders in JetBrains Mono.
- Build + lint + tests pass. No existing `/command` behavior regressed.
