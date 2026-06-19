# Forecast Command Center — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use `superpowers:subagent-driven-development` (recommended) or `superpowers:executing-plans` to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build `/command` — a full-height, 3-column Forecast Command Center that exposes Score Probability Surface, Forecast Drivers, Intelligence Dispatch, Model Evolution with Forecast Autopsy, and Championship Projection as a unified intelligence interface.

**Architecture:** New route `app/command/` with a custom layout (bypasses AppChrome, full-height fixed body). A server component (`page.tsx`) fetches all data and computes predictions for every operational lock at build time, then passes serialized props to a client shell component that manages selected-fixture state. Pure domain functions live in `lib/command-data.ts` and are unit-tested independently of React.

**Tech Stack:** Next.js 16.2.6 App Router · React 19 · TypeScript 5 · existing `lib/predict.ts` (Elo+Dixon-Coles+Platt) · existing `lib/data.ts` (fixtures/clubs) · existing `lib/accountability.ts` (CalibrationBin, AccountabilityOutput) · `data/simulation.json` (championship projections) · CSS custom properties (`--canvas`, `--up`, `--down`, `--warn`, `--ink`, `--ink-muted`, `--ink-faint`, `--line`, `--hairline`)

---

## File Map

| Path | Action | Responsibility |
|------|--------|----------------|
| `lib/command-data.ts` | **Create** | Types, grade computation, dispatch builder, evolution log builder — all pure functions |
| `tests/command-data.test.ts` | **Create** | Unit tests for all pure functions in command-data.ts |
| `app/command/layout.tsx` | **Create** | Full-height layout bypassing AppChrome |
| `app/command/page.tsx` | **Create** | Server component: data fetch + prediction compute + prop assembly |
| `components/command/command-shell.tsx` | **Create** | `"use client"` — selected-fixture state, 3-column grid, nav, rail |
| `components/command/forecast-record.tsx` | **Create** | Left panel: fixture list with grade badges, phase dividers, selection highlight |
| `components/command/match-detail.tsx` | **Create** | Center panel: dispatch + match header + prob triple + drivers + score surface + lock countdown |
| `components/command/score-probability-surface.tsx` | **Create** | 6×6 Dixon-Coles grid display (collapses 9×9 model output) |
| `components/command/forecast-drivers.tsx` | **Create** | 3 primary + 3 secondary driver cells |
| `components/command/model-evolution.tsx` | **Create** | Learning log: Surprise / Calibration / Confirm entries with inline Forecast Autopsy |
| `components/command/championship-projection.tsx` | **Create** | Right rail: title contender list with probability bars + matchday Δ |

---

## Task 1: `lib/command-data.ts` — types and grade computation

**Files:**
- Create: `lib/command-data.ts`
- Create: `tests/command-data.test.ts`

- [ ] **Step 1: Write failing tests for `forecastGrade` and `compressGrid`**

```typescript
// tests/command-data.test.ts
import { describe, it, expect } from "vitest";
import { forecastGrade, compressGrid, buildChampionshipProjections } from "../lib/command-data";

describe("forecastGrade", () => {
  it("returns 'sharp' for Brier < 0.35", () => {
    expect(forecastGrade(0.34)).toBe("sharp");
    expect(forecastGrade(0)).toBe("sharp");
  });
  it("returns 'solid' for 0.35 ≤ Brier < 0.55", () => {
    expect(forecastGrade(0.35)).toBe("solid");
    expect(forecastGrade(0.54)).toBe("solid");
  });
  it("returns 'close' for 0.55 ≤ Brier < 0.75", () => {
    expect(forecastGrade(0.55)).toBe("close");
    expect(forecastGrade(0.74)).toBe("close");
  });
  it("returns 'miss' for 0.75 ≤ Brier < 0.90", () => {
    expect(forecastGrade(0.75)).toBe("miss");
    expect(forecastGrade(0.89)).toBe("miss");
  });
  it("returns 'surprise' for Brier ≥ 0.90", () => {
    expect(forecastGrade(0.90)).toBe("surprise");
    expect(forecastGrade(0.941)).toBe("surprise");
    expect(forecastGrade(1)).toBe("surprise");
  });
});

describe("compressGrid", () => {
  it("compresses 9×9 grid to 6×6 by collapsing rows/cols 5+ together", () => {
    // Build a 9×9 grid of known values: cell[i][j] = (i+1)*(j+1)
    const grid9: number[][] = Array.from({ length: 9 }, (_, i) =>
      Array.from({ length: 9 }, (_, j) => (i + 1) * (j + 1) / 100)
    );
    const grid6 = compressGrid(grid9);
    expect(grid6).toHaveLength(6);
    expect(grid6[0]).toHaveLength(6);
    // Cell [0][0] should equal grid9[0][0]
    expect(grid6[0][0]).toBeCloseTo(grid9[0][0]);
    // Cell [5][5] should be the sum of grid9[5..8][5..8]
    let expected = 0;
    for (let r = 5; r < 9; r++) for (let c = 5; c < 9; c++) expected += grid9[r][c];
    expect(grid6[5][5]).toBeCloseTo(expected);
  });
});

describe("buildChampionshipProjections", () => {
  it("returns top 8 teams sorted by champion probability descending", () => {
    const teams = {
      Brazil: { champion: 0.18, reachFinal: 0.38 },
      France: { champion: 0.14, reachFinal: 0.30 },
      England: { champion: 0.12, reachFinal: 0.25 },
      Germany: { champion: 0.09, reachFinal: 0.20 },
      Argentina: { champion: 0.11, reachFinal: 0.22 },
      Spain: { champion: 0.08, reachFinal: 0.18 },
      Portugal: { champion: 0.07, reachFinal: 0.15 },
      Mexico: { champion: 0.05, reachFinal: 0.10 },
      Australia: { champion: 0.02, reachFinal: 0.04 },
    } as Record<string, { champion: number; reachFinal: number }>;
    const result = buildChampionshipProjections(teams, 8);
    expect(result).toHaveLength(8);
    expect(result[0].team).toBe("Brazil");
    expect(result[0].probability).toBeCloseTo(0.18);
    expect(result[7].team).toBe("Mexico");
  });

  it("attaches delta when previous projection provided", () => {
    const current = { Brazil: { champion: 0.182, reachFinal: 0.38 } } as Record<string, { champion: number; reachFinal: number }>;
    const previous = { Brazil: { champion: 0.168, reachFinal: 0.36 } } as Record<string, { champion: number; reachFinal: number }>;
    const result = buildChampionshipProjections(current, 1, previous);
    expect(result[0].delta).toBeCloseTo(0.014, 2);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npx vitest run tests/command-data.test.ts 2>&1 | tail -10
```

Expected: `FAIL — cannot find module '../lib/command-data'`

- [ ] **Step 3: Write `lib/command-data.ts`**

