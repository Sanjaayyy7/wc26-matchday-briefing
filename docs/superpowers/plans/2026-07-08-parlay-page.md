# Parlay Page (Plan B) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/parlay` route rendering the locked parlay ledger as Kalshi-style slip cards — open slips, graded history with per-leg ✓/✗, running slip/leg hit rates — plus the methodology ET-share note promised in spec §12.

**Architecture:** Pure view-model `lib/parlay-view.ts` (ledger rows + fixtures → slip views + running record), server-safe `components/parlay-slip-card.tsx` (no hooks; expandable reasoning via native `<details>`), static `app/parlay/page.tsx` in the shipped WCS26Shell/CanvasSection system. No client fetches — `data/parlays.json` imported statically like every other page.

**Tech Stack:** Next.js 16 (Turbopack) App Router server components, Tailwind tokens from `globals.css`, vitest render tests via `react-dom/server` `renderToStaticMarkup` (no new deps).

## Global Constraints (spec §8, §12 + repo invariants)

- Work in `app-parlay/` worktree. Branch: `feat/parlay-page` off updated `main` (create in Task 1 Step 0).
- Static data from `data/parlays.json` — **no client fetches**, no `use client` anywhere in this plan.
- Design-inspector rules (all enforced by `npm run design:inspect`): page must contain `<WCS26Shell`, `<RouteStack`, `<CanvasSection`; no raw hex outside globals.css/kit-color; no arbitrary px/rem utilities; no `rounded-2xl/3xl/4xl` (use `rounded-[var(--radius-card)]`); text tokens only (`text-hero/display/title/body/label/caption/micro`); every JSX line rendering a computed number must include `tabular`; no `shadow-*` utilities; `--accent` interactive-only; data-semantic color via `--up/--down`/`verdictVar` only.
- Honesty-first: misses and no-slip records render as prominently as hits; no fabricated numbers — every figure comes from the ledger.
- Spec §8 requires the UI work (Tasks 2-3) to run under the `frontend-design` skill — the executor invokes it before writing the card/page markup; the shipped Linear system (Surface, type tokens, `--accent` interactive-only) is the fixed aesthetic direction, not up for reinterpretation.
- JSX: literal unicode only (✓ ✗ · —), NEVER HTML entities in new code.
- Never run `npm run matchday` / `ml:fetch` / `ml:cycle`.
- Gates before every commit claim: `npx vitest run` · `npx eslint .` · `npm run build` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect` · `npm run parlay:inspect`.
- Conventional commits; no Co-Authored-By trailer.
- Ledger row shape (produced by `scripts/lock-parlays.mts`, PR #48):
  ```json
  { "slug": "...", "lockedAt": "ISO", "modelDataThrough": "YYYY-MM-DD", "eloDiff": 151,
    "lambdas": { "home": 1.61, "away": 0.85 }, "rho": -0.05, "etWinProbHome": 0.607,
    "legs": [{ "ticker": "...", "side": "yes|no", "title": "...", "modelProb": 0.998,
               "kalshiMid": 0.99, "reasoning": "..." }],
    "jointProb": 0.862,
    "result": { "legs": [{ "ticker": "...", "hit": true }], "slipHit": false, "gradedAt": "ISO" } }
  ```
  or `{ "slug": "...", "lockedAt": "ISO", "verdict": "no-slip", "reason": "..." }`. `result` absent until graded.

---

### Task 1: View model — `lib/parlay-view.ts`

**Files:**
- Create: `lib/parlay-view.ts`
- Test: `tests/parlay-view.test.ts`

**Interfaces:**
- Consumes: `@/data/parlays.json`, `allFixtures`, `clubById` from `@/lib/data` (loader only — pure functions take rows as arguments).
- Produces (later tasks rely on these exact names):
  ```ts
  export type ParlayLegRow = { ticker: string; side: "yes" | "no"; title: string; modelProb: number; kalshiMid: number | null; reasoning: string };
  export type ParlaySlipRow = { slug: string; lockedAt: string; verdict?: "no-slip"; reason?: string; modelDataThrough?: string; legs?: ParlayLegRow[]; jointProb?: number; result?: { legs: Array<{ ticker: string; hit: boolean }>; slipHit: boolean; gradedAt: string } };
  export type ParlayLegView = ParlayLegRow & { hit: boolean | null };
  export type ParlaySlipView = { slug: string; matchup: string; stage?: string; kickoffISO: string; lockedAt: string; status: "open" | "hit" | "miss" | "no-slip"; reason?: string; legs: ParlayLegView[]; jointProb?: number };
  export type ParlayRecord = { slips: number; noSlips: number; graded: number; slipHits: number; slipHitRate: number | null; legs: number; legHits: number; legHitRate: number | null; meanLockedJoint: number | null };
  export function buildParlayViews(rows: ParlaySlipRow[], fixtures: Array<{ slug: string; homeId: string; awayId: string; kickoffISO: string; stage?: string }>, clubName: (id: string) => string): ParlaySlipView[];
  export function parlayRecord(rows: ParlaySlipRow[]): ParlayRecord;
  export function parlayViews(): ParlaySlipView[];   // loader: ledger + fixtures + club names
  export function parlayLedger(): ParlaySlipRow[];   // loader: raw ledger rows
  ```

- [ ] **Step 0: Branch off updated main**

```bash
git checkout main && git pull --ff-only && git checkout -b feat/parlay-page
```

- [ ] **Step 1: Write the failing tests**

```ts
// tests/parlay-view.test.ts
import { describe, expect, it } from "vitest";
import { buildParlayViews, parlayRecord, type ParlaySlipRow } from "../lib/parlay-view";

