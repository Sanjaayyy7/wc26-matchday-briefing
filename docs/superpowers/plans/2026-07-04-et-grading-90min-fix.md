# ET Grading Trap Fix (90-Minute Market) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Knockout matches that go to extra time / penalties must be graded on the 90-minute score (always a draw for H/D/A; exact 90' score for scoreline/btts/ou25), never on the AET score that results.csv (martj42 convention) stores.

**Architecture:** `data/knockout-results.json` becomes the explicit 90-minute score source: each row for a ledger-graded round (R16+) must declare `after: "90" | "et" | "pens"`, and when `after !== "90"` must carry `homeScore90`/`awayScore90`. A new pure helper `applyKnockoutScores90()` (lib/knockout-grading.ts) merges those onto scored knockout fixtures in-memory at settle time — and **throws** when a scored knockout fixture lacks the metadata (hard gate; settlement cannot silently misgrade). `settle()` grades from `homeScore90 ?? homeScore` and records an `extraTime` context field on the ledger entry so the UI can show the AET score alongside the graded 90' result. fixtures.json keeps AET scores only (no duplicated persisted state); R32 rows in knockout-results.json are untouched (no fixtures/ledger entries exist for them).

**Tech Stack:** TypeScript, vitest, Next.js app in `/Users/sanjaym/Desktop/KALSHI/README/app`.

## Global Constraints

- Run everything from `app/`. Never run `npm run matchday` / `ml:fetch` / `ml:cycle` (wipes seeded results.csv).
- Ledger immutability: settling only ADDS fields; never modify locked probabilities or already-settled entries.
- Keep files under 500 lines. Conventional commits. No new doc files.
- Gates before finishing: `npx vitest run` · `npx eslint .` · `npm run build` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect`.

---

### Task 0: Branch

- [ ] **Step 1: Branch from up-to-date main**

```bash
cd /Users/sanjaym/Desktop/KALSHI/README/app
git checkout main && git pull && git checkout -b fix/et-grading-90min
```

---

### Task 1: `applyKnockoutScores90` gate + merge helper

**Files:**
- Create: `lib/knockout-grading.ts`
- Test: `tests/knockout-grading.test.ts`

**Interfaces:**
- Produces: `applyKnockoutScores90<T extends GradableFixture>(fixtures: T[], koRows: KnockoutResultRow[]): T[]`; types `KnockoutResultRow`, `GradableFixture` (exported). Task 3 consumes these.

- [ ] **Step 1: Write failing tests**

```ts
// tests/knockout-grading.test.ts
import { describe, it, expect } from "vitest";
import { applyKnockoutScores90, type KnockoutResultRow } from "@/lib/knockout-grading";

const row = (over: Partial<KnockoutResultRow>): KnockoutResultRow => ({
  match: 90, homeId: "bel", awayId: "sen", homeScore: 3, awayScore: 2,
  winnerId: "bel", ...over,
});
const fixture = (over: Record<string, unknown> = {}) => ({
  slug: "belgium-vs-senegal", homeId: "bel", awayId: "sen",
  homeScore: 3, awayScore: 2, ...over,
});

