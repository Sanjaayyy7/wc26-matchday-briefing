# Design Transformation — Phase 3: Record (Accountability Ledger) Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Keep the spec open: `docs/superpowers/specs/2026-06-19-wc26-design-transformation.md` §"Page 2: Record" (lines ~502–633). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rewrite `app/record/page.tsx`'s presentation into the spec's Record hierarchy (status rail → hero → 5-metric strip → 2×2 intelligence cards → reliability diagram → sortable settlement table → team breakdown), consuming the P1 primitives (`IntelligenceCard`, `BrierBar`, `VerdictChip`) and the spec's prose/number/motion rules.

**Architecture:** The existing `app/record/page.tsx` already computes every datum needed (`agg`, `ece`, `meanLogLoss`, `official.rows`, `calibrationBins`, per-team stats, `informational`, `open`, `caveats`). Keep the data layer + `WCS26Shell` wrapper; replace the rail signals, the "Sample warning" + "At a glance" 9-metric grid (→ hero + 5-metric strip + intelligence cards), and the "Settled calls" grid (→ a sortable `SettlementTable` client component). Keep the calibration diagram, team breakdown, informational, open-calls, and caveats sections (small-sample honesty is a spec requirement).

**Tech Stack:** Next.js 16.2.6, React 19, Tailwind v4, P1 primitives, `NumberTicker`, `CalibrationChart`, `vitest`.

## Global Constraints

- Hybrid premium-within-system: institutional/anti-glass, house tokens, inspector-clean (no raw hex in tsx; no arbitrary `text-[..px]`/`gap-[..px]`/`border-[..px]` — Tailwind scale or `var()` only; `data-mono`/`tabular` on numerics; `duration-300` motion only; no glow/blur/gradient; no `bg-[var(--surface)]`/`rounded-2xl` **in the page file** — components may use surface).
- Number rules (spec §2): `tabular-nums` everywhere; Brier/RPS/log-loss 3 decimals; ECE 1 decimal percent; probabilities integer; H/D/A as `64 / 23 / 13`.
- Prose rules (spec §2): analytical voice; mandatory `n<30` small-sample caveat; banned words: amazing/best/sophisticated/powerful.
- Page-shell rule (design-inspector): page MUST keep `<WCS26Shell>` + `<RouteStack>` + `<CanvasSection>`.
- Don't fabricate metrics: if a datum is absent, render `—`, never invent.
- Internal links use `next/link` `<Link>`, never `<a href>` (lint: `no-html-link-for-pages`).
- Next 16.2.6 — read `node_modules/next/dist/docs/` before edits. Run all commands from `app/`.

## Verified available data (already in `app/record/page.tsx`)

`agg` {n, accuracy, meanBrier, meanRps, vsKalshi{n,modelBrier,marketBrier,edge}}; `ece` (computed); `meanLogLoss` (computed); `official.rows[]` each {slug, locked{home,draw,away}, actual, grades{modelBrier, modelRps, correctPick}, verdict ("hit"|"close"|"miss"), kalshi?{brier,rps}}; `calibrationBins[]`; `informational.rows[]`; `open[]`; `caveats[]`. Match names via `fixtureBySlug(slug)` + `clubById`. Per-row date via `fixtureBySlug(slug).kickoffISO`. Current values: n=21, accuracy=0.476, meanBrier=0.721, meanRps=0.221, ece≈0.021, vsKalshi.edge=−0.196 (n=1).

---

### Task 1: Sortable-settlement comparator (pure logic, TDD)

**Files:**
- Create: `lib/settlement-sort.ts`
- Test: `tests/settlement-sort.test.ts`

**Interfaces produced:**
- `type SettlementSortKey = "date" | "brier"`
- `type SortDir = "asc" | "desc"`
- `sortSettlements<T extends { brier: number; kickoffMs: number }>(rows: T[], key: SettlementSortKey, dir: SortDir): T[]` — pure, returns a new array; never mutates input.

- [ ] **Step 1: Write the failing test** — `tests/settlement-sort.test.ts`:

```ts
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
```

- [ ] **Step 2: Run, verify it fails** — `npx vitest run tests/settlement-sort.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/settlement-sort.ts`:

```ts
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
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run tests/settlement-sort.test.ts` → 4 passed.

- [ ] **Step 5: Commit** — `git add lib/settlement-sort.ts tests/settlement-sort.test.ts && git commit -m "feat(record): add pure sortSettlements comparator (TDD)"`

---

### Task 2: `SettlementTable` client component (sortable, P1 primitives)

**Files:**
- Create: `components/settlement-table.tsx`