const leg = (ticker: string, modelProb = 0.9): ParlaySlipRow["legs"] extends Array<infer L> | undefined ? L : never => ({
  ticker, side: "no", title: `t-${ticker}`, modelProb, kalshiMid: 0.95, reasoning: `r-${ticker}`,
});

const rows: ParlaySlipRow[] = [
  { slug: "france-vs-morocco", lockedAt: "2026-07-08T17:00:00Z", legs: [leg("A"), leg("B")], jointProb: 0.86 },
  {
    slug: "spain-vs-belgium", lockedAt: "2026-07-08T17:00:00Z",
    legs: [leg("C"), leg("D"), leg("E")], jointProb: 0.55,
    result: { legs: [{ ticker: "C", hit: true }, { ticker: "D", hit: false }, { ticker: "E", hit: true }], slipHit: false, gradedAt: "2026-07-10T22:00:00Z" },
  },
  {
    slug: "norway-vs-england", lockedAt: "2026-07-08T17:00:00Z",
    legs: [leg("F"), leg("G")], jointProb: 0.84,
    result: { legs: [{ ticker: "F", hit: true }, { ticker: "G", hit: true }], slipHit: true, gradedAt: "2026-07-11T23:00:00Z" },
  },
  { slug: "argentina-vs-switzerland", lockedAt: "2026-07-08T17:00:00Z", verdict: "no-slip", reason: "no 2-leg combo ≥ floors" },
];

const fixtures = [
  { slug: "france-vs-morocco", homeId: "fra", awayId: "mar", kickoffISO: "2026-07-09T20:00:00Z", stage: "quarter-final" },
  { slug: "spain-vs-belgium", homeId: "esp", awayId: "bel", kickoffISO: "2026-07-10T19:00:00Z", stage: "quarter-final" },
  { slug: "norway-vs-england", homeId: "nor", awayId: "eng", kickoffISO: "2026-07-11T21:00:00Z", stage: "quarter-final" },
  { slug: "argentina-vs-switzerland", homeId: "arg", awayId: "sui", kickoffISO: "2026-07-12T01:00:00Z", stage: "quarter-final" },
];
const clubName = (id: string) => ({ fra: "France", mar: "Morocco", esp: "Spain", bel: "Belgium", nor: "Norway", eng: "England", arg: "Argentina", sui: "Switzerland" })[id] ?? id;

