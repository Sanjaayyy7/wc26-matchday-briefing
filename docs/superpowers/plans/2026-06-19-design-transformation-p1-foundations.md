# Design Transformation — Phase 1: Foundations & Shared Components

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the shared design-system primitives the WC26 Design Transformation needs — the missing `text-body` type token, a pure `BrierBar` inline reading-aid, an `IntelligenceCard` prose-card, and a `SettlementRow` — so the page rewrites (Homepage/Record/Matches, P2–P4) compose them instead of reinventing.

**Architecture:** Pure presentational components in `components/`, with the one piece of math (`BrierBar` width/color) extracted to `lib/brier-bar.ts` and unit-tested. `SettlementRow` reuses the existing `VerdictChip`. No page is rewritten in this phase — these are the reusable parts only.

**Tech Stack:** Next.js 16.2.6, React 19, Tailwind v4 (`@utility`), vitest, `scripts/design-inspector.mts`.

## Global Constraints

- **Hybrid premium-within-system** (locked decision): keep institutional/anti-glass rules + inspector constraints. No glow, no blur, no decorative gradient. Premium via density/hierarchy/motion-as-state only.
- **House tokens kept:** `--up #7cffb2`, `--down #ff674d`, `--warn #fbbf24`, `--canvas #050505`, `--ink`, `--ink-muted`, `--ink-faint`, `--line`, `--hairline`. Not retuned.
- **Inspector must stay green:** no arbitrary px (use Tailwind scale — 8px base, `p-1`=4px/`p-2`=8px/`gap-3`=12px/`p-4`=16px), `data-mono`/`tabular` on all numerics, motion `duration-300`/`var(--dur)` only, no raw hex outside allowed files, no `glass-rail`.
- **Number rules (spec §2):** `tabular-nums` on every number; Brier always 3 decimals (`0.721`); probabilities integer percent; counts no decimals.
- **Next.js 16.2.6 breaking changes** — per `app/AGENTS.md`, read `node_modules/next/dist/docs/` before component work.
- **Run from `app/`.**

---

### Task 1: Add the `text-body` type utility

Spec §2 type scale: `text-body` = 15px, weight 400, line-height 1.65, color `rgba(244,244,239,0.65)` — the institutional prose voice for intelligence cards. It's the only type token from the scale not already in `globals.css` (`text-hero/display/title/label/caption/micro` + `data-mono` all exist).

**Files:**
- Modify: `app/globals.css`

- [ ] **Step 1: Confirm it's missing**

Run: `grep -c "text-body" app/globals.css`
Expected: `0`.

- [ ] **Step 2: Add the utility**

In `app/globals.css`, after the existing `@utility text-caption { … }` block, add:

```css
@utility text-body {
  font-size: 15px;
  font-weight: 400;
  line-height: 1.65;
  color: rgba(244, 244, 239, 0.65);
}
```

- [ ] **Step 3: Verify**

Run: `grep -c "text-body" app/globals.css` → Expected: `1`
Run: `node --import tsx scripts/design-inspector.mts` → Expected: `Design inspector passed.`

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): add text-body prose type utility"
```

---

### Task 2: `BrierBar` inline reading-aid (TDD the math)

Spec §5.1: 2px-tall horizontal bar, width proportional to Brier (capped 100%), color `--up` if Brier < 0.50 · `--warn` if 0.50–0.75 · `--down` if > 0.75, track `--hairline`. Not a chart — a reading aid beside the Brier number.

**Files:**
- Create: `lib/brier-bar.ts`
- Create: `components/brier-bar.tsx`
- Test: `tests/brier-bar.test.ts`

**Interfaces:**
- Produces:
  ```ts
  export function brierBar(brier: number): { widthPct: number; colorVar: string };
  export function BrierBar(props: { brier: number }): React.JSX.Element;
  ```
  Consumed by Task 4 (`SettlementRow`) and P2–P4 pages.

- [ ] **Step 1: Write the failing test**

Create `tests/brier-bar.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { brierBar } from "../lib/brier-bar";

