# R16 Forecast Cycle (Jul 3) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settle the 18 outstanding group-MD3 results, feed the 16 completed Round-of-32 results into the training set, retrain the champion, lock 8 Round-of-16 predictions before the Jul 4 17:00 UTC kickoff, and refresh the recalibration/backtest reports at n=69.

**Architecture:** Pure data-cycle on the established safe settlement path (seeded `results.csv` → `fetch-match-results` → `pipeline:settle` → `report:accountability`), then `ml:train` (never `ml:fetch`/`matchday` — they wipe the seeded csv), then 8 new `fixtures.json` knockout rows locked via `pipeline:lock` (append-only ledger). Reports are read-only (`ml:validate`, `challenger-eval`, `ml:market-shadow`).

**Tech Stack:** Existing repo scripts (tsx), vitest, no new dependencies.

## Global Constraints

- **NEVER run `npm run matchday`, `npm run ml:fetch`, or `npm run ml:cycle`** — they re-download results.csv and wipe seeded WC26 finals.
- Prediction ledger is immutable: the 69 existing entries must be byte-identical after every step (verify with the jq/node diff below).
- Never fabricate results. Every score below is dual-source verified (sportsapipro API + ESPN scoreboard API, fetched 2026-07-03; agree 18/18 on sampled overlap incl. all 3 shootouts).
- Do not commit the sportsapipro API key anywhere.
- Commits: conventional prefixes, no Co-Authored-By trailer.
- Gates before PR: `npx vitest run` · `npx eslint .` · `npm run build` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect`.
- martj42 conventions: knockout scores are end-of-ET (pens NOT added); date = venue-local date; `neutral=FALSE` only when home team plays in its own country.

## Verified inputs

### A. Group MD3 fills (18 rows already in results.csv with NA scores — fill in OUR row orientation)

| csv row (home,away) | fill h,a | source result |
|---|---|---|
| United States,Turkey | 2,3 | Türkiye 3–2 USA |
| Paraguay,Australia | 0,0 | 0–0 |
| Curaçao,Ivory Coast | 0,2 | Curaçao 0–2 Côte d'Ivoire |
| Ecuador,Germany | 2,1 | 2–1 |
| Japan,Sweden | 1,1 | 1–1 |
| Tunisia,Netherlands | 1,3 | 1–3 |
| Egypt,Iran | 1,1 | 1–1 |
| New Zealand,Belgium | 1,5 | 1–5 |
| Cape Verde,Saudi Arabia | 0,0 | 0–0 |
| Uruguay,Spain | 0,1 | 0–1 |
| Norway,France | 1,4 | 1–4 |
| Senegal,Iraq | 5,0 | 5–0 |
| Algeria,Austria | 3,3 | 3–3 |
| Jordan,Argentina | 1,3 | 1–3 |
| Colombia,Portugal | 0,0 | 0–0 |
| DR Congo,Uzbekistan | 3,1 | 3–1 |
| Panama,England | 0,2 | 0–2 |
| Croatia,Ghana | 2,1 | 2–1 |

### B. Round-of-32 rows to APPEND to results.csv (16 — none exist yet)

```csv
2026-06-28,South Africa,Canada,0,1,FIFA World Cup,Inglewood,United States,TRUE
2026-06-29,Brazil,Japan,2,1,FIFA World Cup,Houston,United States,TRUE
2026-06-29,Germany,Paraguay,1,1,FIFA World Cup,Foxborough,United States,TRUE
2026-06-29,Netherlands,Morocco,1,1,FIFA World Cup,Monterrey,Mexico,TRUE
2026-06-30,Ivory Coast,Norway,1,2,FIFA World Cup,Arlington,United States,TRUE
2026-06-30,France,Sweden,3,0,FIFA World Cup,East Rutherford,United States,TRUE
2026-06-30,Mexico,Ecuador,2,0,FIFA World Cup,Mexico City,Mexico,FALSE
2026-07-01,England,DR Congo,2,1,FIFA World Cup,Atlanta,United States,TRUE
2026-07-01,Belgium,Senegal,3,2,FIFA World Cup,Seattle,United States,TRUE
2026-07-01,United States,Bosnia and Herzegovina,2,0,FIFA World Cup,Santa Clara,United States,FALSE
2026-07-02,Spain,Austria,3,0,FIFA World Cup,Inglewood,United States,TRUE
2026-07-02,Portugal,Croatia,2,1,FIFA World Cup,Toronto,Canada,TRUE
2026-07-02,Switzerland,Algeria,2,0,FIFA World Cup,Vancouver,Canada,TRUE
2026-07-03,Australia,Egypt,1,1,FIFA World Cup,Arlington,United States,TRUE
2026-07-03,Argentina,Cape Verde,3,2,FIFA World Cup,Miami Gardens,United States,TRUE
2026-07-03,Colombia,Ghana,1,0,FIFA World Cup,Kansas City,United States,TRUE
```

Shootouts (recorded as ET draws per convention): Germany–Paraguay pens 3–4; Netherlands–Morocco pens 2–3; Australia–Egypt pens 2–4. AET wins: Belgium 3–2 (2–2 FT), Argentina 3–2 (1–1 FT).

### C. Round-of-16 fixtures (8 — kickoffs UTC, from match-detail endpoint)

| slug | homeId | awayId | kickoffISO | venue city | tz |
|---|---|---|---|---|---|
| canada-vs-morocco | can | mar | 2026-07-04T17:00:00Z | Houston | -300 CDT |
| paraguay-vs-france | par | fra | 2026-07-04T21:00:00Z | Philadelphia | -240 EDT |
| brazil-vs-norway | bra | nor | 2026-07-05T20:00:00Z | East Rutherford | -240 EDT |
| mexico-vs-england | mex | eng | 2026-07-06T00:00:00Z | Mexico City | -360 CST |
| portugal-vs-spain | por | esp | 2026-07-06T19:00:00Z | Arlington | -300 CDT |
| united-states-vs-belgium | usa | bel | 2026-07-07T00:00:00Z | Seattle | -420 PDT |
| argentina-vs-egypt | arg | egy | 2026-07-07T16:00:00Z | Atlanta | -240 EDT |
| switzerland-vs-colombia | sui | col | 2026-07-07T20:00:00Z | Vancouver | -420 PDT |

Venue strings: reuse the exact venue string already used in fixtures.json for the same city (e.g. Croatia–Ghana row for Philadelphia). Mexico–England is at Estadio Azteca → `neutral: false` for Mexico; USA–Belgium in Seattle → `neutral: false` for USA; all others `neutral: true`.

### Ledger-immutability check (run after every settle/lock step)

```bash
node -e "
const a = require('./data/predictions.json').entries;
const b = JSON.parse(require('fs').readFileSync('/tmp/predictions.before.json')).entries;
const strip = (e) => JSON.stringify({slug:e.slug, lockedAt:e.lockedAt, split:e.split, mostLikely:e.mostLikely, market:e.market??null});
const bMap = new Map(b.map(e=>[e.slug,strip(e)]));
let bad=0; for (const e of a) { if (bMap.has(e.slug) && bMap.get(e.slug)!==strip(e)) { console.log('MUTATED:', e.slug); bad++; } }
console.log(bad===0 ? 'immutability OK ('+b.length+' prior entries)' : 'FAIL '+bad);
"
```

(`cp data/predictions.json /tmp/predictions.before.json` before the step.)

---

### Task 1: Branch + settle group MD3 (n 51→69)

**Files:** Modify: `data/raw/results.csv` (18 score fills), `data/fixtures.json` + `data/predictions.json` + `data/backtest/wc26-accountability.json` (derived), any test pinning settled=51.

- [ ] `git checkout main && git pull && git checkout -b data/settle-md3-r32`
- [ ] `cp data/predictions.json /tmp/predictions.before.json`
- [ ] Fill the 18 scores from table A into `data/raw/results.csv` (Python/node one-shot editing only those rows; verify with grep that exactly 18 NA rows became scored and 0 NA rows remain for dates ≤ 2026-06-27)
- [ ] `npx tsx scripts/fetch-match-results.mts` → expect `18 patched`
- [ ] `npm run pipeline:settle` → expect 18 newly graded
- [ ] `npm run report:accountability`
- [ ] Run the immutability check → `immutability OK`
- [ ] `npx vitest run` — update any test pinning settled-count 51→69 (expected: forecast-pulse.test.ts or similar); re-run to green
- [ ] Commit: `data: settle group MD3 (18 results, ledger n 51→69)`

### Task 2: Append R32 to training set + retrain champion

**Files:** Modify: `data/raw/results.csv` (append 16 rows from B), `data/model.json` (retrained), `data/simulation.json` (refresh).

- [ ] Append block B to `data/raw/results.csv` (keep chronological order; file ends with newline)
- [ ] `npm run ml:train` → model.json refreshed; record new dataThrough/backtest Brier in commit message; sanity: backtest Brier within ±0.02 of 0.509 eval-split baseline
- [ ] `npm run model:inspect` → PASS (promotion.shipped stays false, global params live)
- [ ] `npm run ml:simulate` → simulation.json refreshed
- [ ] `npx vitest run` → green (fix any test premised on stale sim odds)
- [ ] Commit: `data: R32 results into training set; retrain champion`

### Task 3: R16 fixtures + schedule-invariant test update (TDD)

**Files:** Modify: `tests/schedule.test.ts`, `data/fixtures.json` (append 8 rows from C).

- [ ] Update `tests/schedule.test.ts` FIRST: scope existing group invariants to `fixtures.filter(f => f.stage === "group")` (72), add new block asserting exactly 8 `stage === "round-of-16"` fixtures, each referencing known team ids, kickoff between 2026-07-04 and 2026-07-08, no `group` field. Run → FAIL (0 knockout fixtures)
- [ ] Append the 8 fixture rows (schema identical to group rows minus `group`; `stage: "round-of-16"`, stakes `"Round of 16: X meet Y."`, real kickoffISO/tz/venue from C)
- [ ] `npx vitest run tests/schedule.test.ts` → PASS; then full `npx vitest run` (match-view/other suites may need knockout handling — fix minimally)
- [ ] Commit: `feat: round-of-16 fixtures (8) + knockout schedule invariants`

### Task 4: Lock R16 predictions (pre-kickoff, deadline Jul 4 17:00 UTC)

**Files:** Modify: `data/predictions.json` (8 appended entries).

- [ ] `cp data/predictions.json /tmp/predictions.before.json`
- [ ] `npm run pipeline:lock` → expect `locked 8 new (total 77, k with Kalshi snapshots)`
- [ ] Immutability check → OK; verify each new entry: kickoff future at lockedAt, split sums to 100, advancement present in briefing path
- [ ] `npm run pipeline:polymarket` (best-effort R16 books for later market-shadow; non-blocking if empty)
- [ ] `npx vitest run` → green
- [ ] Commit: `data: lock 8 round-of-16 predictions (model + market snapshots)`

### Task 5: Recalibration + backtest reports @ n=69

**Files:** Modify: `docs/validation/*.json|md` (report-only outputs).

- [ ] `npm run ml:validate` → walk-forward tournament-holdout report refresh; note verdicts (promotion only if a pre-registered rule fires — expect HOLD)
- [ ] `npx tsx scripts/challenger-eval.mts` → challenger table @ n=69
- [ ] `npm run ml:market-shadow` → model vs market vs blend @ n=69
- [ ] Commit: `docs: recalibration + backtest reports at n=69`

### Task 6: Gates + PR

- [ ] Full gates: `npx vitest run` · `npx eslint .` · `npm run build` · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect`
- [ ] Push branch, open PR to main with metrics summary (n, accuracy, Brier, RPS, ECE before/after; R16 locks table)
- [ ] Report to user: PR link + R16 prediction table + verdicts; user merges (prod deploy)