describe("buildParlayViews", () => {
  const views = buildParlayViews(rows, fixtures, clubName);

  it("maps status: open / miss / hit / no-slip", () => {
    const bySlug = new Map(views.map((v) => [v.slug, v]));
    expect(bySlug.get("france-vs-morocco")?.status).toBe("open");
    expect(bySlug.get("spain-vs-belgium")?.status).toBe("miss");
    expect(bySlug.get("norway-vs-england")?.status).toBe("hit");
    expect(bySlug.get("argentina-vs-switzerland")?.status).toBe("no-slip");
  });

  it("joins matchup and stage from fixtures", () => {
    const v = views.find((x) => x.slug === "france-vs-morocco");
    expect(v?.matchup).toBe("France vs Morocco");
    expect(v?.stage).toBe("quarter-final");
    expect(v?.kickoffISO).toBe("2026-07-09T20:00:00Z");
  });

  it("maps per-leg hit by ticker (null when ungraded)", () => {
    const graded = views.find((x) => x.slug === "spain-vs-belgium");
    expect(graded?.legs.map((l) => l.hit)).toEqual([true, false, true]);
    const open = views.find((x) => x.slug === "france-vs-morocco");
    expect(open?.legs.map((l) => l.hit)).toEqual([null, null]);
  });

  it("keeps a no-slip record with its reason and zero legs", () => {
    const ns = views.find((x) => x.slug === "argentina-vs-switzerland");
    expect(ns?.reason).toBe("no 2-leg combo ≥ floors");
    expect(ns?.legs).toEqual([]);
  });

  it("sorts by kickoff ascending", () => {
    expect(views.map((v) => v.slug)).toEqual([
      "france-vs-morocco", "spain-vs-belgium", "norway-vs-england", "argentina-vs-switzerland",
    ]);
  });
});

