# P0 — Trust Contradictions & Precision Leaks

**Branch:** `fix/p0-trust-precision-leaks`
**Source:** WC26 audit (2026-06-21). External (Perplexity) findings triaged against live code first.

## Triage of audit findings

| Finding | Verdict | Evidence |
| --- | --- | --- |
| P0-01 ECE "within the 3% gate" contradiction | **REAL — fix** | `lib/command-data.ts:282` hardcodes optimistic copy unconditionally; System Health shows BREACH (`command-shell.tsx:173`) |
| P0-03 stale "Next locks" (past-kickoff matches) | **REAL — fix** | `buildMatchView` keeps `status:"locked"` until graded (never flips on kickoff); `page.tsx:168` filters by status only; live homepage shows CZE/MEX/SUI · Jun 17 (today Jun 21) |
| P0-02 `/simulator` 404 | **REJECTED** | Live curl returns 200 (so do /groups,/players,/sentiment). Route + JSON exist. False positive |
| P1-05 Record commit "FAILED" | **REJECTED** | `c0fd231` merged (#6); record page imports new primitives. Misread GitHub status check |
| P1-04 secondary pages not in nav | **DEFERRED (by design)** | Old-design pages deliberately deferred; adding to nav exposes the quality cliff |

## Task 1 — Calibration evolution entry is truth-derived (P0-01)

**Files:** `lib/command-data.ts` (`buildEvolutionLog`), `tests/command-data.test.ts`.

1. (RED) Add tests: `buildEvolutionLog([], id, id, ece)` → find `calibration-md`.
   - ece 0.135 (BREACH): body matches `/OUTSIDE/`, `/BREACH/`, `/13\.5%/`, `/LSig-001/`; body does NOT match `/within the 3% gate/i`, `/is holding/i`, `/No version change required/i`; `statusColor !== "blue"`.
   - ece 0.02 (NOMINAL): body matches `/within the 3%/i`; `statusColor === "blue"`.
   - ece 0.04 (WARNING): body matches `/above the 3%/i`; `statusColor === "warn"`.
2. (GREEN) Branch the `if (ece > 0)` block on the same thresholds as `buildSystemHealth` (`<0.03` NOMINAL, `<0.05` WARNING, else BREACH). BREACH copy states OUTSIDE the gate, references LSig-001, holds version pending challenger; `statusColor: "warn"`.

**Acceptance:** vitest green; build ✓; inspector ✓; eslint ✓.
**Must not regress:** surprise/confirm autopsy entries untouched; the intentional BREACH *display* (this reinforces it).

## Task 2 — "Next locks" excludes past-kickoff fixtures (P0-03)

**Files:** new `lib/upcoming-locks.ts` + `tests/upcoming-locks.test.ts`; wire into `app/page.tsx`.

1. (RED) Test `selectUpcomingLocks(views, now, limit)`: excludes past-kickoff locked; includes future locked+upcoming; sorts ascending by kickoff (nearest first); respects limit; empty when no future locks.
2. (GREEN) Implement pure fn: filter `status in {locked,upcoming}` AND `kickoff > now`, sort ascending, slice limit.
3. Wire: replace inline filter at `page.tsx:168` with `selectUpcomingLocks(views, new Date())`; render "No upcoming locks — awaiting next matchday." empty state instead of hiding the section.

**Acceptance:** vitest green; build ✓; inspector ✓ (page-file token rules); eslint ✓; live homepage no longer lists past-kickoff matches under "Next locks".
**Must not regress:** static NumberTicker; single-source data; HomeGrid 2fr+320px layout.

## Completion

Gates from `app/`: `npm run build` · `npx vitest run` · `node --import tsx scripts/design-inspector.mts` · `npx eslint <files>`. Stage explicit paths (never `git add -A`). One PR: `fix(trust): P0 precision leaks — calibration verdict + stale Next Locks`. Then `superpowers:finishing-a-development-branch`.