describe("applyKnockoutScores90", () => {
  it("passes group fixtures through untouched (no gate)", () => {
    const f = fixture({ group: "A", homeScore: 1, awayScore: 1 });
    expect(applyKnockoutScores90([f], [])).toEqual([f]);
  });

  it("passes unplayed knockout fixtures through (no scores yet)", () => {
    const f = fixture({ homeScore: undefined, awayScore: undefined });
    expect(applyKnockoutScores90([f], [])).toEqual([f]);
  });

  it("THROWS for a scored knockout fixture with no knockout-results row", () => {
    expect(() => applyKnockoutScores90([fixture()], [])).toThrow(/belgium-vs-senegal/);
  });

  it("THROWS when the row exists but lacks an explicit `after`", () => {
    expect(() => applyKnockoutScores90([fixture()], [row({})])).toThrow(/after/);
  });

  it("after=90: passes through, no 90' fields added", () => {
    const out = applyKnockoutScores90([fixture()], [row({ after: "90" })]);
    expect(out[0].homeScore90).toBeUndefined();
    expect(out[0].decidedBy).toBeUndefined();
  });

  it("after=90: throws when the score is level (a drawn knockout can't end at 90)", () => {
    const f = fixture({ homeScore: 1, awayScore: 1 });
    expect(() =>
      applyKnockoutScores90([f], [row({ after: "90", homeScore: 1, awayScore: 1 })]),
    ).toThrow(/level|draw/i);
  });

  it("after=et: applies the 90-minute draw score and decidedBy", () => {
    const out = applyKnockoutScores90(
      [fixture()],
      [row({ after: "et", homeScore90: 2, awayScore90: 2 })],
    );
    expect(out[0]).toMatchObject({ homeScore90: 2, awayScore90: 2, decidedBy: "et" });
    expect(out[0].homeScore).toBe(3); // AET score untouched
  });

  it("after=et/pens: throws when homeScore90/awayScore90 missing", () => {
    expect(() => applyKnockoutScores90([fixture()], [row({ after: "et" })])).toThrow(/homeScore90/);
  });

  it("after=et/pens: throws when the 90' score is not level", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "et", homeScore90: 2, awayScore90: 1 })]),
    ).toThrow(/level/i);
  });

  it("after=pens: requires the AET score itself to be level", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "pens", homeScore90: 1, awayScore90: 1 })]),
    ).toThrow(/pens/);
  });

  it("throws when fixture score disagrees with the knockout-results score", () => {
    expect(() =>
      applyKnockoutScores90(
        [fixture({ homeScore: 2, awayScore: 2 })],
        [row({ after: "90" })],
      ),
    ).toThrow(/disagrees/);
  });

  it("throws when winnerId contradicts the AET score (non-pens)", () => {
    expect(() =>
      applyKnockoutScores90([fixture()], [row({ after: "90", winnerId: "sen" })]),
    ).toThrow(/winner/i);
  });

  it("handles reversed home/away orientation", () => {
    const f = fixture({ homeId: "sen", awayId: "bel", homeScore: 2, awayScore: 3 });
    const out = applyKnockoutScores90([f], [row({ after: "et", homeScore90: 2, awayScore90: 2 })]);
    expect(out[0]).toMatchObject({ homeScore90: 2, awayScore90: 2, decidedBy: "et" });
  });

  it("does not mutate its inputs", () => {
    const f = fixture();
    applyKnockoutScores90([f], [row({ after: "et", homeScore90: 2, awayScore90: 2 })]);
    expect(f).toEqual(fixture());
  });
});
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/knockout-grading.test.ts`
Expected: FAIL — cannot resolve `@/lib/knockout-grading`.

- [ ] **Step 3: Implement**

```ts
// lib/knockout-grading.ts
// 90-minute grading guard for knockout matches.
//
// results.csv (martj42 convention) stores the AFTER-EXTRA-TIME score for
// matches that went past 90 minutes, but the ledger grades 90-minute markets
// (H/D/A, scoreline, btts, ou25). Any match that reached extra time was level
// after 90 by definition, and the exact 90' score matters for the side markets.
//
// data/knockout-results.json rows for ledger-graded rounds (round of 16
// onward) must therefore declare how the tie was decided:
//   after:        "90" | "et" | "pens"            — REQUIRED
//   homeScore90 / awayScore90 (must be level)     — REQUIRED when after !== "90"
// homeScore/awayScore keep the martj42 AET convention. Round-of-32 rows
// predate this schema and are never settled (no fixtures or ledger entries).

export type KnockoutResultRow = {
  match: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  note?: string;
  after?: "90" | "et" | "pens";
  homeScore90?: number;
  awayScore90?: number;
};

export type GradableFixture = {
  slug: string;
  homeId: string;
  awayId: string;
  group?: string;
  homeScore?: number;
  awayScore?: number;
  homeScore90?: number;
  awayScore90?: number;
  decidedBy?: "et" | "pens";
};

/** Merge explicit 90-minute scores onto scored knockout fixtures, or throw
 *  when the metadata needed to grade the 90-minute market honestly is
 *  missing or inconsistent. Group fixtures and unplayed fixtures pass through. */
