# Design Transformation — Phase 2: Homepage Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development or superpowers:executing-plans. Keep the spec open: `docs/superpowers/specs/2026-06-19-wc26-design-transformation.md` §"Page 1: Homepage" (lines ~305–500).

**Goal:** Rewrite `app/page.tsx`'s presentation into the spec's Homepage hierarchy (`HomeGrid` = main `2fr` + `320px` rail), consuming the P1 primitives (`IntelligenceCard`, `SettlementRow`, `BrierBar`) and the spec's prose/number/motion rules — institutional, anti-glass, inspector-clean.

**Architecture:** The existing `app/page.tsx` already computes every datum needed (verified below). P2 keeps the data layer (lines 132–182) and the `WCS26Shell` wrapper, and replaces the JSX body + the local `SettlementRow`/`LockRow`/`HealthKpi` with the spec layout + shared components. New small presentational sub-components live inline or in `components/home/`.

**Tech Stack:** Next.js 16.2.6, React 19, Tailwind v4, P1 primitives, `data/simulation.json` (champion probabilities).

## Global Constraints

- Hybrid premium-within-system: institutional/anti-glass, house tokens, inspector-clean (no arbitrary px → Tailwind scale; `data-mono`/`tabular` on numerics; `duration-300`/`var(--dur)`/`animate-rise` motion only; no glow/blur/gradient).
- Number rules (spec §2): `tabular-nums` everywhere; Brier 3 decimals; probabilities integer percent; H/D/A as `64 / 23 / 13`.
- Prose rules (spec §2): analytical voice; mandatory small-sample caveat when n<30; banned words: amazing/best/sophisticated/powerful.
- Page-shell rule: page MUST keep `<WCS26Shell>` + `<RouteStack>` + `<CanvasSection>` (design-inspector).
- Next 16.2.6 — read `node_modules/next/dist/docs/` before edits. Run from `app/`.

## Verified available data (already in `app/page.tsx:132–182`)

`entries`, `views`, `ece`, `brier`, `status` (NOMINAL/WARNING/BREACH), `settled` (sorted Brier desc), `worstMisses` (3), `sharpCalls` (3), `upcomingLocks` (5), `openLocks`, `gradeCounts` {SURPRISE/MISS/CLOSE/SOLID/SHARP}, `agg.n` (settled count), `activeSignals`. Champion probabilities come from `data/simulation.json` (`teams[].champion`) — **add an import** (Task 1).

---

### Task 1: Data prep — settlement-feed mapping + champion projections

**Files:** Modify `app/page.tsx` (data layer only).

**Interfaces produced:** `settlementFeed: { slug; matchName; context; score; brier; verdict }[]` (newest-first, 4 items); `champions: { id; name; pct }[]` (top 7).

- [ ] **Step 1:** Add import: `import simulationJson from "@/data/simulation.json";` and a verdict mapper:

```tsx
import type { Verdict } from "@/lib/kit-color";

function verdictFromBrier(b: number): Verdict {
  return b < 0.55 ? "hit" : b < 0.75 ? "close" : "miss";
}
```

- [ ] **Step 2:** Build `settlementFeed` (newest first by `lockedAt`, 4 items) from `entries` (filter settled), reusing `fixtureBySlug`/`clubById` for names. `context` = `` `${group} · ${date} · ${split.home} / ${split.draw} / ${split.away}` ``. `verdict = verdictFromBrier(e.modelBrier!)`.

- [ ] **Step 3:** Build `champions` from `simulationJson.teams` → `[{ id, name, pct }]` sorted by `champion` desc, top 7. (Mirror the shape `lib/command-data.ts buildChampionshipProjections` already uses; reuse it if signature fits.)

- [ ] **Step 4:** `npm run build` → succeeds. Commit: `feat(home): data prep for settlement feed + champions`.

---

### Task 2: `HomeGrid` shell + `PrimaryMetric`

**Files:** Modify `app/page.tsx` return.

Per spec §415–423. Replace the current `RouteStack` body's opening with the 2-column grid; `PrimaryMetric` = hero picks ratio + subline + sample warning.

- [ ] **Step 1:** Wrap body in `<RouteStack><CanvasSection eyebrow="Overview" title="Forecast performance">` then a grid `<div className="grid gap-12 lg:grid-cols-[2fr_320px]">` with `<div>` main + `<aside>` rail.

- [ ] **Step 2:** `PrimaryMetric` (main, top):

```tsx
<div className="flex flex-col gap-2">
  <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">Forecast performance · Live tournament</span>
  <div className="text-hero data-mono tabular">{correct}/{agg.n} correct picks</div>
  <div className="text-caption data-mono tabular text-[var(--ink-muted)]">Brier {brier.toFixed(3)} · ECE {ece !== null ? (ece*100).toFixed(1) : "—"}%</div>
  {agg.n < 30 && <div className="text-caption text-[var(--warn)]">△ n={agg.n} — sample too small to draw conclusions</div>}
</div>
```
(`correct` = count of `settled` where `correctPick === true`; compute in Task 1.)

