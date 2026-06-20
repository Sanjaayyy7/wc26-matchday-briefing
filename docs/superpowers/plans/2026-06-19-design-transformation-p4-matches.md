# Design Transformation — Phase 4: Matches (Locked Predictions) Rewrite

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans. Keep the spec open: `docs/superpowers/specs/2026-06-19-wc26-design-transformation.md` §"Page 3: Matches" (lines ~635–731). Steps use checkbox (`- [ ]`) syntax.

**Goal:** Rewrite the Matches page into the spec's operational ledger: a record-specific status rail with the accountability stamp, status filter tabs (All / Settled / Locked / Upcoming) with live counts and URL state, and a 5-column match table (Fixture / Result·Status / H·D·A / Brier / Verdict) with Brier-header sort — consuming the P1 primitives (`VerdictChip`, `BrierBar`).

**Architecture:** `app/matches/page.tsx` already feeds `allMatchRows()` (`MatchRowData[]`) to a `MatchesFilter` client component. Rewrite `MatchesFilter`'s internals into the spec's tabs + match table; rewrite the page's rail + wrap the filter in `<Suspense>` (required because the tabs read `useSearchParams` on a statically-prerendered route). No hero, no intelligence cards — this page is operational. Keep the existing knockout-shell section (real R32 bracket content, not part of the redesign but non-conflicting).

**Tech Stack:** Next.js 16.2.6, React 19, Tailwind v4, P1 primitives, `useSearchParams`/`useRouter`, `vitest`.

## Global Constraints

- Hybrid premium-within-system: institutional/anti-glass, house tokens, inspector-clean (no raw hex in tsx; no arbitrary `text-[..px]`/`gap-[..px]`/`border-[..px]`; `data-mono`/`tabular` on numerics; `duration-300` motion only; no glow/blur/gradient).
- Number rules (spec §2): `tabular-nums`; Brier 3 decimals; probabilities integer; H/D/A as `64 / 23 / 13`.
- Page-shell rule (design-inspector): page MUST keep `<WCS26Shell>` + `<RouteStack>` + `<CanvasSection>`.
- Accountability stamp text (spec §707, verbatim): `All predictions locked pre-kickoff · Never edited after lock` — lives in the status rail, visible on every load.
- Internal navigation uses `next/link` `<Link>`, never `<a href>`.
- `useSearchParams` on a prerendered route requires a `<Suspense>` boundary (Next docs: `node_modules/next/dist/docs/01-app/03-api-reference/04-functions/use-search-params.md`). Run all commands from `app/`.

## Verified available data

`allMatchRows(): MatchRowData[]` where `MatchRowData = { slug; dateLabel; group; stage; homeName; awayName; homeShort; awayShort; status: "official"|"informational"|"locked"|"upcoming"; score?; split?{home,draw,away}; verdict?: Verdict; grade?{brier,rps}; note? }`. Status mapping: **Settled** = `official`, **Locked** = `locked`, **Upcoming** = `upcoming`, **Informational** = `informational`. `WCS26Shell` renders the `rail` node in the right header cell.

---

### Task 1: Brier sort for match rows (pure logic, TDD)

**Files:**
- Create: `lib/match-sort.ts`
- Test: `tests/match-sort.test.ts`

**Interfaces produced:** `sortMatchesByBrier<T extends { grade?: { brier: number } }>(rows: T[], dir: "asc" | "desc"): T[]` — rows with a `grade` sort by Brier; rows without keep their original (chronological) order, appended after. Pure, non-mutating.

- [ ] **Step 1: Write the failing test** — `tests/match-sort.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { sortMatchesByBrier } from "@/lib/match-sort";

const rows = [
  { id: "a", grade: { brier: 0.9 } },
  { id: "b" },
  { id: "c", grade: { brier: 0.2 } },
  { id: "d" },
  { id: "e", grade: { brier: 0.5 } },
];

describe("sortMatchesByBrier", () => {
  it("sorts graded rows ascending, ungraded keep chronological order after", () => {
    expect(sortMatchesByBrier(rows, "asc").map((r) => r.id)).toEqual(["c", "e", "a", "b", "d"]);
  });
  it("sorts graded rows descending, ungraded keep chronological order after", () => {
    expect(sortMatchesByBrier(rows, "desc").map((r) => r.id)).toEqual(["a", "e", "c", "b", "d"]);
  });
  it("does not mutate the input", () => {
    const copy = rows.map((r) => r.id);
    sortMatchesByBrier(rows, "asc");
    expect(rows.map((r) => r.id)).toEqual(copy);
  });
});
```