export function applyKnockoutScores90<T extends GradableFixture>(
  fixtures: T[],
  koRows: KnockoutResultRow[],
): T[] {
  return fixtures.map((f) => {
    if (f.group || f.homeScore === undefined || f.awayScore === undefined) return f;

    const row =
      koRows.find((r) => r.homeId === f.homeId && r.awayId === f.awayId) ??
      koRows.find((r) => r.homeId === f.awayId && r.awayId === f.homeId);
    if (!row || row.after === undefined) {
      throw new Error(
        `knockout fixture ${f.slug} has a score but no knockout-results.json row with an explicit "after" — refusing to grade the 90-min market`,
      );
    }

    const reversed = row.homeId !== f.homeId;
    const rowHome = reversed ? row.awayScore : row.homeScore;
    const rowAway = reversed ? row.homeScore : row.awayScore;
    if (rowHome !== f.homeScore || rowAway !== f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: fixture score ${f.homeScore}-${f.awayScore} disagrees with knockout-results ${rowHome}-${rowAway}`,
      );
    }
    if (row.after === "90" && f.homeScore === f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: after="90" but the score is level — a drawn knockout can't end at 90 minutes`,
      );
    }
    if (row.after !== "pens") {
      const scoreWinner =
        f.homeScore > f.awayScore ? f.homeId : f.awayScore > f.homeScore ? f.awayId : undefined;
      if (scoreWinner !== row.winnerId) {
        throw new Error(
          `knockout fixture ${f.slug}: winnerId ${row.winnerId} contradicts score ${f.homeScore}-${f.awayScore} for after="${row.after}"`,
        );
      }
    }

    if (row.after === "90") return f;

    if (row.homeScore90 === undefined || row.awayScore90 === undefined) {
      throw new Error(
        `knockout fixture ${f.slug}: after="${row.after}" requires homeScore90/awayScore90`,
      );
    }
    if (row.homeScore90 !== row.awayScore90) {
      throw new Error(
        `knockout fixture ${f.slug}: 90-min score ${row.homeScore90}-${row.awayScore90} must be level for a match that went past 90 minutes`,
      );
    }
    if (row.after === "pens" && f.homeScore !== f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: after="pens" but the AET score ${f.homeScore}-${f.awayScore} is not level`,
      );
    }

    return {
      ...f,
      homeScore90: reversed ? row.awayScore90 : row.homeScore90,
      awayScore90: reversed ? row.homeScore90 : row.awayScore90,
      decidedBy: row.after,
    };
  });
}
```

(Note: for `after="pens"` the winnerId check is skipped — the AET score is level, so the score can't name the winner; pens do.)

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/knockout-grading.test.ts`
Expected: PASS (13 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/knockout-grading.ts tests/knockout-grading.test.ts
git commit -m "feat(grading): 90-min score gate+merge for knockout settlement"
```

---

### Task 2: `settle()` grades from the 90-minute score

**Files:**
- Modify: `lib/predictions-ledger.ts` (LockedEntry type ~line 43; settle fixtures param + scoring ~lines 116-153)
- Test: `tests/predictions-ledger.test.ts`

**Interfaces:**
- Consumes: fixtures now optionally carry `homeScore90`, `awayScore90`, `decidedBy` (from Task 1's output).
- Produces: `LockedEntry.extraTime?: { finalScore: string; decidedBy: "et" | "pens" }` (Task 4 reads it via `view.lock.extraTime`).

- [ ] **Step 1: Write failing tests** (append inside the existing `describe("settle")`)

```ts
  it("grades the 90-minute market from homeScore90 when a match went to extra time", () => {
    const et: LockedEntry[] = [
      {
        slug: "x-vs-y",
        lockedAt: "2026-07-01T00:00:00.000Z",
        split: { home: 40, draw: 35, away: 25 },
        mostLikely: { home: 2, away: 2 },
      },
    ];
    const out = settle(et, [
      { slug: "x-vs-y", homeScore: 3, awayScore: 2, homeScore90: 2, awayScore90: 2, decidedBy: "et" as const },
    ]);
    const e = out[0];
    expect(e.realized).toBe("draw");           // NOT "home" from the AET 3-2
    expect(e.result).toBe("2-2");              // 90' score is the graded result
    expect(e.correctPick).toBe(false);         // top of split was home
    expect(e.scorelineHit).toBe(true);         // mostLikely 2-2 vs 90' 2-2
    expect(e.extraTime).toEqual({ finalScore: "3-2", decidedBy: "et" });
  });

  it("uses the 90' score for grid-derived btts/ou25", () => {
    const grid = scoreGrid(1.5, 1.2, DEFAULT_PARAMS.rho);
    const out = settle(
      [{ slug: "x-vs-y", lockedAt: "2026-07-01T00:00:00.000Z", split, mostLikely: { home: 1, away: 0 } }],
      [{ slug: "x-vs-y", homeScore: 2, awayScore: 1, homeScore90: 0, awayScore90: 0, decidedBy: "pens" as const }],
      { gridForSlug: () => grid },
    );
    const e = out[0];
    expect(e.btts!.actual).toBe(false);        // 0-0 at 90', not the AET 2-1
    expect(e.ou25!.actual).toBe(false);        // 0 goals at 90'
    expect(e.extraTime).toEqual({ finalScore: "2-1", decidedBy: "pens" });
  });

  it("omits extraTime for matches decided in 90 minutes", () => {
    const out = settle(locked, [{ slug: "a-vs-b", homeScore: 2, awayScore: 1 }]);
    expect(out[0].extraTime).toBeUndefined();
  });
```

- [ ] **Step 2: Run to verify failure**

Run: `npx vitest run tests/predictions-ledger.test.ts`
Expected: FAIL — first new test: `realized` is `"home"`; `extraTime` undefined.

- [ ] **Step 3: Implement**

In `LockedEntry`, after `scorelineHit?: boolean;`:

```ts
  /** Present when the match went past 90'. result/realized grade the 90-minute
   *  market; finalScore is the after-extra-time score the match ended with. */
  extraTime?: { finalScore: string; decidedBy: "et" | "pens" };
```

Replace the `settle` signature's fixtures param and the score lookup (lines 116-133):

```ts
export function settle(
  entries: LockedEntry[],
  fixtures: Array<{
    slug: string;
    homeScore?: number;
    awayScore?: number;
    homeScore90?: number;
    awayScore90?: number;
    decidedBy?: "et" | "pens";
  }>,
  options: SettleOptions = {},
): LockedEntry[] {
  const { gridForSlug, polymarketData, kalshiResolutions } = options;

  const scored = new Map(
    fixtures
      .filter((f) => f.homeScore !== undefined && f.awayScore !== undefined)
      .map((f) => [f.slug, f]),
  );
  return entries.map((e) => {
    if (e.result !== undefined) return e;
    const fx = scored.get(e.slug);
    if (!fx) return e;
    // The ledger grades 90-minute markets. Fixture scores follow the martj42
    // AET convention, so prefer the explicit 90' score when the match went long.
    const h = fx.homeScore90 ?? fx.homeScore!;
    const a = fx.awayScore90 ?? fx.awayScore!;
```

After the `settled` base-fields block (right after `modelRps`), add:

```ts
    if (fx.homeScore90 !== undefined && fx.decidedBy !== undefined) {
      settled.extraTime = {
        finalScore: `${fx.homeScore}-${fx.awayScore}`,
        decidedBy: fx.decidedBy,
      };
    }
```

Everything downstream (`realized`, `result`, `scorelineHit`, btts/ou25, top3) already reads `h`/`a` — no further changes.

- [ ] **Step 4: Run to verify pass**

Run: `npx vitest run tests/predictions-ledger.test.ts`
Expected: PASS (all existing + 3 new).

- [ ] **Step 5: Commit**

```bash
git add lib/predictions-ledger.ts tests/predictions-ledger.test.ts
git commit -m "fix(grading): settle 90-min markets from 90' score, record AET context"
```

---

### Task 3: Wire the gate into `pipeline:settle`

**Files:**
- Modify: `scripts/settle-predictions.mts` (after ledger load, ~line 33)
- Modify: `scripts/shared.mts` `FixtureRow` (add score fields)

**Interfaces:**
- Consumes: `applyKnockoutScores90`, `KnockoutResultRow` from Task 1.

- [ ] **Step 1: Add score fields to FixtureRow** (scripts/shared.mts — they exist at runtime once fetch-match-results patches fixtures.json)

```ts
  homeScore?: number;
  awayScore?: number;
```

- [ ] **Step 2: Load knockout rows + apply gate in settle-predictions.mts**

Add imports:

```ts
import { applyKnockoutScores90, type KnockoutResultRow } from "../lib/knockout-grading";
```

After `const allFixtures = fixtures();` add:

```ts
// 90-min grading gate: knockout fixtures with scores must have explicit
// knockout-results.json metadata (after/homeScore90) — throws otherwise.
const koPath = path.join(appDir, "data", "knockout-results.json");
const koRows: KnockoutResultRow[] = existsSync(koPath)
  ? (Object.values(JSON.parse(readFileSync(koPath, "utf8"))) as KnockoutResultRow[][]).flat()
  : [];
const gradableFixtures = applyKnockoutScores90(allFixtures, koRows);
```

Change the settle call to use `gradableFixtures`:

```ts
const entries = settle(ledger.entries, gradableFixtures, {
```

(`gridForSlug` keeps using `allFixtures` — unchanged.)

In the settled-entries print loop, after the `result:` line add:

```ts
    if (e.extraTime) console.log(`  extraTime: AET ${e.extraTime.finalScore} (${e.extraTime.decidedBy})`);
```

- [ ] **Step 3: Integration check (idempotence + no-throw on current data)**

Run: `npm run pipeline:settle`
Expected: `settled 0 new (total settled 69/77)` — R16 fixtures unscored, gate silent, no entries touched. Verify `git diff --stat data/predictions.json` shows no changes.

- [ ] **Step 4: Negative integration check (gate fires)**

Temporarily add a fake score to one R16 fixture and confirm the script throws:

```bash
python3 - <<'EOF'
import json
f = json.load(open('data/fixtures.json'))
next(x for x in f if x['stage'] == 'round-of-16').update(homeScore=1, awayScore=0)
json.dump(f, open('data/fixtures.json', 'w'), indent=2)
EOF
npm run pipeline:settle; echo "exit=$?"
git checkout -- data/fixtures.json
```

Expected: script throws `knockout fixture <slug> has a score but no knockout-results.json row with an explicit "after"...`, exit ≠ 0; fixtures.json restored after.

- [ ] **Step 5: Commit**

```bash
git add scripts/settle-predictions.mts scripts/shared.mts
git commit -m "feat(pipeline): enforce 90-min grading gate in pipeline:settle"
```

---

### Task 4: Show AET context on settled match pages

**Files:**
- Modify: `components/match-result-panel.tsx` (~line 71, after the score span)

**Interfaces:**
- Consumes: `view.lock.extraTime` (LockedEntry from Task 2; `view.lock` exists on official views).

- [ ] **Step 1: Render the AET chip**

Inside the `flex flex-wrap items-center gap-4` div, immediately after the closing `</span>` of the score display, add:

```tsx
            {view.status === "official" && view.lock.extraTime ? (
              <span className="text-label border-b border-[var(--line)] px-1 py-0.5">
                90&#8242; market · AET {view.lock.extraTime.finalScore.replace("-", "–")}
                {view.lock.extraTime.decidedBy === "pens" ? " (pens)" : ""}
              </span>
            ) : null}
```

- [ ] **Step 2: Verify build renders it**

Run: `npx vitest run && npm run build`
Expected: tests green; build succeeds (208 pages). No settled ET match exists yet, so visual check lands with first R16 ET settlement.

- [ ] **Step 3: Commit**

```bash
git add components/match-result-panel.tsx
git commit -m "feat(ui): show AET final score next to 90-min graded result"
```

---

### Task 5: Full gates + branch finish

- [ ] **Step 1: Run all gates**

```bash
npx vitest run && npx eslint . && npm run build && npm run design:inspect && npm run inspect:execution && npm run model:inspect
```

Expected: vitest all green (400 existing + 16 new), eslint 0 errors (12 pre-existing warnings OK), build 208 pages, all inspectors PASS.

- [ ] **Step 2: Finish branch** — use superpowers:finishing-a-development-branch (expected: PR to main, matching the repo's PR flow).