- [ ] **Step 3:** `npm run build` + inspector → green. Commit: `feat(home): HomeGrid shell + PrimaryMetric`.

---

### Task 3: `IntelligenceSection` (2×2 `IntelligenceCard`)

**Files:** Modify `app/page.tsx`; import `IntelligenceCard`.

Per spec §425–433. Four cards, analytical prose grounded in real data.

- [ ] **Step 1:** Import `import { IntelligenceCard } from "@/components/intelligence-card";`

- [ ] **Step 2:** Render under a `text-label` "Intelligence briefing" head, `grid grid-cols-1 md:grid-cols-2 gap-3`:
  - `PERFORMANCE ASSESSMENT` — `accent` from `status`; prose: Brier/n with caveat.
  - `CALIBRATION SIGNAL` — accent up/warn/down by ECE; prose: ECE vs 3% target.
  - `NOTABLE VARIANCE` — the top `worstMisses[0]`: "Model assigned {x}% to {pick}; settled {result}."
  - `OPERATIONAL STATUS` — `{openLocks} open locks · {activeSignals.length} active investigations`.

- [ ] **Step 3:** Build + inspector → green. Commit: `feat(home): IntelligenceSection 2x2 cards`.

---

### Task 4: `SettlementFeed` (shared `SettlementRow`) + `UpcomingLocks`

**Files:** Modify `app/page.tsx`; import shared `SettlementRow`; remove the local `SettlementRow` (lines 59–98) and reuse the existing local `LockRow` for upcoming.

- [ ] **Step 1:** `import { SettlementRow } from "@/components/settlement-row";` Delete the local `SettlementRow` function (lines 59–98) and its usages in the old misses/calls sections.

- [ ] **Step 2:** Render "Recent settlements" head + `settlementFeed.map(s => <SettlementRow key={s.slug} {...s} />)` wrapped in an `<a href={`/fixture/${s.slug}`}>` per row (spec §475 interaction).

- [ ] **Step 3:** Render "Next locks" head + `upcomingLocks.slice(0,3)` via the kept local `LockRow`.

- [ ] **Step 4:** Build + inspector + `npx vitest run` → green. Commit: `feat(home): settlement feed + upcoming locks via shared SettlementRow`.

---

### Task 5: `HomeRail` (Model health · Champion bars · Forecast record) + motion + gate

**Files:** Modify `app/page.tsx`.

Per spec §456–466, §492–498. Rail in the `<aside>`. Champion bars per spec §5.2 (3px, width ∝ pct, label right). Reuse existing `data/simulation.json` data from Task 1.

- [ ] **Step 1:** Three `RailSection`s (use the kept `HealthKpi`/metric-row style or simple `text-label`+`text-mono` rows): Model health (Status/Version/Brier/Baseline/RPS/Log-loss/ECE), Champion probability (top 7 `champions` → name link `/team/{id}` + 3px bar + pct), Forecast record (Settled/Correct/Open/Hits/Close/Misses from `gradeCounts`).

- [ ] **Step 2:** Champion bar (inspector-safe, inline width style):

```tsx
<span className="block h-[3px] w-full rounded-full bg-[var(--hairline)] overflow-hidden">
  <span className="block h-full" style={{ width: `${(c.pct/champions[0].pct)*100}%`, background: "var(--up)" }} />
</span>
```
(Note: `h-[3px]` is arbitrary — if the inspector flags it, use `h-0.5` (2px) or add an `@utility` `h-rail-bar`. Verify against the inspector and adjust.)

- [ ] **Step 3:** Add `animate-rise` to the top-level grid container (page-entry motion; utility exists in globals).

- [ ] **Step 4: Full gate** — `npm run build && npx vitest run && node --import tsx scripts/design-inspector.mts && npx eslint app/page.tsx`. All green.

- [ ] **Step 5: Visual** — dev server, screenshot `/`: confirm HomeGrid 2-col, hero picks ratio, 2×2 intel cards, settlement feed with Brier bars + verdict chips, rail with champion bars. No glass/glow.

- [ ] **Step 6:** Commit: `feat(home): HomeRail + page-entry motion; complete homepage transformation`.

---

## Self-Review

**Spec coverage (Homepage §305–500):** PrimaryMetric → T2 · IntelligenceSection → T3 · SettlementFeed → T4 · UpcomingLocks → T4 · HomeRail (health/champion/record) → T5 · motion → T5 · interaction hrefs → T4/T5. Mobile adaptation: deferred (desktop-first per shell decision; trivial responsive via `lg:`/`md:` breakpoints included). ✓

**Placeholder scan:** Task 5 Step 2 flags the one arbitrary-px risk (`h-[3px]`) with a concrete fallback — not a placeholder, a known decision point. All other steps have concrete code or exact spec line refs. ✓

**Type consistency:** `verdictFromBrier → Verdict` ("hit"|"close"|"miss") matches `SettlementRow`'s `verdict: Verdict` and `VerdictChip`. `settlementFeed` item shape matches `SettlementRow` props (`matchName/context/score/brier/verdict`). `champions {id,name,pct}` consistent T1→T5. ✓