- [ ] **Step 2: Run, verify fail** — `npx vitest run tests/match-sort.test.ts` → FAIL (module not found).

- [ ] **Step 3: Implement** — `lib/match-sort.ts`:

```ts
/** Sort graded rows by Brier; ungraded rows keep their original order, appended after. Pure. */
export function sortMatchesByBrier<T extends { grade?: { brier: number } }>(
  rows: T[],
  dir: "asc" | "desc",
): T[] {
  const graded = rows.filter((r) => r.grade);
  const ungraded = rows.filter((r) => !r.grade);
  graded.sort((a, b) =>
    dir === "asc" ? a.grade!.brier - b.grade!.brier : b.grade!.brier - a.grade!.brier,
  );
  return [...graded, ...ungraded];
}
```

- [ ] **Step 4: Run, verify pass** — `npx vitest run tests/match-sort.test.ts` → 3 passed.

- [ ] **Step 5: Commit** — `git add lib/match-sort.ts tests/match-sort.test.ts && git commit -m "feat(matches): add pure sortMatchesByBrier comparator (TDD)"`

---

### Task 2: Rewrite `components/matches-filter.tsx` — tabs + match table

**Files:** Modify `components/matches-filter.tsx` (full rewrite).

**Interfaces:** Consumes `MatchRowData` (`@/lib/match-view`), `sortMatchesByBrier` (Task 1), `VerdictChip` (`@/components/verdict-chip`), `BrierBar` (`@/components/brier-bar`), `useSearchParams`/`useRouter`/`usePathname` (`next/navigation`), `Link` (`next/link`). Produces the default-exported `MatchesFilter({ rows }: { rows: MatchRowData[] })`.

Spec L2 (tabs) + L3 (table) + interaction model (URL `?filter=`, row → `/fixture/[slug]`, hover tint, Brier-header sort) + mobile (RPS/H·D·A reduce).

- [ ] **Step 1: Full rewrite** — `components/matches-filter.tsx`:

```tsx
"use client";

import { useMemo, useState } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import Link from "next/link";
import { VerdictChip } from "./verdict-chip";
import { BrierBar } from "./brier-bar";
import { sortMatchesByBrier } from "@/lib/match-sort";
import type { MatchRowData } from "@/lib/match-view";

type FilterKey = "all" | "settled" | "locked" | "upcoming";
const FILTERS: FilterKey[] = ["all", "settled", "upcoming", "locked"];
const LABEL: Record<FilterKey, string> = {
  all: "All matches",
  settled: "Settled",
  upcoming: "Upcoming",
  locked: "Locked",
};

function matches(row: MatchRowData, key: FilterKey): boolean {
  if (key === "all") return true;
  if (key === "settled") return row.status === "official";
  if (key === "locked") return row.status === "locked";
  return row.status === "upcoming";
}

const COLS = "grid grid-cols-[1.8fr_0.9fr_1fr_0.9fr_0.8fr] gap-4";

export function MatchesFilter({ rows }: { rows: MatchRowData[] }) {
  const router = useRouter();
  const pathname = usePathname();
  const params = useSearchParams();
  const initial = (params.get("filter") as FilterKey) ?? "all";
  const [filter, setFilter] = useState<FilterKey>(
    FILTERS.includes(initial) ? initial : "all",
  );
  const [query, setQuery] = useState("");
  const [brierDir, setBrierDir] = useState<"asc" | "desc" | null>(null);

  const counts = useMemo(
    () => ({
      all: rows.length,
      settled: rows.filter((r) => r.status === "official").length,
      upcoming: rows.filter((r) => r.status === "upcoming").length,
      locked: rows.filter((r) => r.status === "locked").length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const base = rows.filter(
      (r) =>
        matches(r, filter) &&
        (!query || `${r.homeName} ${r.awayName}`.toLowerCase().includes(query.toLowerCase())),
    );
    return brierDir ? sortMatchesByBrier(base, brierDir) : base;
  }, [rows, filter, query, brierDir]);

  function pick(key: FilterKey) {
    setFilter(key);
    const next = new URLSearchParams(params.toString());
    if (key === "all") next.delete("filter");
    else next.set("filter", key);
    const qs = next.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  const tab = (active: boolean) =>
    `text-label h-9 shrink-0 border-b px-1 transition-colors duration-300 ${
      active
        ? "border-[var(--ink)] text-[var(--ink)]"
        : "border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
    }`;
  const arrow = brierDir === "asc" ? "↑" : brierDir === "desc" ? "↓" : "";

  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center gap-4">
        <div className="flex min-w-0 gap-4 overflow-x-auto">
          {FILTERS.map((key) => (
            <button key={key} className={tab(filter === key)} onClick={() => pick(key)}>
              {LABEL[key]}{" "}
              <span className="text-mono data-mono tabular text-[var(--ink-faint)]">{counts[key]}</span>
            </button>
          ))}
        </div>
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search team"
          aria-label="Search team"
          className="text-label h-9 min-w-0 flex-1 border-b border-[var(--line)] bg-transparent px-1 outline-none placeholder:text-[var(--ink-faint)] sm:max-w-48"
        />
      </div>

      <div className={`${COLS} border-b border-[var(--line)] pb-2 text-micro uppercase tracking-widest text-[var(--ink-faint)]`}>
        <span>Fixture</span>
        <span>Result · Status</span>
        <span className="hidden sm:block">H · D · A</span>
        <button
          type="button"
          onClick={() => setBrierDir((d) => (d === "asc" ? "desc" : d === "desc" ? null : "asc"))}
          className="flex items-center gap-1 text-left uppercase tracking-widest transition-colors duration-300 hover:text-[var(--ink)]"
        >
          Brier {arrow}
        </button>
        <span className="text-right">Verdict</span>
      </div>

      <div>
        {visible.map((r) => (
          <Link
            key={r.slug}
            href={`/fixture/${r.slug}`}
            className={`${COLS} items-center border-b border-[var(--hairline)] py-3 last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]`}
          >
            <div className="min-w-0">
              <div className="text-title truncate">{r.homeShort} vs {r.awayShort}</div>
              <div className="text-caption text-[var(--ink-faint)] truncate">
                {r.stage} · {r.dateLabel}{r.group ? ` · Group ${r.group}` : ""}
              </div>
            </div>
            <div className="min-w-0">
              {r.score ? (
                <span className="text-mono data-mono tabular">{r.score}</span>
              ) : (
                <span className="text-caption uppercase tracking-widest text-[var(--ink-faint)]">
                  {r.status === "locked" ? "Locked" : r.status === "upcoming" ? "Upcoming" : "—"}
                </span>
              )}
            </div>
            <div className="hidden sm:block">
              {r.split ? (
                <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
                  <span className="text-[var(--up)]">{r.split.home}</span> / {r.split.draw} /{" "}
                  <span className="text-[var(--down)]">{r.split.away}</span>
                </span>
              ) : (
                <span className="text-[var(--ink-faint)]">—</span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {r.grade ? (
                <>
                  <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{r.grade.brier.toFixed(3)}</span>
                  <BrierBar brier={r.grade.brier} />
                </>
              ) : (
                <span className="text-[var(--ink-faint)]">—</span>
              )}
            </div>
            <div className="flex justify-end">
              {r.verdict ? <VerdictChip verdict={r.verdict} /> : <span className="text-[var(--ink-faint)]">—</span>}
            </div>
          </Link>
        ))}
        {visible.length === 0 && <p className="text-caption py-6">No matches in this view.</p>}
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Inspector + eslint** — `node --import tsx scripts/design-inspector.mts` (green) and `npx eslint components/matches-filter.tsx` (clean). Commit: `git add components/matches-filter.tsx && git commit -m "feat(matches): rewrite filter into status tabs + match table (BrierBar + VerdictChip)"`

---

### Task 3: Rewrite `app/matches/page.tsx` — rail, stamp, Suspense

**Files:** Modify `app/matches/page.tsx`.

- [ ] **Step 1: Rewrite** — replace the rail with the spec status rail (TOTAL · SETTLED · LOCKED · INFORMATIONAL) plus the accountability stamp, and wrap `<MatchesFilter>` in `<Suspense>`:

```tsx
import { Suspense } from "react";
import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { MatchesFilter } from "@/components/matches-filter";
import { allMatchRows } from "@/lib/match-rows";
import knockouts from "@/data/knockouts.json";