**Interfaces:**
- Consumes: `sortSettlements`, `SettlementSortKey`, `SortDir` (Task 1); `BrierBar` (`components/brier-bar.tsx`); `VerdictChip` (`components/verdict-chip.tsx`); `Verdict` (`@/lib/kit-color`).
- Produces: `SettlementTable({ rows }: { rows: SettlementTableRow[] })` and `type SettlementTableRow = { slug: string; matchName: string; context: string; result: string; brier: number; rps: number; verdict: Verdict; kickoffMs: number }`.

Spec L6 + interaction model + mobile adaptation: columns Fixture / Result / Brier(+BrierBar) / RPS / Verdict; default sort date desc; clicking the Brier header toggles brier asc/desc; mobile hides the RPS column.

- [ ] **Step 1: Implement** — `components/settlement-table.tsx`:

```tsx
"use client";

import { useState } from "react";
import Link from "next/link";
import { BrierBar } from "./brier-bar";
import { VerdictChip } from "./verdict-chip";
import { sortSettlements, type SortDir } from "@/lib/settlement-sort";
import type { Verdict } from "@/lib/kit-color";

export type SettlementTableRow = {
  slug: string;
  matchName: string;
  context: string;
  result: string;
  brier: number;
  rps: number;
  verdict: Verdict;
  kickoffMs: number;
};

export function SettlementTable({ rows }: { rows: SettlementTableRow[] }) {
  const [brierSort, setBrierSort] = useState<SortDir | null>(null);
  const sorted =
    brierSort === null
      ? sortSettlements(rows, "date", "desc")
      : sortSettlements(rows, "brier", brierSort);
  const arrow = brierSort === "asc" ? "↑" : brierSort === "desc" ? "↓" : "";

  return (
    <div className="flex flex-col">
      <div className="grid grid-cols-[1.6fr_0.7fr_1fr_0.7fr_0.8fr] gap-4 border-b border-[var(--line)] pb-2 text-micro uppercase tracking-widest text-[var(--ink-faint)]">
        <span>Fixture</span>
        <span>Result</span>
        <button
          type="button"
          onClick={() => setBrierSort((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))}
          className="flex items-center gap-1 text-left uppercase tracking-widest transition-colors duration-300 hover:text-[var(--ink)]"
        >
          Brier {arrow}
        </button>
        <span className="hidden sm:block">RPS</span>
        <span className="text-right">Verdict</span>
      </div>
      {sorted.map((r) => (
        <Link
          key={r.slug}
          href={`/fixture/${r.slug}`}
          className="grid grid-cols-[1.6fr_0.7fr_1fr_0.7fr_0.8fr] items-center gap-4 border-b border-[var(--hairline)] py-3 last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]"
        >
          <div className="min-w-0">
            <div className="text-title truncate">{r.matchName}</div>
            <div className="text-caption text-[var(--ink-faint)] truncate">{r.context}</div>
          </div>
          <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{r.result}</span>
          <span className="flex items-center gap-2">
            <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{r.brier.toFixed(3)}</span>
            <BrierBar brier={r.brier} />
          </span>
          <span className="hidden text-mono data-mono tabular text-[var(--ink-muted)] sm:block">{r.rps.toFixed(3)}</span>
          <span className="flex justify-end">
            <VerdictChip verdict={r.verdict} />
          </span>
        </Link>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Inspector + build** — `node --import tsx scripts/design-inspector.mts` (green) and `npm run build` (compiles). Commit: `git add components/settlement-table.tsx && git commit -m "feat(record): add sortable SettlementTable (BrierBar + VerdictChip)"`

---

### Task 3: Rewrite `app/record/page.tsx` — rail, hero, metric strip, intelligence, settlement table

**Files:** Modify `app/record/page.tsx`.

Replace: the `rail` SignalLine signals; the "Sample warning" + "At a glance" sections (→ hero + 5-metric strip via `LedgerMetric`/`NumberTicker` + intelligence 2×2); the "Settled calls" grid (→ `<SettlementTable rows={settlementRows} />`). Keep: calibration, team breakdown, informational, open, caveats. Remove the now-unused `LockedSplit` only if no longer referenced (it is used by the old settled grid — remove with it).

- [ ] **Step 1:** Imports — add `import { IntelligenceCard } from "@/components/intelligence-card";`, `import { SettlementTable, type SettlementTableRow } from "@/components/settlement-table";`. Keep `NumberTicker`, `VerdictChip`, `CalibrationChart`, `fixtureBySlug`, `clubById`.

- [ ] **Step 2:** In the component body, after the existing `ece`/`meanLogLoss` computation, add the derived inputs:

```tsx
const accuracyPct = agg.accuracy !== null ? Math.round(agg.accuracy * 100) : null;
const correct = agg.accuracy !== null ? Math.round(agg.accuracy * agg.n) : 0;