describe("parlayRecord", () => {
  it("computes running slip/leg hit rates and locked-joint mean over graded slips", () => {
    const r = parlayRecord(rows);
    expect(r.slips).toBe(3);
    expect(r.noSlips).toBe(1);
    expect(r.graded).toBe(2);
    expect(r.slipHits).toBe(1);
    expect(r.slipHitRate).toBeCloseTo(0.5, 10);
    expect(r.legs).toBe(5);
    expect(r.legHits).toBe(4);
    expect(r.legHitRate).toBeCloseTo(0.8, 10);
    expect(r.meanLockedJoint).toBeCloseTo((0.55 + 0.84) / 2, 10);
  });

  it("returns null rates when nothing graded", () => {
    const r = parlayRecord([rows[0], rows[3]]);
    expect(r.graded).toBe(0);
    expect(r.slipHitRate).toBeNull();
    expect(r.legHitRate).toBeNull();
    expect(r.meanLockedJoint).toBeNull();
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/parlay-view.test.ts` → FAIL (`lib/parlay-view` missing).

- [ ] **Step 3: Implement**

```ts
// lib/parlay-view.ts
// View model for the /parlay page: ledger rows + fixtures → slip cards +
// running record. Pure functions take rows as arguments; loaders at the
// bottom bind them to the committed data files (single source of truth).
import "server-only";
import parlaysJson from "@/data/parlays.json";
import { allFixtures, clubById } from "@/lib/data";

export type ParlayLegRow = {
  ticker: string;
  side: "yes" | "no";
  title: string;
  modelProb: number;
  kalshiMid: number | null;
  reasoning: string;
};

export type ParlaySlipRow = {
  slug: string;
  lockedAt: string;
  verdict?: "no-slip";
  reason?: string;
  modelDataThrough?: string;
  legs?: ParlayLegRow[];
  jointProb?: number;
  result?: { legs: Array<{ ticker: string; hit: boolean }>; slipHit: boolean; gradedAt: string };
};

export type ParlayLegView = ParlayLegRow & { hit: boolean | null };

export type ParlaySlipView = {
  slug: string;
  matchup: string;
  stage?: string;
  kickoffISO: string;
  lockedAt: string;
  status: "open" | "hit" | "miss" | "no-slip";
  reason?: string;
  legs: ParlayLegView[];
  jointProb?: number;
};

export type ParlayRecord = {
  slips: number;
  noSlips: number;
  graded: number;
  slipHits: number;
  slipHitRate: number | null;
  legs: number;
  legHits: number;
  legHitRate: number | null;
  meanLockedJoint: number | null;
};

export function buildParlayViews(
  rows: ParlaySlipRow[],
  fixtures: Array<{ slug: string; homeId: string; awayId: string; kickoffISO: string; stage?: string }>,
  clubName: (id: string) => string,
): ParlaySlipView[] {
  const bySlug = new Map(fixtures.map((f) => [f.slug, f]));
  const views: ParlaySlipView[] = [];
  for (const row of rows) {
    const f = bySlug.get(row.slug);
    if (!f) continue; // ledger row without a fixture: never render fabricated context
    const hitBy = new Map((row.result?.legs ?? []).map((l) => [l.ticker, l.hit]));
    const status: ParlaySlipView["status"] =
      row.verdict === "no-slip" ? "no-slip" : row.result ? (row.result.slipHit ? "hit" : "miss") : "open";
    views.push({
      slug: row.slug,
      matchup: `${clubName(f.homeId)} vs ${clubName(f.awayId)}`,
      stage: f.stage,
      kickoffISO: f.kickoffISO,
      lockedAt: row.lockedAt,
      status,
      ...(row.reason !== undefined ? { reason: row.reason } : {}),
      legs: (row.legs ?? []).map((leg) => ({ ...leg, hit: hitBy.get(leg.ticker) ?? null })),
      ...(row.jointProb !== undefined ? { jointProb: row.jointProb } : {}),
    });
  }
  return views.sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime() || a.slug.localeCompare(b.slug),
  );
}

export function parlayRecord(rows: ParlaySlipRow[]): ParlayRecord {
  const locked = rows.filter((r) => r.verdict !== "no-slip");
  const graded = locked.filter((r) => r.result);
  const slipHits = graded.filter((r) => r.result?.slipHit).length;
  const legRows = graded.flatMap((r) => r.result?.legs ?? []);
  const legHits = legRows.filter((l) => l.hit).length;
  const joints = graded.map((r) => r.jointProb).filter((j): j is number => typeof j === "number");
  return {
    slips: locked.length,
    noSlips: rows.length - locked.length,
    graded: graded.length,
    slipHits,
    slipHitRate: graded.length > 0 ? slipHits / graded.length : null,
    legs: legRows.length,
    legHits,
    legHitRate: legRows.length > 0 ? legHits / legRows.length : null,
    meanLockedJoint: joints.length > 0 ? joints.reduce((a, b) => a + b, 0) / joints.length : null,
  };
}

export function parlayLedger(): ParlaySlipRow[] {
  return parlaysJson as ParlaySlipRow[];
}

export function parlayViews(): ParlaySlipView[] {
  return buildParlayViews(parlayLedger(), allFixtures(), (id) => clubById(id).name);
}
```

**Implementer notes:**
- `server-only` is stubbed in vitest via the existing alias (`tests/__stubs__/server-only.ts`) — tests import the pure functions and never call the loaders.
- If `parlaysJson` type inference fights the assertion (JSON import widens literals), use `parlaysJson as unknown as ParlaySlipRow[]`.
- The `leg` helper's conditional-type gymnastics in the test file can be simplified to a plain `ParlayLegRow` return type if TS complains — `import type { ParlayLegRow }` and annotate directly.

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/parlay-view.test.ts` → 7 passed.
- [ ] **Step 5: Full suite** — `npx vitest run` → green (455 + 7).
- [ ] **Step 6: Commit**

```bash
git add lib/parlay-view.ts tests/parlay-view.test.ts
git commit -m "feat(parlay): view model - slip views + running record from the ledger"
```

---

### Task 2: Slip card — `components/parlay-slip-card.tsx`

**Files:**
- Create: `components/parlay-slip-card.tsx`
- Test: `tests/parlay-slip-card.test.tsx`

**Interfaces:**
- Consumes: `ParlaySlipView`, `ParlayLegView` from `@/lib/parlay-view` (Task 1); `StageChip` from `@/components/stage-chip`; `VerdictChip` from `@/components/verdict-chip`; `verdictVar` from `@/lib/kit-color`; `Surface` from `@/components/ui/surface`.
- Produces: `export function ParlaySlipCard({ slip }: { slip: ParlaySlipView }): JSX element` — server-safe (no hooks, no `use client`); expandable reasoning via native `<details>`.

- [ ] **Step 1: Write the failing render test**

```tsx
// tests/parlay-slip-card.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParlaySlipCard } from "../components/parlay-slip-card";
import type { ParlaySlipView } from "../lib/parlay-view";

const base = {
  slug: "spain-vs-belgium",
  matchup: "Spain vs Belgium",
  stage: "quarter-final",
  kickoffISO: "2026-07-10T19:00:00Z",
  lockedAt: "2026-07-08T17:00:00Z",
};

const gradedMiss: ParlaySlipView = {
  ...base,
  status: "miss",
  jointProb: 0.552,
  legs: [
    { ticker: "T1", side: "no", title: "Will over 5.5 goals be scored?", modelProb: 0.961, kalshiMid: 0.945, reasoning: "r1", hit: true },
    { ticker: "T2", side: "yes", title: "Spain wins?", modelProb: 0.62, kalshiMid: null, reasoning: "r2", hit: false },
  ],
};

describe("ParlaySlipCard", () => {
  it("graded slip renders per-leg ✓/✗, joint prob, and model vs Kalshi", () => {
    const html = renderToStaticMarkup(<ParlaySlipCard slip={gradedMiss} />);
    expect(html).toContain("Spain vs Belgium");
    expect(html).toContain("✓");
    expect(html).toContain("✗");
    expect(html).toContain("55.2%"); // joint
    expect(html).toContain("96.1%"); // model leg prob
    expect(html).toContain("94.5%"); // kalshi side mid
    expect(html).toContain("n/a"); // null kalshiMid leg
    expect(html).toContain("Miss"); // slip verdict, rendered as prominently as a hit
    expect(html).toContain("r1"); // reasoning present in the expandable section
  });

  it("open slip renders no ✓/✗ and an open status", () => {
    const open: ParlaySlipView = { ...gradedMiss, status: "open", legs: gradedMiss.legs.map((l) => ({ ...l, hit: null })) };
    const html = renderToStaticMarkup(<ParlaySlipCard slip={open} />);
    expect(html).not.toContain("✓");
    expect(html).not.toContain("✗");
    expect(html).toContain("Open");
  });

  it("no-slip record renders the machine-checkable reason", () => {
    const noSlip: ParlaySlipView = { ...base, status: "no-slip", reason: "no 2-leg combo ≥ floors", legs: [] };
    const html = renderToStaticMarkup(<ParlaySlipCard slip={noSlip} />);
    expect(html).toContain("No slip");
    expect(html).toContain("no 2-leg combo ≥ floors");
  });
});
```

- [ ] **Step 2: Run to verify fail** — `npx vitest run tests/parlay-slip-card.test.tsx` → FAIL (component missing).

- [ ] **Step 3: Implement**

```tsx
// components/parlay-slip-card.tsx
// Kalshi-style slip card. Server-safe: no hooks; reasoning expands via
// native <details>. Honesty-first: misses render exactly like hits.
import { Surface } from "@/components/ui/surface";
import { StageChip } from "@/components/stage-chip";
import { VerdictChip } from "@/components/verdict-chip";
import { verdictVar } from "@/lib/kit-color";
import type { ParlayLegView, ParlaySlipView } from "@/lib/parlay-view";

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function sideMid(leg: ParlayLegView): string {
  if (leg.kalshiMid === null) return "n/a";
  return pct(leg.kalshiMid);
}

function LegRow({ leg }: { leg: ParlayLegView }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">{leg.side}</span>
      <div className="min-w-0">
        <p className="text-caption text-[var(--ink)]">
          {leg.hit !== null && (
            <span className="mr-1" style={{ color: verdictVar(leg.hit ? "hit" : "miss") }}>
              {leg.hit ? "✓" : "✗"}
            </span>
          )}
          {leg.title}
        </p>
      </div>
      <span className="text-caption tabular text-[var(--ink-muted)]">
        model {pct(leg.modelProb)} · Kalshi {sideMid(leg)}
      </span>
    </div>
  );
}

function StatusChip({ slip }: { slip: ParlaySlipView }) {
  if (slip.status === "hit") return <VerdictChip verdict="hit" />;
  if (slip.status === "miss") return <VerdictChip verdict="miss" />;
  const label = slip.status === "open" ? "Open" : "No slip";
  return (
    <span className="text-label inline-flex items-center rounded-sm border border-[var(--line)] px-2 py-0.5 text-[var(--ink-muted)]">
      {label}
    </span>
  );
}

export function ParlaySlipCard({ slip }: { slip: ParlaySlipView }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StageChip stage={slip.stage} />
          <span className="text-body font-medium text-[var(--ink)]">{slip.matchup}</span>
        </div>
        <StatusChip slip={slip} />
      </div>

      {slip.status === "no-slip" ? (
        <p className="mt-3 text-caption text-[var(--ink-muted)]">
          No slip cleared the pre-registered floors: {slip.reason}
        </p>
      ) : (
        <>
          <div className="mt-3">
            {slip.legs.map((leg) => (
              <LegRow key={leg.ticker} leg={leg} />
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-label uppercase tracking-widest text-[var(--ink-faint)]">
              {slip.legs.length}-leg joint
            </span>
            {slip.jointProb !== undefined && (
              <span className="text-title tabular text-[var(--ink)]">{pct(slip.jointProb)}</span>
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-label text-[var(--ink-muted)]">
              Per-leg reasoning
            </summary>
            <ul className="mt-2 space-y-2">
              {slip.legs.map((leg) => (
                <li key={leg.ticker} className="text-caption tabular text-[var(--ink-muted)]">
                  {leg.reasoning}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Surface>
  );
}
```

**Implementer notes:**
- Token names `--ink`, `--ink-muted`, `--ink-faint`, `--line` are the shipped text/hairline tokens (see `app/matches/page.tsx` for usage). Verify against `globals.css` and use the exact names present there — if the repo uses different muted-ink names, match the repo.
- Every line interpolating a number carries `tabular` (design-inspector `tabular-numbers` rule fires per line).
- Unicode ✓ ✗ · are literal characters — no HTML entities.
- `VerdictChip` renders "Hit"/"Miss" labels via `verdictDisplay` — the test asserts on "Miss".

- [ ] **Step 4: Run to verify pass** — `npx vitest run tests/parlay-slip-card.test.tsx` → 3 passed.
- [ ] **Step 5: Full suite** — `npx vitest run` → green.
- [ ] **Step 6: Commit**

```bash
git add components/parlay-slip-card.tsx tests/parlay-slip-card.test.tsx
git commit -m "feat(parlay): slip card - legs, model vs Kalshi chips, verdicts, expandable reasoning"
```

---

### Task 3: Route — `app/parlay/page.tsx` + nav tab

**Files:**
- Create: `app/parlay/page.tsx`
- Modify: `components/wc26-shell-header.tsx` (MAIN_NAV array, after the "Simulate" entry)
- Test: covered by Task 1/2 unit render tests + `npm run build` static render + `npm run design:inspect` (page rules assert shell/section/token compliance). No new test file.

**Interfaces:**
- Consumes: `parlayViews`, `parlayRecord`, `parlayLedger` from `@/lib/parlay-view`; `ParlaySlipCard` from `@/components/parlay-slip-card`; `WCS26Shell`, `RouteStack`, `CanvasSection`, `DataPlane`, `SignalLine` from the shipped shell/cinematic system.
- Produces: static route `/parlay`; nav tab `{ label: "Parlays", href: "/parlay", routeKey: "parlay" }`.

- [ ] **Step 1: Add the nav tab** — in `components/wc26-shell-header.tsx`, MAIN_NAV gains one entry after Simulate:

```ts
  { label: "Simulate", href: "/simulator", routeKey: "simulator" },
  { label: "Parlays", href: "/parlay", routeKey: "parlay" },
  { label: "Methodology", href: "/methodology", routeKey: "methodology" },
```

- [ ] **Step 2: Implement the page**

```tsx
// app/parlay/page.tsx
import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { ParlaySlipCard } from "@/components/parlay-slip-card";
import { parlayLedger, parlayRecord, parlayViews } from "@/lib/parlay-view";

export const metadata = { title: "Parlays — Matchday Briefing" };

const pct = (x: number | null): string => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export default function ParlayPage() {
  const views = parlayViews();
  const record = parlayRecord(parlayLedger());

  const open = views.filter((v) => v.status === "open");
  const settled = views
    .filter((v) => v.status !== "open")
    .sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());

  return (
    <WCS26Shell
      route="parlay"
      title="Parlay Slips"
      rail={
        <div className="flex flex-col gap-3">
          <SignalLine
            signals={[
              { label: "Locked", value: record.slips, detail: "slips" },
              { label: "Graded", value: record.graded, detail: "settled" },
              { label: "Slip hits", value: record.slipHits, tone: "up", detail: `of ${record.graded} graded` },
              { label: "Leg hits", value: record.legHits, detail: `of ${record.legs} legs` },
            ]}
          />
          <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)] lg:text-right">
            Selection is pure model · Kalshi mids shown for benchmark only
          </span>
        </div>
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Open" title="Locked slips awaiting kickoff.">
          <DataPlane>
            {open.length === 0 ? (
              <p className="text-caption text-[var(--ink-muted)]">
                No open slips — the next lock runs before the coming round.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {open.map((slip) => (
                  <ParlaySlipCard key={slip.slug} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Record" title="Every slip, graded in public.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              Slip hit rate {pct(record.slipHitRate)} · leg hit rate {pct(record.legHitRate)} · locked joint
              average {pct(record.meanLockedJoint)} across graded slips. No-slip days recorded: {record.noSlips}.
            </p>
            {settled.length === 0 ? (
              <p className="mt-3 text-caption text-[var(--ink-muted)]">
                Nothing graded yet — the first slips settle with the quarter-finals.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {settled.map((slip) => (
                  <ParlaySlipCard key={slip.slug} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Protocol" title="Pre-registered, immutable, inspected.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              One slip per match, locked pre-kickoff into an append-only ledger. Legs come only from
              Kalshi-listed markets the model can price on its score grid; selection maximizes exact joint
              probability under pre-registered floors (every leg ≥ 60%, joint ≥ 35%, 2–5 legs, redundancy
              cap 97%). Regulation legs grade on the 90-minute score, advancement legs on the actual
              winner. A dedicated inspector recomputes every number from stored inputs on every run.
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
```

**Implementer notes:**
- `SignalLine` value slots take counts (numbers) — rates live in `detail` strings and the Record section (matches `app/matches/page.tsx` idiom).
- The Protocol copy contains only pre-registered constants (60/35/97/2–5) — they are spec constants, not computed numbers, but the paragraph still carries `tabular` for the inspector's line rule.
- If `SignalLine`'s `tone` prop rejects `"up"` on a zero value awkwardly, drop the tone — data-semantic color is optional here.

- [ ] **Step 3: Verify** — `npx vitest run` green · `npm run build` renders `/parlay` (check route listed in build output) · `npm run design:inspect` passes.
- [ ] **Step 4: Commit**

```bash
git add app/parlay/page.tsx components/wc26-shell-header.tsx
git commit -m "feat(parlay): /parlay route - open slips, graded record, protocol section, nav tab"
```

---

### Task 4: Methodology ET-share note (spec §12) + full gates

**Files:**
- Modify: `app/methodology/page.tsx` (add one `Principle` to the "Protocol" CanvasSection, after the "Scoring" principle)

- [ ] **Step 1: Add the principle** — inside `<CanvasSection eyebrow="Protocol" title="Lock, settle, score">`, after the existing `<Principle title="Scoring">` block:

```tsx
            <Principle title="Parlay slips">
              Parlay legs are priced exactly on the model score grid and graded on the same
              90-minute semantics as predictions; advancement legs settle on the actual winner.
              The extra-time share behind advancement pricing is deliberately crude — an Elo
              logistic with no penalty-shootout skill term, the same convention the simulator
              ships. Consistency over false precision. Kalshi mids never influence selection.
            </Principle>
```

(Match the surrounding `Principle` children format — if siblings wrap copy in plain text, do the same; keep literal unicode.)

- [ ] **Step 2: Full gates**

```bash
npx vitest run && npx eslint . && npm run build && npm run design:inspect && npm run inspect:execution && npm run model:inspect && npm run parlay:inspect
```

Expected: all green (455 + ~10 new tests; eslint 0 errors / 12 pre-existing warnings; build includes `/parlay`).

- [ ] **Step 3: Commit**

```bash
git add app/methodology/page.tsx
git commit -m "docs(methodology): parlay grading semantics + ET-share convention note"
```

---

### Task 5: Push + PR (Plan B complete)

- [ ] `git push -u origin feat/parlay-page`
- [ ] `gh pr create` — title `feat(parlay): /parlay page — slip cards, graded record, methodology note`; body: summary (view model + server-safe card + static route, honesty-first record section, nav tab, ET-share methodology note), screenshots note (4 live QF slips render as Open), test plan checklist (suite count, eslint, build, all four inspectors + parlay:inspect). End with the Claude Code attribution line.
