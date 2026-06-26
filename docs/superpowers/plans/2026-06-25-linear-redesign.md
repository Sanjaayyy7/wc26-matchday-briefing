# Linear-Grade Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Re-skin the WC26 platform to be visually 1:1 with linear.app across the 6 nav routes, merge Home+Record into one Ledger, and replace the `/matches` infinite scroll with onefootball-style date navigation.

**Architecture:** Retune the token system (`globals.css`) to Linear's extracted palette + type, introduce a small set of primitives (`Surface`, `GlassHeader`, `Hero`, `DateNav`), rewrite the `design-inspector` guardrail to enforce the new system, then migrate the shell and each route. The redesign lands as ONE PR because the inspector gates all routes at once.

**Tech Stack:** Next.js 16 (App Router — read `node_modules/next/dist/docs/` first), React 19, Tailwind v4 (`@theme`/`@utility` in `globals.css`), `next/font` (Inter Variable), vitest, headless browser for visual diff.

## Global Constraints

- **Tokens-only:** no raw hex in `.tsx/.ts` (only `globals.css`, `data/`, `lib/kit-color.ts`); no `bg-(white|black|gray|slate|zinc)` literals; numeric display via `NumberTicker`/`tabular`; motion = `duration-300` + single ease.
- **Preserved honesty-first content (do NOT change behavior):** model **BREACH shown**; calibration verdict **data-derived**; `NumberTicker` **static**; canonical `official.verdict`; `selectUpcomingLocks` for Next locks. Signature calibration = SSR-SVG `CalibrationDiagram`, not the blank-first-paint Plotly `CalibrationChart`.
- **Linear targets (extracted):** canvas `#08090a`, surface `#0f1011`, ink `#f7f8f8`, muted `#8a8f98`, hairline `rgba(255,255,255,.06)`, accent indigo `#5e6ad2`/bright `#8fa6ff`, radius card 8px, display Inter Variable weight 510–590 ls −0.022em, glass header `blur(20px)`.
- **Next.js 16:** read the bundled docs before framework code; heed deprecations.
- Gates before every commit (from `app/`): `npx vitest run` · `npm run lint` · `node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`.
- Branch `feat/linear-redesign` (already created). Never `git add -A`; commit named files only. No `Co-Authored-By`.
- **Task order is load-bearing:** the inspector rewrite (Task 5) MUST land after the shell adopts the new style and BEFORE routes adopt `Surface`, so gates stay green at every commit.

---

### Task 1: Token system + Inter Variable + retuned type scale

**Files:**
- Modify: `app/globals.css` (the `:root` / `.dark` token blocks + the `@utility text-hero/display/title`)
- Modify: `app/layout.tsx` (swap Archivo display font → Inter Variable via `next/font`)

**Interfaces:**
- Produces: tokens `--surface`, `--accent`, `--accent-bright`, `--radius-card`, `--radius-pill`, `--blur-glass`, `--shadow-pop`; retuned `--canvas/--surface/--ink/--ink-muted/--hairline/--line` (dark = Linear palette); `text-hero/display/title` at weights 510–590, ls −0.022em.

- [ ] **Step 1:** In `.dark`, set `--canvas:#08090a; --surface:#0f1011; --ink:#f7f8f8; --ink-muted:#8a8f98; --hairline:rgba(255,255,255,.06); --line:rgba(255,255,255,.09);` add `--accent:#5e6ad2; --accent-bright:#8fa6ff;`. In `:root` (light) retune to Linear light: `--canvas:#fbfbfb; --surface:#ffffff; --ink:#0f1011; --ink-muted:#6b7280; --accent:#5e6ad2;`. Keep `--up/--down/--warn` and the verdict/stage ramps (data semantics).
- [ ] **Step 2:** In `@theme inline` add `--color-surface` mapping (already present) and `--color-accent: var(--accent)`. Add new radius tokens `--radius-card: 0.5rem; --radius-pill: 9999px;` and `--blur-glass: 20px;` plus `--shadow-pop: 0 8px 40px rgba(0,0,0,.5);`.
- [ ] **Step 3:** Retune type utilities: `text-hero` → `font-weight:560; letter-spacing:-0.022em; line-height:1.0` (keep clamp size); `text-display` → `font-weight:510; letter-spacing:-0.022em`; `text-title` → `font-weight:590; letter-spacing:-0.012em`. Point `--font-display` at Inter Variable.
- [ ] **Step 4:** In `app/layout.tsx`, replace the Archivo display font import with `next/font/google` Inter (or `Inter` variable) bound to `--font-display` (and keep `--font-inter` for sans). Confirm the docs in `node_modules/next/dist/docs/` for the current `next/font` API.
- [ ] **Step 5 (gate):** `npm run build` — Expected: compiles, no font errors. `node --import tsx scripts/design-inspector.mts` — Expected: still green (old inspector; values changed, not patterns).
- [ ] **Step 6:** Commit: `git add app/globals.css app/layout.tsx && git commit -m "feat: retune token system + type scale to Linear palette"`.