export const metadata = { title: "Matches — Matchday Briefing" };

export default function MatchesPage() {
  const rows = allMatchRows();
  const settled = rows.filter((r) => r.status === "official").length;
  const locked = rows.filter((r) => r.status === "locked").length;
  const informational = rows.filter((r) => r.status === "informational").length;

  return (
    <WCS26Shell
      route="matches"
      title="Locked Predictions"
      rail={
        <div className="flex flex-col gap-3">
          <SignalLine
            signals={[
              { label: "Total", value: rows.length, detail: "all fixtures" },
              { label: "Settled", value: settled, tone: "up", detail: "graded" },
              { label: "Locked", value: locked, tone: "warn", detail: "in-flight" },
              { label: "Informational", value: informational, detail: "pre-lock" },
            ]}
          />
          <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)] lg:text-right">
            All predictions locked pre-kickoff · Never edited after lock
          </span>
        </div>
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Ledger" title="Every prediction, with its status.">
          <DataPlane>
            <Suspense fallback={<p className="text-caption">Loading predictions…</p>}>
              <MatchesFilter rows={rows} />
            </Suspense>
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Knockout shell" title="Round of 32 slots set after the groups.">
          <DataPlane>
            <div className="space-y-2">
              {(knockouts as Array<{ match: number; homeLabel: string; awayLabel: string }>).map((k) => (
                <div
                  key={k.match}
                  className="grid grid-cols-[5.5rem_1fr] items-center gap-4 border-b border-[var(--line)] py-3 opacity-70 last:border-0"
                >
                  <span className="text-caption tabular">Match {k.match}</span>
                  <span className="text-caption">{k.homeLabel} vs {k.awayLabel}</span>
                </div>
              ))}
            </div>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
```

- [ ] **Step 2: Full gate** — `npm run build && npx vitest run && node --import tsx scripts/design-inspector.mts && npx eslint app/matches/page.tsx components/matches-filter.tsx`. All green (vitest baseline 245 + 3 new = 248).

- [ ] **Step 3: Visual** — dev server, screenshot `/matches`: confirm rail (Total/Settled/Locked/Informational + stamp), 4 filter tabs with counts, 5-col table (Fixture / Result·Status / H·D·A / Brier+bar / Verdict). Click a tab → rows filter + URL gets `?filter=`; click Brier header → settled rows reorder. No glass/glow.

- [ ] **Step 4: Commit** — `git add app/matches/page.tsx && git commit -m "feat(matches): rewrite to spec operational ledger — status rail, tabs, accountability stamp"`

---

## Self-Review

**Spec coverage (Matches §635–731):** Status rail TOTAL·SETTLED·LOCKED·INFORMATIONAL (L1) → T3.S1 · accountability stamp (§707) → T3.S1 · filter tabs All/Settled/Locked/Upcoming + counts (L2) → T2 · URL `?filter=` → T2 (`pick()` via `router.replace`) · match table 5-col Fixture/Result·Status/H·D·A/Brier/Verdict (L3) → T2 · row→`/fixture/[slug]` → T2 (`<Link>`) · hover tint → T2 (`hover:bg-[var(--surface)]` + `duration-300`) · Brier-header sort settled-only (interaction) → T1+T2 · mobile column reduction (H·D·A `hidden sm:block`) → T2. No hero / no intel cards ✓.

**Placeholder scan:** No TBD/TODO. Every step has concrete code or exact spec refs. ✓

**Type consistency:** `MatchRowData` fields (`status`, `score`, `split`, `verdict`, `grade.brier`) used in T2 match the type. `sortMatchesByBrier` generic `{ grade?: { brier } }` satisfied by `MatchRowData`. `r.verdict` (`Verdict`) → `VerdictChip`. `FilterKey` union consistent T2↔counts. `Suspense` wraps the `useSearchParams` consumer per Next requirement. ✓