describe("brierBar", () => {
  it("green (--up) below 0.50", () => {
    expect(brierBar(0.3)).toEqual({ widthPct: 30, colorVar: "var(--up)" });
  });
  it("amber (--warn) in 0.50–0.75 inclusive", () => {
    expect(brierBar(0.5).colorVar).toBe("var(--warn)");
    expect(brierBar(0.721)).toEqual({ widthPct: 72.1, colorVar: "var(--warn)" });
    expect(brierBar(0.75).colorVar).toBe("var(--warn)");
  });
  it("red (--down) above 0.75", () => {
    expect(brierBar(0.9)).toEqual({ widthPct: 90, colorVar: "var(--down)" });
  });
  it("caps width at 100%", () => {
    expect(brierBar(1.5)).toEqual({ widthPct: 100, colorVar: "var(--down)" });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL**

Run: `npx vitest run tests/brier-bar.test.ts`
Expected: FAIL — `brierBar is not a function`.

- [ ] **Step 3: Implement the helper**

Create `lib/brier-bar.ts`:

```ts
/** Inline Brier reading-aid geometry (design-transformation spec §5.1). */
export function brierBar(brier: number): { widthPct: number; colorVar: string } {
  const widthPct = Math.min(brier * 100, 100);
  const colorVar =
    brier < 0.5 ? "var(--up)" : brier <= 0.75 ? "var(--warn)" : "var(--down)";
  return { widthPct, colorVar };
}
```

- [ ] **Step 4: Run it — expect PASS**

Run: `npx vitest run tests/brier-bar.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Write the component**

Create `components/brier-bar.tsx`:

```tsx
import { brierBar } from "@/lib/brier-bar";

export function BrierBar({ brier }: { brier: number }) {
  const { widthPct, colorVar } = brierBar(brier);
  return (
    <span className="inline-block h-0.5 w-16 rounded-full bg-[var(--hairline)] overflow-hidden align-middle">
      <span
        className="block h-full rounded-full"
        style={{ width: `${widthPct}%`, background: colorVar }}
      />
    </span>
  );
}
```

(`h-0.5` = 2px, `w-16` = 64px — Tailwind scale, inspector-safe. Width % is an inline style, not an arbitrary utility.)

- [ ] **Step 6: Verify build + inspector**

Run: `npx eslint components/brier-bar.tsx lib/brier-bar.ts` → clean
Run: `node --import tsx scripts/design-inspector.mts` → passed

- [ ] **Step 7: Commit**

```bash
git add lib/brier-bar.ts components/brier-bar.tsx tests/brier-bar.test.ts
git commit -m "feat(design): add BrierBar inline reading-aid (spec §5.1)"
```

---

### Task 3: `IntelligenceCard` prose card

Spec Homepage §: `<IntelCard category="PERFORMANCE ASSESSMENT" />` in a 2×2 grid. Header = ALL-CAPS micro label (`text-micro`); body = analytical prose (`text-body`). Optional accent border using a semantic token (default neutral).

**Files:**
- Create: `components/intelligence-card.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export function IntelligenceCard(props: {
    category: string;
    children: React.ReactNode;          // prose body
    accent?: "up" | "warn" | "down";    // optional semantic bottom border
  }): React.JSX.Element;
  ```
  Consumed by P2 (Homepage) and P3 (Record).

- [ ] **Step 1: Write the component**

Create `components/intelligence-card.tsx`:

```tsx
const ACCENT_BORDER: Record<"up" | "warn" | "down", string> = {
  up: "var(--up)",
  warn: "var(--warn)",
  down: "var(--down)",
};

export function IntelligenceCard({
  category,
  children,
  accent,
}: {
  category: string;
  children: React.ReactNode;
  accent?: "up" | "warn" | "down";
}) {
  return (
    <div
      className="flex flex-col gap-2 p-4 bg-[var(--surface)] border-b border-[var(--line)]"
      style={accent ? { borderBottomColor: ACCENT_BORDER[accent], borderBottomWidth: 2 } : undefined}
    >
      <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
        {category}
      </span>
      <p className="text-body">{children}</p>
    </div>
  );
}
```

- [ ] **Step 2: Verify**

Run: `npx eslint components/intelligence-card.tsx` → clean
Run: `node --import tsx scripts/design-inspector.mts` → passed (uses `text-body`/`text-micro`, scale spacing, no arbitrary px)

- [ ] **Step 3: Commit**

```bash
git add components/intelligence-card.tsx
git commit -m "feat(design): add IntelligenceCard prose card"
```

---

### Task 4: `SettlementRow`

Spec Homepage §438: per settled match — match name + context (group · date · H/D/A split), score, Brier value + inline bar, verdict chip. Reuses `BrierBar` (Task 2) and the existing `VerdictChip` (`components/verdict-chip.tsx`, props `{ verdict: Verdict }`).

**Files:**
- Create: `components/settlement-row.tsx`

**Interfaces:**
- Consumes: `BrierBar` (Task 2); `VerdictChip` + `Verdict` type from `@/lib/kit-color`.
- Produces:
  ```tsx
  export function SettlementRow(props: {
    matchName: string;        // "USA – PAR"
    context: string;          // "Group D · Jun 12 · 36 / 30 / 34"
    score: string;            // "4-1"
    brier: number;
    verdict: import("@/lib/kit-color").Verdict;
  }): React.JSX.Element;
  ```
  Consumed by P2 (Homepage) and P3 (Record).

- [ ] **Step 1: Confirm the Verdict type + VerdictChip prop**

Run: `grep -n "type Verdict" lib/kit-color.ts && grep -n "export function VerdictChip" components/verdict-chip.tsx`
Expected: both found. `VerdictChip` takes `{ verdict: Verdict }`.

- [ ] **Step 2: Write the component**

Create `components/settlement-row.tsx`:

```tsx
import { BrierBar } from "./brier-bar";
import { VerdictChip } from "./verdict-chip";
import type { Verdict } from "@/lib/kit-color";

export function SettlementRow({
  matchName,
  context,
  score,
  brier,
  verdict,
}: {
  matchName: string;
  context: string;
  score: string;
  brier: number;
  verdict: Verdict;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--hairline)] last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]">
      <div className="min-w-0 flex-1">
        <div className="text-title truncate">{matchName}</div>
        <div className="text-caption text-[var(--ink-faint)] truncate">{context}</div>
      </div>
      <div className="text-mono data-mono tabular text-[var(--ink-muted)] w-12 text-right">{score}</div>
      <div className="flex items-center gap-2 w-28 justify-end">
        <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{brier.toFixed(3)}</span>
        <BrierBar brier={brier} />
      </div>
      <div className="w-20 flex justify-end">
        <VerdictChip verdict={verdict} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Verify**

Run: `npx eslint components/settlement-row.tsx` → clean
Run: `node --import tsx scripts/design-inspector.mts` → passed
Run: `npm run build` → succeeds (component compiles)

- [ ] **Step 4: Commit**

```bash
git add components/settlement-row.tsx
git commit -m "feat(design): add SettlementRow (BrierBar + VerdictChip)"
```

---

### Task 5: Phase-1 gate

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `npm run build && npx vitest run && node --import tsx scripts/design-inspector.mts`
Expected: build ok, tests pass (241 baseline + 4 new BrierBar = 245), inspector passed.

- [ ] **Step 2: Lint touched files**

Run: `npx eslint app/globals.css lib/brier-bar.ts components/brier-bar.tsx components/intelligence-card.tsx components/settlement-row.tsx tests/brier-bar.test.ts`
Expected: clean.

- [ ] **Step 3: STOP — primitives ready**

Phase 1 ships the shared design-system parts. P2 (Homepage), P3 (Record), P4 (Matches) consume them and each get their own plan + PR.

---

## Self-Review

**Spec coverage (P1 scope only):**
- §2 `text-body` token → Task 1 ✓ (`text-micro` already exists; others exist)
- §5.1 Brier bar → Task 2 ✓
- IntelligenceCard (Homepage §428–431) → Task 3 ✓
- SettlementRow (Homepage §438–443) → Task 4 ✓ (reuses existing VerdictChip — DRY)
- Page rewrites (Homepage/Record/Matches) → **deferred to P2–P4** (own plans), explicitly out of P1
- StatusRail enhancement → deferred to P2 (it already exists in `wc26-shell-header.tsx`; enhanced when Homepage lands)

**Placeholder scan:** No TBD/vague steps. Full code in every code step. ✓

**Type consistency:** `brierBar(brier) → {widthPct, colorVar}` identical in Tasks 2/4. `BrierBar`/`IntelligenceCard`/`SettlementRow` prop shapes consistent. `VerdictChip` prop (`{ verdict: Verdict }`) matches the real existing component. `Verdict` imported from `@/lib/kit-color` (verified in Task 4 Step 1). ✓