---

### Task 2: Date-grouping pure logic for `/matches`

**Files:**
- Create: `lib/match-day-groups.ts`
- Test: `tests/match-day-groups.test.ts`

**Interfaces:**
- Consumes: existing `MatchView` from `lib/match-view.ts` (has `fixture.kickoffISO`).
- Produces: `groupByMatchday(views: MatchView[], tz?: string): { dateISO: string; label: string; views: MatchView[] }[]` (sorted ascending, one bucket per ET calendar date) and `defaultSelectedIndex(groups, now: Date): number` (index of today, else nearest upcoming, else last).

- [ ] **Step 1 (failing test):**

```ts
import { describe, it, expect } from "vitest";
import { groupByMatchday, defaultSelectedIndex } from "@/lib/match-day-groups";

const v = (iso: string) => ({ fixture: { kickoffISO: iso, slug: iso } } as any);

describe("groupByMatchday", () => {
  it("buckets views by ET calendar date, ascending", () => {
    const g = groupByMatchday([v("2026-06-24T20:00:00Z"), v("2026-06-23T18:00:00Z"), v("2026-06-24T23:00:00Z")]);
    expect(g.map((b) => b.views.length)).toEqual([1, 2]);
    expect(g[0].dateISO < g[1].dateISO).toBe(true);
  });
  it("defaultSelectedIndex picks today when present", () => {
    const g = groupByMatchday([v("2026-06-25T18:00:00Z"), v("2026-06-26T18:00:00Z")]);
    expect(defaultSelectedIndex(g, new Date("2026-06-25T12:00:00Z"))).toBe(0);
  });
  it("defaultSelectedIndex picks nearest upcoming when no today", () => {
    const g = groupByMatchday([v("2026-06-20T18:00:00Z"), v("2026-06-28T18:00:00Z")]);
    expect(defaultSelectedIndex(g, new Date("2026-06-25T12:00:00Z"))).toBe(1);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run tests/match-day-groups.test.ts` — Expected: FAIL (module not found).
- [ ] **Step 3:** Implement `lib/match-day-groups.ts`: group by `toLocaleDateString("en-US",{timeZone:"America/New_York"})`, produce `dateISO` (YYYY-MM-DD in ET), human `label` (`Today`/`Yesterday`/`Tomorrow` relative to `now`, else `EEE, MMM d`), sort ascending; `defaultSelectedIndex` = today's bucket, else first bucket with `dateISO >= todayISO`, else last index.
- [ ] **Step 4:** Run the test — Expected: PASS.
- [ ] **Step 5:** Commit: `git add lib/match-day-groups.ts tests/match-day-groups.test.ts && git commit -m "feat: matchday date-grouping logic"`.

---

### Task 3: Primitives — Surface, GlassHeader, Hero

**Files:**
- Create: `components/ui/surface.tsx`, `components/glass-header.tsx`, `components/hero.tsx`
- Test: `tests/primitives.test.tsx`

**Interfaces:**
- Produces:
  - `Surface({ as?, interactive?, className?, children })` → token card: `bg-[var(--surface)] border border-[var(--hairline)] rounded-[var(--radius-card)]`, `interactive` adds the `interactive` hover utility.
  - `GlassHeader({ children })` → `sticky top-0 z-50 backdrop-blur-[var(--blur-glass)] border-b border-[var(--line)]` translucent canvas.
  - `Hero({ eyebrow?, children })` → wrapper with ONE masked indigo gradient wash (uses a new `hero-glow` utility) + medium display type slot.