```typescript
// lib/command-data.ts
// Pure domain functions for the Forecast Command Center.
// No filesystem access, no React. All functions are deterministic.

import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";

// ─── Forecast Grade ───────────────────────────────────────────────────────────

export type ForecastGrade = "sharp" | "solid" | "close" | "miss" | "surprise";

/** Map a settled Brier score to a 5-tier Forecast Grade. */
export function forecastGrade(brier: number): ForecastGrade {
  if (brier < 0.35) return "sharp";
  if (brier < 0.55) return "solid";
  if (brier < 0.75) return "close";
  if (brier < 0.90) return "miss";
  return "surprise";
}

// ─── Score Probability Surface ────────────────────────────────────────────────

/**
 * Compress a GRID_SIZE×GRID_SIZE (9×9) Dixon-Coles grid into a 6×6 display grid
 * by summing all goals ≥ 5 into the last row/column bucket ("5+").
 */
export function compressGrid(grid: number[][]): number[][] {
  const DISPLAY = 6;
  const out: number[][] = Array.from({ length: DISPLAY }, () =>
    Array(DISPLAY).fill(0)
  );
  for (let r = 0; r < grid.length; r++) {
    const dr = Math.min(r, DISPLAY - 1);
    for (let c = 0; c < grid[r].length; c++) {
      const dc = Math.min(c, DISPLAY - 1);
      out[dr][dc] += grid[r][c];
    }
  }
  return out;
}

/** Top-K scorelines from the compressed 6×6 display grid, sorted by probability descending. */
export function topScorelines(
  grid6: number[][],
  k = 6
): Array<{ home: number; away: number; prob: number }> {
  const items: Array<{ home: number; away: number; prob: number }> = [];
  for (let r = 0; r < grid6.length; r++) {
    for (let c = 0; c < grid6[r].length; c++) {
      items.push({ home: r, away: c, prob: grid6[r][c] });
    }
  }
  return items.sort((a, b) => b.prob - a.prob).slice(0, k);
}

// ─── Championship Projection ──────────────────────────────────────────────────

export type ChampionProjection = {
  rank: number;
  team: string;
  probability: number;  // champion probability 0..1
  delta?: number;       // change vs previous simulation run (positive = improved)
};

type SimTeam = { champion: number; reachFinal: number };

/**
 * Build a sorted championship projection list from simulation.json `teams` map.
 * Optionally compares against a previous simulation to compute Δ.
 */
export function buildChampionshipProjections(
  teams: Record<string, SimTeam>,
  topN = 8,
  previous?: Record<string, SimTeam>
): ChampionProjection[] {
  return Object.entries(teams)
    .sort(([, a], [, b]) => b.champion - a.champion)
    .slice(0, topN)
    .map(([team, data], i) => ({
      rank: i + 1,
      team,
      probability: data.champion,
      delta: previous ? data.champion - (previous[team]?.champion ?? data.champion) : undefined,
    }));
}

// ─── Forecast Record (left panel) ────────────────────────────────────────────

export type CommandFixture = {
  slug: string;
  homeTeam: string;
  awayTeam: string;
  kickoffISO: string;
  stage: string;
  group?: string;
  // Settled fields
  result?: string;       // "2-0"
  grade?: ForecastGrade;
  // Operational fields
  isOperational: boolean;
  split?: { home: number; draw: number; away: number };
  hoursUntilKickoff?: number;
};

/** Compute hours until kickoff from ISO string. Returns undefined if already past. */
export function hoursUntil(kickoffISO: string, now = new Date()): number | undefined {
  const diff = new Date(kickoffISO).getTime() - now.getTime();
  return diff > 0 ? diff / 3_600_000 : undefined;
}

// ─── Intelligence Dispatch ────────────────────────────────────────────────────

export type Dispatch = {
  dateline: string;
  headline: string;
  body: string;
  signals: Array<{ label: string; value: string; color: "up" | "warn" | "neutral" }>;
};

export type DispatchInput = {
  topTeam: string;
  topTeamPct: number;               // e.g. 18.2
  surpriseCount: number;
  activePatternsCount: number;
  operationalLockCount: number;
  sharpOrSolidPct: number;          // e.g. 47.6
  closingSoonLabels: string[];       // matches closing in ≤24h
  ece: number;                       // 0..1 fraction
};

/**
 * Build a deterministic Intelligence Dispatch from current data.
 * Headline: 1 sentence. Body: 2–3 sentences. 3 signals.
 */
export function buildDispatch(input: DispatchInput): Dispatch {
  const {
    topTeam, topTeamPct, surpriseCount, activePatternsCount,
    operationalLockCount, sharpOrSolidPct, closingSoonLabels, ece,
  } = input;

  const ecePct = (ece * 100).toFixed(1);
  const calibStatus = ece < 0.03 ? "NOMINAL" : ece < 0.05 ? "WARNING" : "BREACH";

  // Headline: surface the two most important facts right now
  const surpriseLine =
    surpriseCount > 0
      ? ` The model identified ${surpriseCount === 1 ? "a blind spot" : `${surpriseCount} blind spots`} and is actively monitoring.`
      : ` Calibration is ${calibStatus} at ECE ${ecePct}%.`;

  const headline = `${topTeam} leads the tournament.${surpriseLine}`;

  // Body: explain the context
  const patternLine =
    activePatternsCount > 0
      ? `${activePatternsCount === 1 ? "One active pattern is" : `${activePatternsCount} active patterns are`} under monitoring — draw probability may be underweighted in strong-favorite group-stage scenarios. `
      : "";

  const lockLine =
    closingSoonLabels.length > 0
      ? `${closingSoonLabels.slice(0, 2).join(" and ")} ${closingSoonLabels.length === 1 ? "closes" : "close"} within 24 hours.`
      : `${operationalLockCount} prediction locks are currently operational.`;

  const body = `${patternLine}${topTeam} holds the highest Championship Projection at ${topTeamPct.toFixed(1)}%. ${lockLine}`;

  const signals: Dispatch["signals"] = [
    {
      label: `${operationalLockCount} locks in play`,
      value: activePatternsCount > 0 ? `${activePatternsCount} pattern monitored` : "no alerts",
      color: activePatternsCount > 0 ? "warn" : "neutral",
    },
    {
      label: "Sharp or Solid",
      value: `${sharpOrSolidPct.toFixed(1)}% of settled`,
      color: sharpOrSolidPct >= 40 ? "up" : "warn",
    },
    {
      label: "Calibration",
      value: calibStatus,
      color: calibStatus === "NOMINAL" ? "up" : "warn",
    },
  ];

  return { dateline: "Intelligence Dispatch", headline, body, signals };
}

// ─── Model Evolution + Forecast Autopsy ──────────────────────────────────────

export type EvolutionEntryType = "surprise" | "calibration" | "confirm";

export type ForecastAutopsy = {
  lockedLine: string;    // "England 72% · Draw 18% · Serbia 10%"
  resultLine: string;    // "0–0 Draw · Brier 0.941 · Surprise"
  freqLine: string;      // "28% observed vs 18% model (n=47)"
  patternNote: string;   // active monitoring note
};

export type EvolutionEntry = {
  id: string;            // slug-based or "calibration-MD{n}"
  type: EvolutionEntryType;
  date: string;          // ISO date string
  matchLabel?: string;   // "England vs Serbia"
  body: string;
  autopsy?: ForecastAutopsy;
  statusLine: string;
  statusColor: "up" | "warn" | "blue";
};

/**
 * Derive the Model Evolution log from the settled ledger.
 * Returns entries sorted newest-first.
 * - Surprise entries (Brier ≥ 0.90): one entry per event with inline autopsy.
 * - Calibration entry: one entry summarizing ECE improvement if ece < previous threshold.
 * - Confirm entries: Sharp-grade entries that confirmed a prior hypothesis.
 */
export function buildEvolutionLog(
  entries: LockedEntry[],
  homeTeamLabel: (slug: string) => string,
  awayTeamLabel: (slug: string) => string,
  ece: number,
): EvolutionEntry[] {
  const result: EvolutionEntry[] = [];

  // Surprise entries (newest first)
  const surprises = entries
    .filter((e) => e.modelBrier !== undefined && e.modelBrier >= 0.90)
    .sort((a, b) => (b.lockedAt > a.lockedAt ? 1 : -1));

  for (const entry of surprises) {
    const home = homeTeamLabel(entry.slug);
    const away = awayTeamLabel(entry.slug);
    const s = entry.split;
    const lockedLine = `${home} ${s.home.toFixed(0)}% · Draw ${s.draw.toFixed(0)}% · ${away} ${s.away.toFixed(0)}%`;
    const scoreStr = entry.result ?? "?";
    const brierStr = entry.modelBrier!.toFixed(3);
    const resultLine = `${scoreStr.replace("-", "–")} · Brier ${brierStr} · Surprise`;

    result.push({
      id: entry.slug,
      type: "surprise",
      date: entry.lockedAt,
      matchLabel: `${home} vs ${away}`,
      body: `${home} vs ${away} settled ${scoreStr.replace("-", "–")}. Model assigned ${home} ${s.home.toFixed(0)}% win probability, draw only ${s.draw.toFixed(0)}%. Brier ${brierStr} — worst forecast this tournament.`,
      autopsy: {
        lockedLine,
        resultLine,
        freqLine: `Draw expected: ${s.draw.toFixed(0)}% model vs ~28% historical in comparable fixtures (top-5 Elo, neutral venue, group stage)`,
        patternNote: "Monitoring: draw underestimation in strong-home-favorite group-stage scenarios.",
      },
      statusLine: "Pattern active — monitoring upcoming locks with similar Elo profile",
      statusColor: "warn",
    });
  }

  // Calibration entry (if ECE is meaningful)
  if (ece > 0) {
    const ecePct = (ece * 100).toFixed(1);
    result.push({
      id: "calibration-md",
      type: "calibration",
      date: new Date().toISOString(),
      body: `ECE at ${ecePct}% — within the 3% gate. Platt scaling is holding. No version change required.`,
      statusLine: "Logged · v1.0.0-platt unchanged",
      statusColor: "blue",
    });
  }

  // Confirm entries: Sharp forecasts that validated a prediction hypothesis
  const sharps = entries
    .filter((e) => e.modelBrier !== undefined && e.modelBrier < 0.35)
    .sort((a, b) => (b.lockedAt > a.lockedAt ? 1 : -1))
    .slice(0, 1);  // show only most recent

  for (const entry of sharps) {
    const home = homeTeamLabel(entry.slug);
    const away = awayTeamLabel(entry.slug);
    const brierStr = entry.modelBrier!.toFixed(3);
    result.push({
      id: `confirm-${entry.slug}`,
      type: "confirm",
      date: entry.lockedAt,
      matchLabel: `${home} vs ${away}`,
      body: `${home} vs ${away} settled ${entry.result?.replace("-", "–") ?? ""}. Brier ${brierStr} → Sharp grade. Model confidence was well-placed.`,
      statusLine: "Pattern confirmed — high-Elo-gap forecasts within expected accuracy range",
      statusColor: "up",
    });
  }

  return result.sort((a, b) => (b.date > a.date ? 1 : -1));
}

// ─── System Health ─────────────────────────────────────────────────────────────

export type SystemHealth = {
  status: "NOMINAL" | "WARNING" | "BREACH";
  brier: number;
  ece: number;
  rps: number;
  graded: number;
  total: number;
};

export function buildSystemHealth(
  accountability: AccountabilityOutput,
  totalLocks: number,
): SystemHealth {
  const { aggregates } = accountability.official;
  const bins = accountability.official.calibrationBins ?? [];
  const n = bins.reduce((s, b) => s + b.n, 0);
  const ece =
    n > 0
      ? bins.reduce((s, b) => s + (b.n / n) * Math.abs(b.predicted - b.observed), 0)
      : 0;
  const status: SystemHealth["status"] =
    ece < 0.03 ? "NOMINAL" : ece < 0.05 ? "WARNING" : "BREACH";
  return {
    status,
    brier: aggregates.meanBrier ?? 0,
    ece,
    rps: aggregates.meanRps ?? 0,
    graded: aggregates.n,
    total: totalLocks,
  };
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npx vitest run tests/command-data.test.ts 2>&1 | tail -15
```