// Largest miss (highest model Brier among official rows)
const worst = [...official.rows].sort((a, b) => b.grades.modelBrier - a.grades.modelBrier)[0];
const worstName = worst ? matchLabel(worst.slug) : "—";

// Settlement table rows (date asc/desc handled in the client component)
const settlementRows: SettlementTableRow[] = official.rows.map((row) => {
  const f = fixtureBySlug(row.slug);
  const stage = f?.group ? `Group ${f.group}` : (f?.stage ?? "Tournament");
  const date = f
    ? new Date(f.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : "—";
  return {
    slug: row.slug,
    matchName: matchLabel(row.slug),
    context: `${stage} · ${date} · ${row.locked.home} / ${row.locked.draw} / ${row.locked.away}`,
    result: row.actual,
    brier: row.grades.modelBrier,
    rps: row.grades.modelRps,
    verdict: row.verdict,
    kickoffMs: f ? new Date(f.kickoffISO).getTime() : 0,
  };
});

// Pre-stringified numerics (keep formatting off JSX call sites)
const brierStr = agg.meanBrier !== null ? agg.meanBrier.toFixed(3) : "—";
const rpsStr = agg.meanRps !== null ? agg.meanRps.toFixed(3) : "—";
const logLossStr = meanLogLoss !== null ? meanLogLoss.toFixed(3) : "—";
const eceStr = ece !== null ? `${(ece * 100).toFixed(1)}%` : "—";
const accuracyStr = accuracyPct !== null ? `${accuracyPct}%` : "—";
const kalshiEdgeStr = agg.vsKalshi.n > 0 && agg.vsKalshi.edge !== null ? agg.vsKalshi.edge.toFixed(3) : "—";
```

- [ ] **Step 3:** Replace the `rail` prop with the record-specific status rail (spec L1: BRIER · ECE · LOG-LOSS · ACCURACY · n=):

```tsx
rail={
  <SignalLine
    signals={[
      { label: "Brier", value: agg.meanBrier ?? 0, decimals: 3, tone: (agg.meanBrier ?? 0) >= 0.55 ? "warn" : "neutral", detail: "live · lower better" },
      { label: "ECE", value: ece !== null ? ece * 100 : 0, suffix: "%", decimals: 1, tone: ece !== null && ece >= 0.03 ? "warn" : "up", detail: "target < 3%" },
      { label: "Log-loss", value: meanLogLoss ?? 0, decimals: 3, detail: "random ≈ 1.099" },
      { label: "Accuracy", value: accuracyPct ?? 0, suffix: "%", detail: "top-outcome" },
      { label: "Official n", value: agg.n, tone: agg.n < 30 ? "warn" : "neutral", detail: "graded sample" },
    ]}
  />
}
```

- [ ] **Step 4:** Replace the first two `CanvasSection`s ("Sample warning" + "At a glance") with the hero + 5-metric strip (spec L2–L3). The hero ratio uses `NumberTicker`; the metric strip is a 5-col bordered grid reusing `LedgerMetric`:

```tsx
<CanvasSection eyebrow="Accountability ledger" title="Locked before kickoff, graded after the whistle.">
  <DataPlane>
    <div className="flex flex-col gap-2">
      <div className="text-hero data-mono tabular">
        <NumberTicker value={correct} />/<NumberTicker value={agg.n} /> correct picks
      </div>
      <div className="text-caption data-mono tabular text-[var(--ink-muted)]">
        Brier {brierStr} · RPS {rpsStr} · Log-loss {logLossStr} · ECE {eceStr} · n={agg.n}
      </div>
      {agg.n < 30 && (
        <div className="text-caption text-[var(--warn)]">△ n={agg.n} — sample too small for conclusions.</div>
      )}
    </div>

    <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
      <LedgerMetric label="Brier score (live)" value={<NumberTicker value={agg.meanBrier ?? 0} decimals={3} />} sub="Baseline 0.667 · lower better" />
      <LedgerMetric label="RPS" value={<NumberTicker value={agg.meanRps ?? 0} decimals={3} />} sub="Coin-flip ≈ 0.278" />
      <LedgerMetric label="Log-loss" value={meanLogLoss !== null ? <NumberTicker value={meanLogLoss} decimals={3} /> : <Dash />} sub="Random ≈ 1.099" />
      <LedgerMetric label="ECE (live)" value={ece !== null ? <span><NumberTicker value={ece * 100} decimals={1} />%</span> : <Dash />} sub="Target < 3.0%" />
      <LedgerMetric label="vs Kalshi (edge)" value={kalshiEdgeStr} sub={agg.vsKalshi.n > 0 ? `n=${agg.vsKalshi.n} · ${agg.vsKalshi.edge! < 0 ? "market sharper" : "model sharper"}` : "needs Kalshi snapshots"} />
    </div>
  </DataPlane>
</CanvasSection>
```

- [ ] **Step 5:** Add the intelligence section (spec L4, 2×2, analytical prose grounded in real data) immediately after the hero section:

```tsx
<CanvasSection eyebrow="Intelligence briefing" title="Every claim sourced to a metric.">
  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
    <IntelligenceCard category="Performance assessment" accent={(agg.meanBrier ?? 0) >= 0.55 ? "down" : "up"}>
      Official graded record: {agg.n} matches, {correct} correct picks ({accuracyStr}). Mean Brier
      {` ${brierStr}`} against a 0.667 uniform baseline. At n={agg.n} this is consistent with n&lt;30
      variance, not a demonstrated edge.
    </IntelligenceCard>
    <IntelligenceCard category="Calibration signal" accent={ece === null ? undefined : ece >= 0.03 ? "down" : "up"}>
      Expected calibration error is {eceStr} against a 3.0% gate. Lower means stated probabilities
      track observed frequencies; the reliability diagram below shows alignment per probability bin.
    </IntelligenceCard>
    <IntelligenceCard category="Largest miss" accent="warn">
      {worst
        ? `${worstName} settled ${worst.actual}; the model split ${worst.locked.home}/${worst.locked.draw}/${worst.locked.away} (Brier ${worst.grades.modelBrier.toFixed(3)} — worst in the settled record).`
        : "No settled rows yet."}
    </IntelligenceCard>
    <IntelligenceCard category="Market comparison · Kalshi">
      {agg.vsKalshi.n > 0
        ? `${agg.vsKalshi.n} match with Kalshi data: model Brier ${agg.vsKalshi.modelBrier!.toFixed(3)} vs Kalshi ${agg.vsKalshi.marketBrier!.toFixed(3)}, edge ${kalshiEdgeStr}. n=${agg.vsKalshi.n} is noise; a meaningful read needs 10+ matched pairs.`
        : "No matched Kalshi pairs yet (n=0)."}
    </IntelligenceCard>
  </div>
</CanvasSection>
```

- [ ] **Step 6:** Replace the "Settled calls" `CanvasSection` (the old `official.rows.map` grid + `LockedSplit`) with:

```tsx
{official.rows.length > 0 && (
  <CanvasSection eyebrow={`Settlement record · ${official.rows.length} graded calls`} title="Locked split, official result, and grade.">
    <DataPlane>
      <SettlementTable rows={settlementRows} />
      <p className="text-caption mt-3">Sorted by date. Click the Brier header to sort by score.</p>
    </DataPlane>
  </CanvasSection>
)}
```

Delete the now-unused `LockedSplit` function (only the old grid used it). Keep `Dash` (still used in the metric strip).

- [ ] **Step 7: Full gate** — `npm run build && npx vitest run && node --import tsx scripts/design-inspector.mts && npx eslint app/record/page.tsx components/settlement-table.tsx`. All green (vitest baseline 245 + 4 new = 249).

- [ ] **Step 8: Visual** — dev server, screenshot `/record`: confirm rail (Brier/ECE/Log-loss/Accuracy/n), hero ratio, 5-metric strip, 2×2 intel cards, reliability diagram, sortable settlement table (click Brier header reorders), team breakdown, caveats. No glass/glow.

- [ ] **Step 9: Commit** — `git add app/record/page.tsx && git commit -m "feat(record): rewrite to spec hierarchy — hero, metric strip, intelligence cards, sortable settlement table"`

---

## Self-Review

**Spec coverage (Record §502–633):** Status rail (L1) → T3.S3 · Hero (L2) → T3.S4 · 5-metric strip (L3) → T3.S4 · Intelligence 2×2 (L4) → T3.S5 · Reliability diagram (L5) → kept (existing `CalibrationChart`, gated ≥2 bins) · Settlement table sortable by Brier (L6) → T1+T2+T3.S6 · Team breakdown (L7) → kept (existing). Motion: NumberTicker count-up on metric strip + hero (T3) ✓; `animate-rise` is built into `CanvasSection`. Mobile: metric strip `grid-cols-2 → md:3 → lg:5`; intel `1 → md:2`; settlement RPS column `hidden sm:block` ✓. Interaction: Brier header sort (T2) ✓; row → `/fixture/[slug]` (T2) ✓.

**Placeholder scan:** No TBD/TODO. Every step has concrete code or exact section refs. ✓

**Type consistency:** `SettlementTableRow` shape (T2) matches the object built in T3.S2. `sortSettlements` generic constraint `{ brier; kickoffMs }` is satisfied by `SettlementTableRow`. `row.verdict` (accountability `Verdict`) is structurally `"hit"|"close"|"miss"` = kit-color `Verdict` consumed by `VerdictChip`. `NumberTicker`/`LedgerMetric`/`Dash` reused with existing signatures. ✓