- [ ] **Step 1 (failing test):**

```tsx
import { render } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { Surface } from "@/components/ui/surface";

describe("Surface", () => {
  it("renders children with surface + radius tokens", () => {
    const { container, getByText } = render(<Surface>hi</Surface>);
    expect(getByText("hi")).toBeTruthy();
    const el = container.firstChild as HTMLElement;
    expect(el.className).toMatch(/--surface/);
    expect(el.className).toMatch(/--radius-card/);
  });
});
```

- [ ] **Step 2:** Run `npx vitest run tests/primitives.test.tsx` — Expected: FAIL.
- [ ] **Step 3:** Implement the three primitives per the Interfaces block. Add the `@utility hero-glow` to `globals.css` (one masked indigo radial: `linear/radial-gradient` with `color-mix(in oklab, var(--accent) 12%, transparent)`, `mask-image` radial fade — no halo, low alpha).
- [ ] **Step 4:** Run the test — Expected: PASS.
- [ ] **Step 5:** Commit: `git add components/ui/surface.tsx components/glass-header.tsx components/hero.tsx tests/primitives.test.tsx app/globals.css && git commit -m "feat: Surface, GlassHeader, Hero primitives"`.

---

### Task 4: Shell + header migration (nav 7→6, glass, Linear type)

**Files:**
- Modify: `components/wc26-shell-header.tsx` (use GlassHeader styling; drop the `Record` nav item → 6 items; Linear type/spacing; keep status rail with BREACH/ECE)
- Modify: `components/wc26-shell.tsx` if it wraps the header.
- Test: `tests/shell-nav.test.tsx` (create)

**Interfaces:**
- Consumes: `GlassHeader` (Task 3), `WC26_NAV`.
- Produces: `WC26_NAV` with 6 items (no `record`); header rendered inside glass styling.

- [ ] **Step 1 (failing test):**

```tsx
import { describe, it, expect } from "vitest";
import { WC26_NAV } from "@/components/wc26-shell-header";

describe("nav", () => {
  it("has 6 items and no Record route", () => {
    expect(WC26_NAV).toHaveLength(6);
    expect(WC26_NAV.find((n) => n.routeKey === "record")).toBeUndefined();
    expect(WC26_NAV[0].href).toBe("/");
  });
});
```

- [ ] **Step 2:** Run — Expected: FAIL (still 7 items).
- [ ] **Step 3:** Remove the `{ label: "Record", href: "/record", routeKey: "record" }` entry; relabel per Linear feel if desired (keep hrefs). Apply glass styling + Linear type to the nav/status rail. Keep `ThemeToggle`, status dot, BREACH/ECE.
- [ ] **Step 4:** Run the test — Expected: PASS. `npm run build` green. Old inspector still green (no Surface on pages yet).
- [ ] **Step 5:** Commit: `git add components/wc26-shell-header.tsx components/wc26-shell.tsx tests/shell-nav.test.tsx && git commit -m "feat: glassy 6-item shell header"`.

---

### Task 5: Rewrite design-inspector to the Linear constitution

**Files:**
- Modify: `scripts/design-inspector.mts`
- Test: `tests/design-inspector.test.ts` (create or extend)

**Interfaces:**
- Consumes: nothing new.
- Produces: an inspector that ALLOWS `Surface`/`rounded-[var(--radius-card)]`/`--shadow-pop`/glass header and still FORBIDS raw hex, `bg-(white|gray|...)`, raw `rounded-2xl/3xl/4xl` on routes, >1 decorative accent, ad-hoc px utilities.

- [ ] **Step 1 (failing tests):** write tests asserting the NEW rules via `inspectProject(fixtureRoot)` on tiny fixtures:

```ts
import { describe, it, expect } from "vitest";
import { inspectProject } from "@/scripts/design-inspector.mts";
// helper writes temp fixture dirs (app/components/lib) then runs inspectProject

describe("design-inspector (Linear)", () => {
  it("allows Surface card with --radius-card token on a route", () => {
    // fixture page using bg-[var(--surface)] rounded-[var(--radius-card)] → 0 violations
  });
  it("flags raw rounded-3xl on a route", () => {
    // fixture page with rounded-3xl → violation rule 'radius-token'
  });
  it("does NOT false-positive on the word shadow- inside a // comment", () => {
    // lib file with "// shadow-fit elevation note" → 0 elevation violations
  });
});
```