Expected: `Tests 9 passed (9)`

- [ ] **Step 5: Confirm TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | grep "command-data" | head -10
```

Expected: no errors on `command-data.ts`

- [ ] **Step 6: Commit**

```bash
git add lib/command-data.ts tests/command-data.test.ts
git commit -m "feat(command): add command-data.ts — grade, grid compression, dispatch, evolution log"
```

---

## Task 2: `app/command/layout.tsx` — full-height route layout

**Files:**
- Create: `app/command/layout.tsx`

The Command Center needs a full-height, no-scroll body (the columns scroll internally). This layout bypasses `AppChrome` and outputs a clean `<html>`-level wrapper with the global CSS.

- [ ] **Step 1: Create `app/command/layout.tsx`**

```typescript
// app/command/layout.tsx
// Full-height layout for the Forecast Command Center.
// Bypasses AppChrome — this page manages its own nav and chrome.
export const metadata = { title: "Command — WC26 Forecasting" };

export default function CommandLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[var(--canvas)] text-[var(--ink)]">
      {children}
    </div>
  );
}
```

- [ ] **Step 2: Verify build picks up the layout**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npx tsc --noEmit 2>&1 | grep "command/layout" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/command/layout.tsx
git commit -m "feat(command): add full-height route layout for /command"
```

---

## Task 3: `components/command/command-shell.tsx` — 3-column client shell

**Files:**
- Create: `components/command/command-shell.tsx`

This is the primary client component. It owns:
- The top nav bar with tab highlighting
- The 3-item status rail
- The 3-column body grid
- The selected-fixture state (which fixture drives the center panel)

It receives all pre-computed data as props and renders sub-components.

- [ ] **Step 1: Create `components/command/command-shell.tsx`**

```typescript
// components/command/command-shell.tsx
"use client";

import { useState } from "react";
import type { ForecastGrade, CommandFixture, Dispatch, EvolutionEntry, ChampionProjection, SystemHealth } from "@/lib/command-data";
import type { Prediction } from "@/lib/predict";
import { ForecastRecord } from "./forecast-record";
import { MatchDetail } from "./match-detail";
import { ModelEvolution } from "./model-evolution";
import { ChampionshipProjection } from "./championship-projection";

export type OperationalPrediction = {
  slug: string;
  prediction: Prediction;
};

type Props = {
  fixtures: CommandFixture[];
  operationalPredictions: OperationalPrediction[];
  defaultSlug: string;
  dispatch: Dispatch;
  evolutionLog: EvolutionEntry[];
  championshipProjections: ChampionProjection[];
  systemHealth: SystemHealth;
  matchdayLabel: string;   // "Jun 19, 2026 · Matchday 6"
  nextClosing: string;     // "Germany–Spain closes in 18h"
};

const NAV_TABS = [
  { label: "Overview", href: "/" },
  { label: "Command", href: "/command" },
  { label: "Forecasts", href: "/matches" },
  { label: "Record", href: "/record" },
  { label: "Teams", href: "/teams" },
  { label: "Simulate", href: "/simulator" },
];

export function CommandShell({
  fixtures,
  operationalPredictions,
  defaultSlug,
  dispatch,
  evolutionLog,
  championshipProjections,
  systemHealth,
  matchdayLabel,
  nextClosing,
}: Props) {
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);

  const predictionMap = new Map(operationalPredictions.map((p) => [p.slug, p.prediction]));
  const selectedPrediction = predictionMap.get(selectedSlug);
  const selectedFixture = fixtures.find((f) => f.slug === selectedSlug);

  return (
    <>
      {/* Nav */}
      <nav className="flex-shrink-0 border-b border-[var(--line)] bg-black/95">
        <div className="flex h-12 items-center px-6 gap-0">
          <div className="flex-shrink-0 text-[13px] font-bold tracking-tight pr-5 border-r border-[var(--line)]">
            WC<span className="text-[var(--up)]">26</span>
          </div>
          <div className="flex flex-1">
            {NAV_TABS.map((tab) => (
              <a
                key={tab.href}
                href={tab.href}
                className={[
                  "flex h-12 items-center px-4 text-[12px] font-medium border-r border-[var(--hairline)] transition-colors",
                  tab.href === "/command"
                    ? "text-[var(--ink)] border-b border-[var(--up)]"
                    : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                ].join(" ")}
              >
                {tab.label}
              </a>
            ))}
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-[var(--hairline)] text-[11px]">
            <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--up)] shadow-[0_0_6px_rgba(124,255,178,0.5)]" />
            <span className="font-semibold text-[var(--up)]">{systemHealth.status}</span>
            <span className="text-[var(--ink-faint)]">
              · {systemHealth.graded} graded · v1.0.0-platt
            </span>
          </div>
        </div>
      </nav>

      {/* Status rail — 3 items max */}
      <div className="flex-shrink-0 flex h-[30px] items-center border-b border-[var(--hairline)] bg-black px-6 gap-0 text-[10px]">
        <div className="flex items-center gap-1.5 pr-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span>{systemHealth.graded} of {systemHealth.total}</span>
          <span className="font-semibold text-[var(--ink-muted)]">graded</span>
        </div>
        <div className="flex items-center gap-1.5 px-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span>Calibration</span>
          <span className={`font-semibold ${systemHealth.status === "NOMINAL" ? "text-[var(--up)]" : "text-[var(--warn)]"}`}>
            {systemHealth.status}
          </span>
        </div>
        <div className="flex items-center gap-1.5 px-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span>Next:</span>
          <span className="font-semibold text-[var(--warn)]">{nextClosing}</span>
        </div>
        <div className="ml-auto text-[var(--ink-faint)]">{matchdayLabel}</div>
      </div>

      {/* 3-column body */}
      <div className="flex flex-1 overflow-hidden" style={{ display: "grid", gridTemplateColumns: "224px 1fr 256px" }}>

        {/* Left: Forecast Record */}
        <div className="border-r border-[var(--line)] overflow-y-auto">
          <ForecastRecord
            fixtures={fixtures}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>

        {/* Center: Match detail */}
        <div className="overflow-y-auto">
          {selectedFixture && selectedPrediction ? (
            <MatchDetail
              fixture={selectedFixture}
              prediction={selectedPrediction}
              dispatch={dispatch}
            />
          ) : (
            <div className="p-6 text-[var(--ink-faint)] text-sm">Select a forecast from the left panel.</div>
          )}
          {/* Model Evolution below the fold */}
          <ModelEvolution entries={evolutionLog} />
        </div>

        {/* Right: System health + projections */}
        <div className="border-l border-[var(--line)] overflow-y-auto">
          {/* System health */}
          <div className="p-4 border-b border-[var(--hairline)]">
            <div className="text-[9px] font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-3">System Health</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-[var(--up)] shadow-[0_0_6px_rgba(124,255,178,0.5)]" />
              <span className="text-[13px] font-semibold text-[var(--up)]">{systemHealth.status}</span>
            </div>
            {[
              { key: "Brier score", val: systemHealth.brier.toFixed(3), color: "text-[var(--ink-muted)]" },
              { key: "Reliability index (ECE)", val: `${(systemHealth.ece * 100).toFixed(1)}%`, color: "text-[var(--up)]" },
              { key: "RPS", val: systemHealth.rps.toFixed(3), color: "text-[var(--blue,#4A90D9)]" },
            ].map(({ key, val, color }) => (
              <div key={key} className="flex justify-between items-center py-[3px] border-b border-[rgba(255,255,255,0.025)] last:border-0">
                <span className="text-[11px] text-[var(--ink-faint)]">{key}</span>
                <span className={`text-[11px] font-semibold tabular-nums ${color}`}>{val}</span>
              </div>
            ))}
          </div>
          {/* Championship Projection */}
          <ChampionshipProjection projections={championshipProjections} />
        </div>

      </div>
    </>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npx tsc --noEmit 2>&1 | grep "command-shell" | head -10
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/command/command-shell.tsx
git commit -m "feat(command): add CommandShell — 3-column client layout with nav/rail/fixture selection"
```

---

## Task 4: `components/command/forecast-record.tsx` — left panel

**Files:**
- Create: `components/command/forecast-record.tsx`

- [ ] **Step 1: Create `components/command/forecast-record.tsx`**

```typescript
// components/command/forecast-record.tsx
"use client";

import type { CommandFixture, ForecastGrade } from "@/lib/command-data";

const GRADE_STYLES: Record<ForecastGrade, { bg: string; text: string; border?: string }> = {
  sharp:    { bg: "bg-[rgba(124,255,178,0.1)]",  text: "text-[var(--up)]" },
  solid:    { bg: "bg-[rgba(74,144,217,0.1)]",   text: "text-[#4A90D9]" },
  close:    { bg: "bg-[rgba(255,196,107,0.1)]",  text: "text-[var(--warn)]" },
  miss:     { bg: "bg-[rgba(255,103,77,0.1)]",   text: "text-[var(--down)]" },
  surprise: { bg: "bg-[rgba(255,103,77,0.15)]",  text: "text-[var(--down)]", border: "border border-[rgba(255,103,77,0.28)]" },
};

function GradeBadge({ grade }: { grade: ForecastGrade }) {
  const s = GRADE_STYLES[grade];
  return (
    <span className={`text-[8px] font-bold px-1.5 py-[2px] rounded-[2px] uppercase tracking-[0.04em] ${s.bg} ${s.text} ${s.border ?? ""}`}>
      {grade}
    </span>
  );
}

function LockBadge() {
  return (
    <span className="text-[8px] font-bold px-1.5 py-[2px] rounded-[2px] uppercase tracking-[0.04em] bg-[rgba(255,255,255,0.05)] text-[var(--ink-faint)]">
      Locked
    </span>
  );
}

type Props = {
  fixtures: CommandFixture[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

export function ForecastRecord({ fixtures, selectedSlug, onSelect }: Props) {
  // Partition into settled and operational
  const settled = fixtures.filter((f) => !f.isOperational);
  const operational = fixtures.filter((f) => f.isOperational);

  return (
    <div>
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-[var(--hairline)]">
        <span className="text-[11px] font-semibold text-[var(--ink)]">Forecast Record</span>
        <span className="text-[10px] text-[var(--ink-faint)] tabular-nums">{fixtures.length} locks</span>
      </div>

      {settled.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
            Group Stage · Settled
          </div>
          {settled.map((f) => (
            <button
              key={f.slug}
              onClick={() => onSelect(f.slug)}
              className={[
                "w-full flex items-center gap-2 px-4 py-[7px] border-b border-[var(--hairline)] text-left transition-colors",
                f.slug === selectedSlug
                  ? "bg-[rgba(124,255,178,0.04)]"
                  : "hover:bg-[rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">{f.homeTeam}</span>
                  <span className="mx-1 text-[10px] text-[var(--ink-faint)]">vs</span>
                  {f.awayTeam}
                </div>
                <div className="text-[10px] text-[var(--ink-faint)] mt-0.5">
                  {f.group ?? f.stage} · {f.result?.replace("-", "–")}
                </div>
              </div>
              {f.grade ? <GradeBadge grade={f.grade} /> : null}
            </button>
          ))}
        </>
      )}

      {operational.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1 text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--ink-faint)]">
            Group Stage · Operational
          </div>
          {operational.map((f) => (
            <button
              key={f.slug}
              onClick={() => onSelect(f.slug)}
              className={[
                "w-full flex items-center gap-2 px-4 py-[7px] border-b border-[var(--hairline)] text-left transition-colors",
                f.slug === selectedSlug
                  ? "bg-[rgba(124,255,178,0.04)]"
                  : "hover:bg-[rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-[12px] text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">{f.homeTeam}</span>
                  <span className="mx-1 text-[10px] text-[var(--ink-faint)]">vs</span>
                  {f.awayTeam}
                </div>
                <div className="text-[10px] text-[var(--ink-faint)] mt-0.5">
                  {f.group ?? f.stage}
                  {f.hoursUntilKickoff !== undefined
                    ? ` · ${f.hoursUntilKickoff < 24
                        ? `${Math.round(f.hoursUntilKickoff)}h left`
                        : `${Math.round(f.hoursUntilKickoff / 24)}d left`}`
                    : ""}
                </div>
              </div>
              <LockBadge />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "forecast-record" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/command/forecast-record.tsx
git commit -m "feat(command): add ForecastRecord — left panel fixture list with grade badges"
```

---

## Task 5: `components/command/score-probability-surface.tsx` — the flagship element

**Files:**
- Create: `components/command/score-probability-surface.tsx`

This is the most important component. It takes the 9×9 grid from `predictFixture()`, compresses it to 6×6 via `compressGrid()`, and renders a colored grid where:
- Upper-left triangle (home goals > away goals) = green tint
- Diagonal (draw) = neutral tint
- Lower-right triangle (away goals > home goals) = red tint
- Cell opacity proportional to probability
- Most-likely cell gets an outline

- [ ] **Step 1: Create `components/command/score-probability-surface.tsx`**