- [ ] **Step 2:** Run — Expected: FAIL.
- [ ] **Step 3:** Rewrite the inspector: delete `ROUTE_BOX_RE`/`no-box-layout`; replace `BAD_ELEVATION_RE` to allow `--shadow-pop` and only flag raw `bg-(white|black|gray|slate|zinc)` + raw `boxShadow`; anchor the elevation/shadow scan to `className=`/`box-shadow:` so `//`-comments don't match; add a `radius-token` rule flagging `rounded-(2xl|3xl|4xl)` in `PAGE_RE` files; keep tokens-only, scale-only, motion, no-background-lines, page-shell, section-labels, tabular-numbers.
- [ ] **Step 4:** Run the new tests — PASS. Then run the REAL inspector on the repo: `node --import tsx scripts/design-inspector.mts` — Expected: green (shell already migrated; routes not yet using Surface).
- [ ] **Step 5:** Commit: `git add scripts/design-inspector.mts tests/design-inspector.test.ts && git commit -m "feat: rewrite design-inspector for the Linear constitution"`.

---

### Task 6: Home → unified Ledger (absorb Record) + `/record` redirect

**Files:**
- Modify: `app/page.tsx` (add Record's sortable settlement table, team breakdown, open calls, caveats sections — using `Surface` + Linear type; keep hero, calibration SSR diagram, intelligence briefing, upcoming-locks)
- Replace: `app/record/page.tsx` → a redirect to `/`
- Modify: `tests/` any home/record assertions
- Reference (read-only): `app/record/page.tsx` (current), `components/settlement-table.tsx`, `lib/accountability.ts`

**Interfaces:**
- Consumes: `SettlementTable`, `official.rows`, `official.aggregates`, `Surface`, `Hero`.

- [ ] **Step 1:** Read the current `app/record/page.tsx` (this plan's sibling shows its sections) and lift the SettlementTable, team-breakdown, open-calls, caveats logic into `app/page.tsx` below the calibration section, wrapped in `Surface`s with `CanvasSection` rhythm. Keep the SSR `CalibrationDiagram` as the signature (not Plotly).
- [ ] **Step 2:** Replace `app/record/page.tsx` body with a permanent redirect. Confirm the Next 16 redirect API in `node_modules/next/dist/docs/` (`redirect()` from `next/navigation` in a server component, or `redirects()` in `next.config.ts` for a 301). Prefer config `redirects()` for a true 301.
- [ ] **Step 3 (test):** add/adjust a test asserting `/record` is configured to redirect to `/` and that `WC26_NAV` (Task 4) has no record link. Run `npx vitest run` — PASS.
- [ ] **Step 4 (gates):** full sweep green, incl. the new inspector (page now uses Surface — must pass). Visual-diff checkpoint: screenshot `/` desktop+mobile, compare to linear.app hero/section feel; revise type weight/spacing until no spottable gap.
- [ ] **Step 5:** Commit: `git add app/page.tsx app/record/page.tsx next.config.ts tests && git commit -m "feat: unify Home+Record into the Ledger; redirect /record"`.

---

### Task 7: `/matches` — DateNav + grouped Surface grid

**Files:**
- Create: `components/date-nav.tsx` (client; segmented date bar, keyboard-operable)
- Modify: `app/matches/page.tsx` + `components/matches-filter.tsx` to group by matchday and default to today
- Test: `tests/date-nav.test.tsx`

**Interfaces:**
- Consumes: `groupByMatchday`, `defaultSelectedIndex` (Task 2); `Surface`.
- Produces: `DateNav({ groups, selected, onSelect })` with `role="tablist"`, `aria-selected`, arrow-key roving tabindex, a "Today" jump.

- [ ] **Step 1 (failing test):** assert DateNav renders one tab per group, marks the selected `aria-selected`, and ArrowRight moves selection.
- [ ] **Step 2:** Run — FAIL.
- [ ] **Step 3:** Implement `DateNav` + wire `/matches`: group views, default selected = `defaultSelectedIndex`, render the selected day's matches as a `Surface` card grid (crest · matchup · split/result · verdict chip), keep stage/group/status filters as a secondary row. Sticky DateNav at top.
- [ ] **Step 4:** Run test — PASS. Gates green. Visual-diff vs onefootball matches + Linear card feel.
- [ ] **Step 5:** Commit: `git add components/date-nav.tsx app/matches/page.tsx components/matches-filter.tsx tests/date-nav.test.tsx && git commit -m "feat: onefootball-style date nav on /matches"`.

---

### Task 8–11: Reskin remaining routes to the system

Each is one task: apply `Surface`, the new type scale, indigo accent, and the new inspector rules; preserve all data/behavior. Per route: edit the page (+ its bespoke components), run gates, visual-diff checkpoint, commit.

- [ ] **Task 8 — `/command`:** reskin the terminal/command surfaces within `CommandShell` (page-shell-exempt). Files: `app/command/page.tsx`, `components/command/*`. Commit `feat: reskin /command to Linear`.
- [ ] **Task 9 — `/teams`:** Surface card grid for team list. Files: `app/teams/page.tsx`, related cards. (A2 FIFA stats enrichment deferred.) Commit `feat: reskin /teams to Linear`.
- [ ] **Task 10 — `/simulator`:** Surface tables/odds. Files: `app/simulator/page.tsx`, `components/odds-table.tsx`. Commit `feat: reskin /simulator to Linear`.
- [ ] **Task 11 — `/methodology`:** Linear long-form type + Surface callouts. Files: `app/methodology/page.tsx`. Commit `feat: reskin /methodology to Linear`.

Each task: `npx vitest run · npm run lint · design-inspector · inspect:execution · model:inspect · build` green; screenshot vs Linear; revise until no spottable gap.

---

### Task 12: Visual-diff harness + a11y pass + final sweep

**Files:**
- Create: `scripts/visual-diff.mts` (screenshots each route at 1440×900 + 390×844 to an artifacts dir)
- Modify: any route needing a11y/contrast fix

- [ ] **Step 1:** Implement `scripts/visual-diff.mts`: start the dev/prod server, navigate each of the 6 routes (light + dark), save screenshots. (Manual/offline script — NOT a commit gate.)
- [ ] **Step 2:** Run it; review every route side-by-side with linear.app. Fix any spottable gaps (type weight, spacing, surface elevation, accent usage).
- [ ] **Step 3 (a11y):** verify muted text AA contrast on canvas; all interactive elements keyboard-reachable with visible `:focus-visible`; DateNav arrow-key + `aria-selected`; `prefers-reduced-motion` honored; landmarks present; verdict chips carry text (not color-only). Fix failures.
- [ ] **Step 4 (final gate sweep):** full gates green across the whole branch; re-run `design-inspector` (all routes now Linear, must be green).
- [ ] **Step 5:** Commit `git add scripts/visual-diff.mts <fixes> && git commit -m "feat: visual-diff harness + a11y pass"`. Open PR `feat/linear-redesign` → main.

## Self-review / coverage

- Spec §"New design constitution" + token table → Task 1, Task 5. ✓
- Primitives (Surface/GlassHeader/Hero/DateNav) → Tasks 2, 3, 7. ✓
- Page designs: Ledger merge → T6; matches DateNav → T7; command/teams/simulator/methodology → T8–11; shell/header → T4. ✓
- Guardrail rewrite (incl. shadow-comment false-positive fix) → Task 5. ✓
- QA: visual-diff harness + a11y → Task 12. ✓
- Preserved honesty content (BREACH, data-derived verdict, static NumberTicker, SSR calibration, canonical verdict, upcoming-locks) → Global Constraints + T6 Step 1. ✓
- One-cohesive-PR rationale (inspector gates all routes) + load-bearing task order → Global Constraints + Task 5. ✓
- Type consistency: `groupByMatchday`/`defaultSelectedIndex` (T2) consumed in T7; `Surface`/`GlassHeader`/`Hero` (T3) consumed T4/T6/T7/T8–11; `WC26_NAV` 6 items (T4) asserted T6. ✓