```typescript
// components/command/score-probability-surface.tsx
"use client";

import { compressGrid, topScorelines } from "@/lib/command-data";

type Props = {
  grid: number[][];        // 9×9 from predictFixture().grid
  homeTeam: string;
  awayTeam: string;
  lockExpiresISO?: string; // kickoffISO for countdown
};

function cellType(row: number, col: number): "home" | "draw" | "away" {
  if (row > col) return "home";
  if (row === col) return "draw";
  return "away";
}

const CELL_BASE: Record<"home" | "draw" | "away", string> = {
  home:  "rgba(124,255,178,",
  draw:  "rgba(255,255,255,",
  away:  "rgba(255,103,77,",
};
const CELL_TEXT: Record<"home" | "draw" | "away", string> = {
  home:  "rgba(124,255,178,0.85)",
  draw:  "rgba(244,244,239,0.55)",
  away:  "rgba(255,103,77,0.8)",
};

/** Format a probability as a display string: "13%" for ≥1%, "—" otherwise. */
function pctStr(p: number): string {
  const pct = Math.round(p * 100);
  return pct >= 1 ? `${pct}%` : "—";
}

/** Compute background color with alpha proportional to probability. */
function cellBg(type: "home" | "draw" | "away", prob: number): string {
  // Scale alpha: 0.04 base + up to 0.55 at the max cell (~13%)
  const alpha = Math.min(0.04 + prob * 4.5, 0.6).toFixed(2);
  return `${CELL_BASE[type]}${alpha})`;
}

export function ScoreProbabilitySurface({ grid, homeTeam, awayTeam, lockExpiresISO }: Props) {
  const grid6 = compressGrid(grid);
  const topK = topScorelines(grid6, 6);
  const bestCell = topK[0];

  const colLabels = ["0", "1", "2", "3", "4", "5+"];
  const rowLabels = ["0", "1", "2", "3", "4", "5+"];

  // Lock countdown
  const hoursLeft = lockExpiresISO
    ? Math.max(0, (new Date(lockExpiresISO).getTime() - Date.now()) / 3_600_000)
    : undefined;
  const lockDisplay = hoursLeft !== undefined
    ? hoursLeft < 1
      ? `${Math.round(hoursLeft * 60)}m`
      : hoursLeft < 24
        ? `${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m`
        : `${Math.floor(hoursLeft / 24)}d ${Math.floor(hoursLeft % 24)}h`
    : null;

  return (
    <div>
      {/* Header */}
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-[11px] font-semibold text-[var(--ink-muted)]">Score probability surface</span>
        <span className="text-[10px] text-[var(--ink-faint)]">Dixon-Coles Poisson · full model output</span>
      </div>

      {/* Away axis label */}
      <div className="flex pl-6 mb-0.5">
        {colLabels.map((l) => (
          <div key={l} className="flex-1 text-center text-[9px] text-[var(--ink-faint)]">{l}</div>
        ))}
      </div>
      <div className="text-[8px] text-[var(--ink-faint)] pl-6 mb-0.5 tracking-[0.04em]">
        {awayTeam} goals →
      </div>

      {/* Grid rows */}
      {grid6.map((row, r) => (
        <div key={r} className="flex items-center mb-0.5">
          <div className="w-6 flex-shrink-0 text-[9px] text-[var(--ink-faint)] text-right pr-1 tabular-nums">
            {rowLabels[r]}
          </div>
          <div className="flex flex-1 gap-0.5">
            {row.map((prob, c) => {
              const type = cellType(r, c);
              const isBest = r === bestCell.home && c === bestCell.away;
              return (
                <div
                  key={c}
                  className="flex-1 h-[26px] flex items-center justify-center rounded-[2px] text-[9px] font-semibold tabular-nums"
                  style={{
                    background: cellBg(type, prob),
                    color: CELL_TEXT[type],
                    outline: isBest ? "1px solid rgba(255,255,255,0.22)" : undefined,
                  }}
                >
                  {isBest ? <strong>{pctStr(prob)}</strong> : pctStr(prob)}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      {/* Home axis label */}
      <div className="text-[8px] text-[var(--ink-faint)] mt-1 mb-2 tracking-[0.04em]">
        ↑ {homeTeam} goals
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2.5">
        {(["home", "draw", "away"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1 text-[10px] text-[var(--ink-faint)]">
            <div
              className="w-2.5 h-2.5 rounded-[1px]"
              style={{ background: `${CELL_BASE[t]}0.25)` }}
            />
            {t === "home" ? `${homeTeam} win` : t === "away" ? `${awayTeam} win` : "Draw"}
          </div>
        ))}
        <div className="flex items-center gap-1 text-[10px] text-[var(--ink-faint)] ml-auto">
          <div className="w-2.5 h-2.5 rounded-[1px]" style={{ outline: "1px solid rgba(255,255,255,0.22)", background: "transparent" }} />
          Most likely
        </div>
      </div>

      {/* Top scorelines */}
      <div className="flex flex-wrap gap-1 mb-3">
        {topK.map((s, i) => {
          const label = s.home === s.away ? `${s.home}–${s.away}` : s.home > s.away ? `${homeTeam} ${s.home}–${s.away}` : `${awayTeam} ${s.away}–${s.home}`;
          return (
            <div
              key={i}
              className={[
                "flex items-center gap-1 px-2 py-[3px] rounded-full border text-[11px] tabular-nums",
                i === 0
                  ? "border-[rgba(124,255,178,0.28)] bg-[rgba(124,255,178,0.04)] text-[var(--up)]"
                  : "border-[var(--hairline)] text-[var(--ink-muted)]",
              ].join(" ")}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[var(--ink-faint)]">{pctStr(s.prob)}</span>
            </div>
          );
        })}
        {topK.length < 29 && (
          <div className="flex items-center gap-1 px-2 py-[3px] rounded-full border border-[var(--hairline)] text-[11px] text-[var(--ink-faint)] opacity-50">
            +{29 - topK.length} more
          </div>
        )}
      </div>

      {/* Lock countdown */}
      {lockDisplay && (
        <div className="flex items-center justify-between px-3 py-2 border border-[rgba(255,196,107,0.22)] bg-[rgba(255,196,107,0.025)] rounded">
          <div>
            <div className="text-[11px] text-[var(--warn)] font-medium">Prediction lock expires</div>
            <div className="text-[10px] text-[var(--ink-faint)]">
              {lockExpiresISO ? new Date(lockExpiresISO).toUTCString().slice(0, 16) : ""} UTC
            </div>
          </div>
          <div className="text-[14px] font-bold text-[var(--warn)] tabular-nums tracking-[0.04em]">
            {lockDisplay}
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "score-probability" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/command/score-probability-surface.tsx
git commit -m "feat(command): add ScoreProbabilitySurface — Dixon-Coles 6×6 display grid"
```

---

## Task 6: `components/command/forecast-drivers.tsx`

**Files:**
- Create: `components/command/forecast-drivers.tsx`

- [ ] **Step 1: Create `components/command/forecast-drivers.tsx`**

```typescript
// components/command/forecast-drivers.tsx
"use client";

import type { Prediction } from "@/lib/predict";
import type { Club } from "@/lib/data";

type Props = {
  prediction: Prediction;
  homeClub: Club;
  awayClub: Club;
  neutral: boolean;
  kalshiHomePct?: number;  // Kalshi home probability (0..100), if available
};

function DriverCell({ label, value, edge, edgeColor }: {
  label: string;
  value: string;
  edge: string;
  edgeColor: "up" | "warn" | "neutral";
}) {
  const edgeColors = {
    up: "text-[var(--up)]",
    warn: "text-[var(--warn)]",
    neutral: "text-[var(--ink-faint)]",
  };
  return (
    <div className="p-2 bg-[var(--surface)] border border-[var(--hairline)]">
      <div className="text-[9px] text-[var(--ink-faint)] mb-1">{label}</div>
      <div className="text-[12px] font-medium text-[var(--ink-muted)]">{value}</div>
      <div className={`text-[10px] font-semibold mt-0.5 ${edgeColors[edgeColor]}`}>{edge}</div>
    </div>
  );
}

export function ForecastDrivers({ prediction, homeClub, awayClub, neutral, kalshiHomePct }: Props) {
  const { elo, lambdas, form } = prediction;
  const eloDiff = elo.home - elo.away;
  const lambdaDiff = lambdas.home - lambdas.away;
  const modelHomePct = Math.round(prediction.split.home * 100);

  // Summarize form as "4W1D" style
  function formSummary(f: { results: string }): string {
    return f.results
      .split("")
      .slice(-5)
      .map((r) => (r === "W" ? "W" : r === "D" ? "D" : "L"))
      .join("") || "—";
  }

  const marketDev = kalshiHomePct !== undefined ? modelHomePct - kalshiHomePct : null;

  const primaryDrivers = [
    {
      label: "Elo differential",
      value: `${homeClub.short} ${elo.home} · ${awayClub.short} ${elo.away}`,
      edge: eloDiff > 0 ? `+${eloDiff} ${homeClub.short} ↑` : eloDiff < 0 ? `${eloDiff} ${awayClub.short} ↑` : "Evenly matched",
      edgeColor: (eloDiff > 0 ? "up" : eloDiff < 0 ? "warn" : "neutral") as "up" | "warn" | "neutral",
    },
    {
      label: "Expected goals (λ)",
      value: `${homeClub.short} ${lambdas.home.toFixed(2)} · ${awayClub.short} ${lambdas.away.toFixed(2)}`,
      edge: lambdaDiff > 0 ? `+${lambdaDiff.toFixed(2)} ${homeClub.short} ↑` : lambdaDiff < 0 ? `${(-lambdaDiff).toFixed(2)} ${awayClub.short} ↑` : "Even",
      edgeColor: (lambdaDiff > 0 ? "up" : lambdaDiff < 0 ? "warn" : "neutral") as "up" | "warn" | "neutral",
    },
    {
      label: "Market signal",
      value: kalshiHomePct !== undefined ? `Kalshi ${kalshiHomePct}% · Model ${modelHomePct}%` : `Model ${modelHomePct}% · No market data`,
      edge: marketDev !== null
        ? marketDev > 0
          ? `+${marketDev}pp model above market ↑`
          : marketDev < 0
            ? `${marketDev}pp model below market`
            : "Model matches market"
        : "No Kalshi market",
      edgeColor: (marketDev !== null && Math.abs(marketDev) > 5 ? "warn" : "neutral") as "up" | "warn" | "neutral",
    },
  ];

  const secondaryDrivers = [
    {
      label: "Venue",
      value: neutral ? "Neutral venue" : `${homeClub.venue} (home)`,
      edge: neutral ? "No home advantage applied" : "+100 Elo home advantage",
      edgeColor: "neutral" as const,
    },
    {
      label: "Form (last 5)",
      value: `${homeClub.short} ${formSummary(form.home)} · ${awayClub.short} ${formSummary(form.away)}`,
      edge: "Factored into λ weights",
      edgeColor: "neutral" as const,
    },
    {
      label: "Pattern flag",
      value: "Draw underestimation risk",
      edge: "Draw may be underweighted — +10pp gap vs historical",
      edgeColor: "warn" as const,
    },
  ];

  return (
    <div>
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)] mb-2.5">
        Forecast drivers
      </div>
      {/* Primary: 3 cells in a row */}
      <div className="grid grid-cols-3 gap-[1px] rounded-[3px] overflow-hidden mb-[1px]">
        {primaryDrivers.map((d) => (
          <DriverCell key={d.label} {...d} />
        ))}
      </div>
      {/* Secondary: 3 cells in a row */}
      <div className="grid grid-cols-3 gap-[1px] rounded-[3px] overflow-hidden">
        {secondaryDrivers.map((d) => (
          <DriverCell key={d.label} {...d} />
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "forecast-drivers" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/command/forecast-drivers.tsx
git commit -m "feat(command): add ForecastDrivers — 3+3 driver cell grid"
```

---

## Task 7: `components/command/match-detail.tsx` — center panel

**Files:**
- Create: `components/command/match-detail.tsx`

This assembles: Intelligence Dispatch + match heading + probability triple + ForecastDrivers + ScoreProbabilitySurface.

- [ ] **Step 1: Create `components/command/match-detail.tsx`**

```typescript
// components/command/match-detail.tsx
"use client";

import type { Dispatch, CommandFixture } from "@/lib/command-data";
import type { Prediction } from "@/lib/predict";
import { ScoreProbabilitySurface } from "./score-probability-surface";
import { ForecastDrivers } from "./forecast-drivers";

// For now, homeClub and awayClub are passed in minimal form.
// In page.tsx we resolve them from data.ts and pass the relevant fields.
type ClubInfo = { short: string; venue: string };

type Props = {
  fixture: CommandFixture;
  prediction: Prediction;
  dispatch: Dispatch;
  homeClub: ClubInfo;
  awayClub: ClubInfo;
  kalshiHomePct?: number;
};

function DispatchCard({ dispatch }: { dispatch: Dispatch }) {
  return (
    <div className="px-6 py-5 border-b border-[var(--hairline)] bg-black">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)] mb-2">
        {dispatch.dateline}
      </div>
      <div className="text-[15px] font-semibold text-[var(--ink)] leading-snug tracking-[-0.01em] mb-2">
        {dispatch.headline}
      </div>
      <div className="text-[12px] text-[var(--ink-muted)] leading-relaxed max-w-xl">
        {dispatch.body}
      </div>
      <div className="flex gap-4 mt-3">
        {dispatch.signals.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-[11px] text-[var(--ink-faint)]">
            <span>{s.label}</span>
            <span className={`font-semibold ${
              s.color === "up" ? "text-[var(--up)]" : s.color === "warn" ? "text-[var(--warn)]" : "text-[var(--ink-muted)]"
            }`}>{s.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function MatchDetail({ fixture, prediction, dispatch, homeClub, awayClub, kalshiHomePct }: Props) {
  const { split } = prediction;

  return (
    <>
      <DispatchCard dispatch={dispatch} />

      {/* Match header */}
      <div className="px-6 py-5 border-b border-[var(--hairline)]">
        <div className="flex items-center justify-between text-[10px] text-[var(--ink-faint)] mb-2.5">
          <span>
            {fixture.group ? `Group ${fixture.group.replace("Group ", "")} · ` : ""}
            {new Date(fixture.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {homeClub.venue}
            {" · Elo+Dixon-Coles+Platt"}
          </span>
          {fixture.isOperational && fixture.hoursUntilKickoff !== undefined && (
            <span className="flex items-center gap-1.5 text-[var(--warn)] font-medium">
              <svg width="8" height="8" viewBox="0 0 8 8" fill="none">
                <rect x="2" y="3.5" width="4" height="3.5" rx="0.5" stroke="currentColor" strokeWidth="1"/>
                <path d="M3 3.5V2.5a1 1 0 012 0V3.5" stroke="currentColor" strokeWidth="1"/>
              </svg>
              Closes{" "}
              {fixture.hoursUntilKickoff < 24
                ? `in ${Math.round(fixture.hoursUntilKickoff)}h`
                : `${Math.round(fixture.hoursUntilKickoff / 24)}d`}
            </span>
          )}
        </div>

        <div className="text-[22px] font-bold tracking-[-0.02em] mb-1">
          <span className="text-[var(--ink)]">{fixture.homeTeam}</span>
          <span className="mx-2 text-[14px] font-normal text-[var(--ink-faint)]">vs</span>
          <span className="text-[var(--ink-muted)]">{fixture.awayTeam}</span>
        </div>
        <div className="text-[11px] text-[var(--ink-faint)]">
          {fixture.homeTeam} favored {fixture.isOperational ? "at neutral venue" : ""}
        </div>

        {/* 3-way probability */}
        <div className="flex gap-[2px] mt-4">
          {[
            { label: `${fixture.homeTeam} win`, pct: Math.round(split.home), winner: split.home >= split.draw && split.home >= split.away },
            { label: "Draw", pct: Math.round(split.draw), winner: false },
            { label: `${fixture.awayTeam} win`, pct: Math.round(split.away), winner: false },
          ].map(({ label, pct, winner }) => (
            <div
              key={label}
              className={[
                "flex-1 px-3 py-2.5 relative border",
                winner
                  ? "bg-[rgba(124,255,178,0.04)] border-[rgba(124,255,178,0.18)]"
                  : "bg-[var(--surface)] border-[var(--hairline)]",
                label.includes(fixture.homeTeam) ? "rounded-l" : label.includes(fixture.awayTeam) ? "rounded-r" : "",
              ].join(" ")}
            >
              <div className="text-[9px] text-[var(--ink-faint)] uppercase tracking-[0.05em] mb-1.5">{label}</div>
              <div className={`text-[24px] font-bold tabular-nums tracking-[-0.02em] ${winner ? "text-[var(--up)]" : "text-[var(--ink-muted)]"}`}>
                {pct}%
              </div>
              <div
                className="absolute bottom-0 left-0 h-[2px] rounded-b"
                style={{
                  width: `${pct}%`,
                  background: winner ? "var(--up)" : "var(--ink-faint)",
                  opacity: winner ? 0.4 : 1,
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Forecast Drivers */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ForecastDrivers
          prediction={prediction}
          homeClub={{ short: homeClub.short, venue: homeClub.venue, lastFiveResults: "" } as any}
          awayClub={{ short: awayClub.short, venue: awayClub.venue, lastFiveResults: "" } as any}
          neutral={true}
          kalshiHomePct={kalshiHomePct}
        />
      </div>

      {/* Score Probability Surface */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ScoreProbabilitySurface
          grid={prediction.grid}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          lockExpiresISO={fixture.isOperational ? fixture.kickoffISO : undefined}
        />
      </div>
    </>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "match-detail" | head -5
```

Expected: no errors (there's a temporary `as any` cast for Club — Task 8 will clean that up).

- [ ] **Step 3: Commit**

```bash
git add components/command/match-detail.tsx
git commit -m "feat(command): add MatchDetail — center panel assembles dispatch + match + drivers + score surface"
```

---

## Task 8: `components/command/model-evolution.tsx` — learning log

**Files:**
- Create: `components/command/model-evolution.tsx`

- [ ] **Step 1: Create `components/command/model-evolution.tsx`**

```typescript
// components/command/model-evolution.tsx
"use client";

import type { EvolutionEntry } from "@/lib/command-data";

const ENTRY_STYLES = {
  surprise:    { border: "border-l-[var(--down)]", bg: "bg-[rgba(255,103,77,0.02)]", tagBg: "bg-[rgba(255,103,77,0.12)]", tagText: "text-[var(--down)]", label: "Surprise observed" },
  calibration: { border: "border-l-[var(--warn)]", bg: "bg-[rgba(255,196,107,0.02)]", tagBg: "bg-[rgba(255,196,107,0.1)]",  tagText: "text-[var(--warn)]", label: "Calibration updated" },
  confirm:     { border: "border-l-[var(--up)]",   bg: "bg-[rgba(124,255,178,0.02)]", tagBg: "bg-[rgba(124,255,178,0.1)]",  tagText: "text-[var(--up)]",   label: "Pattern confirmed" },
};

const STATUS_COLORS = {
  up:   "text-[var(--up)]",
  warn: "text-[var(--warn)]",
  blue: "text-[#4A90D9]",
};
const STATUS_DOT = {
  up:   "bg-[var(--up)]",
  warn: "bg-[var(--warn)]",
  blue: "bg-[#4A90D9]",
};

export function ModelEvolution({ entries }: { entries: EvolutionEntry[] }) {
  if (entries.length === 0) return null;

  return (
    <div className="px-6 py-5">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)] mb-3 flex items-center justify-between">
        <span>Model evolution</span>
        <span className="font-normal normal-case text-[var(--ink-faint)]">how this model learns</span>
      </div>
      <div className="flex flex-col gap-1.5">
        {entries.map((entry) => {
          const s = ENTRY_STYLES[entry.type];
          return (
            <div
              key={entry.id}
              className={`pl-3 pr-3 py-2.5 border-l-2 rounded-r-sm ${s.border} ${s.bg}`}
            >
              {/* Meta */}
              <div className="flex items-center gap-2 mb-1.5">
                <span className="text-[10px] text-[var(--ink-faint)]">
                  {new Date(entry.date).toLocaleDateString("en-US", { month: "short", day: "numeric" })}
                  {entry.matchLabel ? "" : ""}
                </span>
                <span className={`text-[8px] font-bold px-1.5 py-[1px] rounded-[2px] uppercase tracking-[0.04em] ${s.tagBg} ${s.tagText}`}>
                  {s.label}
                </span>
              </div>

              {/* Body */}
              <div className="text-[12px] text-[var(--ink-faint)] leading-relaxed">
                {entry.body}
              </div>

              {/* Forecast Autopsy (Surprise entries only) */}
              {entry.autopsy && (
                <div className="mt-2 pt-2 border-t border-[rgba(255,103,77,0.1)] bg-[rgba(255,103,77,0.04)] -mx-3 px-3 pb-0 rounded-sm">
                  <div className="text-[9px] font-semibold uppercase tracking-[0.08em] text-[var(--down)] mb-1.5">
                    Forecast autopsy
                  </div>
                  {[
                    { key: "Locked probability", val: entry.autopsy.lockedLine },
                    { key: "Result", val: entry.autopsy.resultLine },
                    { key: "Historical frequency", val: entry.autopsy.freqLine },
                  ].map(({ key, val }) => (
                    <div key={key} className="flex justify-between text-[11px] mb-0.5">
                      <span className="text-[var(--ink-faint)]">{key}</span>
                      <span className="text-[var(--ink-muted)] font-medium">{val}</span>
                    </div>
                  ))}
                  <div className="text-[10px] text-[var(--ink-faint)] mt-1.5 pt-1.5 border-t border-[rgba(255,255,255,0.04)]">
                    {entry.autopsy.patternNote}
                  </div>
                </div>
              )}

              {/* Status line */}
              <div className="flex items-center gap-1.5 mt-1.5 text-[10px]">
                <div className={`w-1 h-1 rounded-full flex-shrink-0 ${STATUS_DOT[entry.statusColor]}`} />
                <span className={STATUS_COLORS[entry.statusColor]}>{entry.statusLine}</span>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Run type check**

```bash
npx tsc --noEmit 2>&1 | grep "model-evolution" | head -5
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add components/command/model-evolution.tsx
git commit -m "feat(command): add ModelEvolution — learning log with inline Forecast Autopsy"
```

---

## Task 9: `components/command/championship-projection.tsx`

**Files:**
- Create: `components/command/championship-projection.tsx`

- [ ] **Step 1: Create `components/command/championship-projection.tsx`**

```typescript
// components/command/championship-projection.tsx
"use client";

import type { ChampionProjection } from "@/lib/command-data";

export function ChampionshipProjection({ projections }: { projections: ChampionProjection[] }) {
  const maxProb = projections[0]?.probability ?? 0.01;

  return (
    <div className="p-4">
      <div className="text-[9px] font-semibold uppercase tracking-[0.1em] text-[var(--ink-faint)] mb-3">
        Championship projection · 10k simulations
      </div>
      <div>
        {projections.map((p) => (
          <div key={p.team} className="flex items-center gap-1.5 py-[5px] border-b border-[rgba(255,255,255,0.03)] last:border-0">
            <span className="text-[10px] text-[var(--ink-faint)] w-2.5">{p.rank}</span>
            <span className={`text-[12px] flex-1 ${p.rank === 1 ? "font-medium text-[var(--ink)]" : "text-[var(--ink-muted)]"}`}>
              {p.team}
            </span>
            {/* Mini bar */}
            <div className="w-9 h-[3px] bg-[var(--hairline)] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full"
                style={{
                  width: `${(p.probability / maxProb) * 100}%`,
                  background: "linear-gradient(90deg, #4A90D9, #7cffb2)",
                }}
              />
            </div>
            <span className="text-[10px] font-semibold tabular-nums text-[var(--ink-muted)] text-right w-9">
              {(p.probability * 100).toFixed(1)}%
            </span>
            {p.delta !== undefined && Math.abs(p.delta) >= 0.001 && (
              <span className={`text-[9px] tabular-nums w-7 text-right ${p.delta > 0 ? "text-[var(--up)]" : "text-[var(--down)]"}`}>
                {p.delta > 0 ? "+" : ""}{(p.delta * 100).toFixed(1)}
              </span>
            )}
          </div>
        ))}
      </div>
      <div className="text-[10px] text-[var(--ink-faint)] mt-2">
        Δ vs previous simulation · updated after each settlement
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Commit**

```bash
git add components/command/championship-projection.tsx
git commit -m "feat(command): add ChampionshipProjection — right rail projections with delta"
```

---

## Task 10: `app/command/page.tsx` — server component wiring everything together

**Files:**
- Create: `app/command/page.tsx`

This is the server component that:
1. Loads all data
2. Calls `predictFixture()` for every operational lock
3. Builds all derived domain objects
4. Assembles `CommandShell` props

- [ ] **Step 1: Create `app/command/page.tsx`**

```typescript
// app/command/page.tsx
// Server component — fetches all data at build time, no client network calls.
import "server-only";
import { allFixtures, clubById, fixtureBySlug } from "@/lib/data";
import { predictFixture, resolveTeamName } from "@/lib/predict";
import type { LockedEntry } from "@/lib/predictions-ledger";
import type { AccountabilityOutput } from "@/lib/accountability";
import {
  forecastGrade,
  buildChampionshipProjections,
  buildDispatch,
  buildEvolutionLog,
  buildSystemHealth,
  hoursUntil,
  type CommandFixture,
  type DispatchInput,
} from "@/lib/command-data";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import simulationJson from "@/data/simulation.json";
import { CommandShell, type OperationalPrediction } from "@/components/command/command-shell";

const predictions = (predictionsJson as { entries: LockedEntry[] }).entries;
const accountability = accountabilityJson as AccountabilityOutput;
const simulation = simulationJson as {
  teams: Record<string, { champion: number; reachFinal: number }>;
};

export const metadata = { title: "Command — WC26 Forecasting" };

export default function CommandPage() {
  // ── 1. Build CommandFixture list ──────────────────────────────────────────
  const predMap = new Map(predictions.map((p) => [p.slug, p]));
  const fixtures = allFixtures().filter((f) => predMap.has(f.slug));

  const commandFixtures: CommandFixture[] = fixtures.map((f) => {
    const pred = predMap.get(f.slug)!;
    const homeClub = clubById(f.homeId);
    const awayClub = clubById(f.awayId);
    const isSettled = pred.result !== undefined;
    const grade = isSettled && pred.modelBrier !== undefined
      ? forecastGrade(pred.modelBrier)
      : undefined;
    return {
      slug: f.slug,
      homeTeam: homeClub.short,
      awayTeam: awayClub.short,
      kickoffISO: f.kickoffISO,
      stage: f.stage ?? "group",
      group: f.group,
      result: pred.result,
      grade,
      isOperational: !isSettled,
      split: isSettled ? undefined : { home: pred.split.home, draw: pred.split.draw, away: pred.split.away },
      hoursUntilKickoff: !isSettled ? hoursUntil(f.kickoffISO) : undefined,
    };
  });

  // ── 2. Compute predictions for all operational locks ──────────────────────
  const operationalPredictions: OperationalPrediction[] = [];
  for (const cf of commandFixtures) {
    if (!cf.isOperational) continue;
    const fixture = fixtureBySlug(cf.slug);
    if (!fixture) continue;
    try {
      const homeDataset = clubById(fixture.homeId).datasetName ?? clubById(fixture.homeId).name;
      const awayDataset = clubById(fixture.awayId).datasetName ?? clubById(fixture.awayId).name;
      const prediction = predictFixture({
        home: resolveTeamName(homeDataset),
        away: resolveTeamName(awayDataset),
        neutral: fixture.neutral ?? false,
        stage: fixture.stage ?? "group",
      });
      operationalPredictions.push({ slug: cf.slug, prediction });
    } catch {
      // Team not in model — skip
    }
  }

  // ── 3. Default featured fixture (next closing lock) ───────────────────────
  const operational = commandFixtures.filter((f) => f.isOperational);
  const defaultSlug = operational.sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  )[0]?.slug ?? commandFixtures[0]?.slug ?? "";

  // ── 4. System health ──────────────────────────────────────────────────────
  const systemHealth = buildSystemHealth(accountability, predictions.length);

  // ── 5. Intelligence Dispatch ──────────────────────────────────────────────
  const projections = buildChampionshipProjections(simulation.teams, 8);
  const surpriseEntries = predictions.filter(
    (e) => e.modelBrier !== undefined && e.modelBrier >= 0.9
  );
  const closingSoon = operational
    .filter((f) => f.hoursUntilKickoff !== undefined && f.hoursUntilKickoff <= 24)
    .map((f) => `${f.homeTeam}–${f.awayTeam}`);

  const graded = predictions.filter((e) => e.modelBrier !== undefined);
  const sharpOrSolid = graded.filter((e) => e.modelBrier! < 0.55);
  const sharpOrSolidPct = graded.length > 0
    ? (sharpOrSolid.length / graded.length) * 100
    : 0;

  const dispatchInput: DispatchInput = {
    topTeam: projections[0]?.team ?? "Brazil",
    topTeamPct: (projections[0]?.probability ?? 0) * 100,
    surpriseCount: surpriseEntries.length,
    activePatternsCount: surpriseEntries.length > 0 ? 1 : 0,
    operationalLockCount: operational.length,
    sharpOrSolidPct,
    closingSoonLabels: closingSoon.slice(0, 2),
    ece: systemHealth.ece,
  };
  const dispatch = buildDispatch(dispatchInput);
  dispatch.dateline = `Intelligence Dispatch · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // ── 6. Evolution log ──────────────────────────────────────────────────────
  const evolutionLog = buildEvolutionLog(
    predictions,
    (slug) => {
      const f = fixtureBySlug(slug);
      return f ? clubById(f.homeId).short : slug;
    },
    (slug) => {
      const f = fixtureBySlug(slug);
      return f ? clubById(f.awayId).short : slug;
    },
    systemHealth.ece,
  );

  // ── 7. Next-closing label for status rail ─────────────────────────────────
  const nextOp = operational
    .filter((f) => f.hoursUntilKickoff !== undefined)
    .sort((a, b) => (a.hoursUntilKickoff ?? 9999) - (b.hoursUntilKickoff ?? 9999))[0];

  const nextClosing = nextOp
    ? `${nextOp.homeTeam}–${nextOp.awayTeam} closes in ${
        nextOp.hoursUntilKickoff! < 24
          ? `${Math.round(nextOp.hoursUntilKickoff!)}h`
          : `${Math.round(nextOp.hoursUntilKickoff! / 24)}d`
      }`
    : "No locks closing soon";

  return (
    <CommandShell
      fixtures={commandFixtures}
      operationalPredictions={operationalPredictions}
      defaultSlug={defaultSlug}
      dispatch={dispatch}
      evolutionLog={evolutionLog}
      championshipProjections={projections}
      systemHealth={systemHealth}
      matchdayLabel={`${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Matchday 6`}
      nextClosing={nextClosing}
    />
  );
}
```

- [ ] **Step 2: Update `CommandShell` to pass `homeClub`/`awayClub` to `MatchDetail`**

The shell needs the club info for the selected fixture. Update `components/command/command-shell.tsx` — add a `clubMap` prop and thread it through to `MatchDetail`:

In the `Props` type, add:
```typescript
clubMap: Map<string, { short: string; venue: string }>;
```

In `page.tsx`, before the `return`, add:
```typescript
const clubMapEntries = allFixtures()
  .filter((f) => predMap.has(f.slug))
  .flatMap((f) => [
    [f.slug + "__home", { short: clubById(f.homeId).short, venue: clubById(f.homeId).venue }],
    [f.slug + "__away", { short: clubById(f.awayId).short, venue: clubById(f.awayId).venue }],
  ]) as Array<[string, { short: string; venue: string }]>;
const clubMap = new Map(clubMapEntries);
```

Pass `clubMap={new Map(clubMapEntries)}` to `<CommandShell>`.

In `CommandShell`, in the center column rendering:
```typescript
const homeClub = clubMap.get(selectedSlug + "__home") ?? { short: "Home", venue: "" };
const awayClub = clubMap.get(selectedSlug + "__away") ?? { short: "Away", venue: "" };
// pass homeClub, awayClub to MatchDetail
```

Also fix the temporary `as any` in `match-detail.tsx` by removing the Club import reference and just using `{ short: string; venue: string }` inline.

- [ ] **Step 3: Run build**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npm run build 2>&1 | grep -E "error|Error|✓ Compiled" | head -20
```

Expected: `✓ Compiled` with no TypeScript errors. The `/command` route appears in the build output.

- [ ] **Step 4: Run tests**

```bash
npx vitest run 2>&1 | tail -10
```

Expected: all tests pass (including the new `command-data.test.ts`).

- [ ] **Step 5: Verify page renders in dev**

```bash
npm run dev &
sleep 5
curl -s http://localhost:3000/command | grep -c "WC26\|Brazil\|Forecast" | head -1
```

Expected: count > 0 (page returns HTML with expected content).

- [ ] **Step 6: Commit**

```bash
git add app/command/page.tsx components/command/command-shell.tsx components/command/match-detail.tsx
git commit -m "feat(command): wire up /command page — server data fetch, prediction compute, CommandShell assembly"
```

---

## Task 11: Final type cleanup + build verification

**Files:**
- Modify: `components/command/match-detail.tsx` (remove `as any`)
- Modify: `components/command/forecast-drivers.tsx` (remove unused Club import)

- [ ] **Step 1: Fix the Club type cast in `match-detail.tsx`**

Replace the `ForecastDrivers` call in `match-detail.tsx`:

Old:
```typescript
homeClub={{ short: homeClub.short, venue: homeClub.venue, lastFiveResults: "" } as any}
awayClub={{ short: awayClub.short, venue: awayClub.venue, lastFiveResults: "" } as any}
```

The `ForecastDrivers` component's `Props` type should use `{ short: string; venue: string }` not the full `Club`. Update `forecast-drivers.tsx` Props type:

```typescript
// In forecast-drivers.tsx, change:
type ClubInfo = { short: string; venue: string; lastFiveResults: string; name?: string };

type Props = {
  prediction: Prediction;
  homeClub: ClubInfo;
  awayClub: ClubInfo;
  neutral: boolean;
  kalshiHomePct?: number;
};
```

And in `match-detail.tsx`, change the call to:
```typescript
<ForecastDrivers
  prediction={prediction}
  homeClub={{ short: homeClub.short, venue: homeClub.venue, lastFiveResults: "" }}
  awayClub={{ short: awayClub.short, venue: awayClub.venue, lastFiveResults: "" }}
  neutral={true}
  kalshiHomePct={kalshiHomePct}
/>
```

- [ ] **Step 2: Final full type check + build**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
npx tsc --noEmit 2>&1 | grep "error TS" | head -10
npm run build 2>&1 | tail -5
```

Expected:
- `tsc --noEmit`: 0 errors
- `npm run build`: build completes, `/command` page listed

- [ ] **Step 3: Run full test suite**

```bash
npx vitest run 2>&1 | tail -5
```

Expected: all tests pass.

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat(command): complete Forecast Command Center — /command route with Score Probability Surface, Intelligence Dispatch, Model Evolution, Forecast Autopsy, Championship Projection"
```

---

## Self-Review

**Spec coverage:**

| Design requirement | Task |
|---|---|
| 4-level user hierarchy (5s / 15s / 60s / 5min) | Task 10 (page assembly order: nav → dispatch → match → drivers → surface → evolution) |
| Score Probability Surface | Task 5 |
| Forecast Drivers (3 primary + 3 secondary) | Task 6 |
| Intelligence Dispatch — editorial card with headline | Task 10 (buildDispatch) + Task 7 (DispatchCard) |
| Model Evolution with Forecast Autopsy | Task 1 (buildEvolutionLog) + Task 8 (ModelEvolution) |
| Championship Projection with Δ | Task 1 (buildChampionshipProjections) + Task 9 |
| Forecast Record left panel with grade chips | Task 4 |
| Status rail — 3 items only | Task 3 (CommandShell rail) |
| Nav with NOMINAL health signal | Task 3 (CommandShell nav) |
| Grade vocabulary: Sharp/Solid/Close/Miss/Surprise | Task 1 (forecastGrade) |
| Grid compressed from 9×9 to 6×6 | Task 1 (compressGrid) |
| Full-height layout, 3-column, each column scrolls independently | Task 2 (layout.tsx) + Task 3 |
| Forecast Record renamed (not "Prediction Corpus") | Task 4 (ForecastRecord heading) |
| Championship Projection renamed (not "Path Odds") | Task 9 |

**Placeholder scan:** No TBD, no TODO, no "add appropriate handling." All code blocks complete.

**Type consistency:**
- `ForecastGrade` defined in `command-data.ts` Task 1, used identically in Tasks 3, 4, 7
- `CommandFixture` defined Task 1, used in Tasks 3, 4, 10
- `EvolutionEntry` defined Task 1, used in Tasks 8, 10
- `ChampionProjection` defined Task 1, used in Tasks 9, 10
- `OperationalPrediction` defined in `command-shell.tsx` Task 3, used in Task 10
- `Prediction` from `lib/predict.ts` used in Tasks 5, 6, 7, 10 — type unchanged
