# Tournament Data Refresh Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Settle the latest FT-confirmed WC26 results into the public ledger and re-grade the model, without touching any locked prediction or wiping the seeded dataset.

**Architecture:** Fill `home_score`/`away_score` for played fixtures in the seeded `data/raw/results.csv` → `fetch-match-results.mts` patches `data/fixtures.json` → `pipeline:settle` grades locked predictions → `report:accountability` rebuilds the accountability JSON the site reads. Pure settlement: locked probabilities are immutable.

**Tech Stack:** Node + tsx (`.mts` scripts), vitest, firecrawl search for sourcing.

## Global Constraints

- **DATA SAFETY:** NEVER run `ml:fetch` / `matchday` / `pipeline:polymarket` (they re-download and WIPE seeded `results.csv`). Only the edit→`fetch-match-results`→`settle`→`report` path.
- **Immutable history:** never edit `lockedAt`, `split`, `market`, or any locked probability. Settlement only adds result/grade fields.
- **No fabrication:** settle a match ONLY when its full-time result is confirmed from a real source. In-progress/unstarted matches keep `NA`.
- `results.csv` schema (martj42): `date,home_team,away_team,home_score,away_score,tournament,city,country,neutral`. Scores are integers from the **home_team perspective of that row** (row order = orientation).
- Gates before commit (from `app/`): `npx vitest run` · `npm run lint` · `node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`.
- Branch off `main`: `data/settle-jun-results`. Own PR. Never `git add -A`. No `Co-Authored-By`.

---

### Task 1: Source FT-confirmed finals (Jun 23–24, +Jun 25 if final)

**Files:** none yet — produces a verified scoreline list.

Open `NA` rows that are played-and-settleable (`results.csv` lines 49451–49460):

| date | row (home vs away) |
|---|---|
| 2026-06-23 | Portugal vs Uzbekistan · Colombia vs DR Congo · England vs Ghana · Panama vs Croatia |
| 2026-06-24 | Mexico vs Czech Republic · South Africa vs South Korea · Canada vs Switzerland · Bosnia and Herzegovina vs Qatar · Scotland vs Brazil · Morocco vs Haiti |

- [ ] **Step 1:** Use the firecrawl skill (SEARCH, not scrape — scrape is blocked) to source each final score. Cross-check ≥2 of: onefootball, FIFA, fbref, ESPN. Query e.g. `"Scotland vs Brazil World Cup 2026 result June 24"`.
- [ ] **Step 2:** Record each as `date,home_team,away_team,home_score,away_score` matching the **csv row orientation** (e.g. onefootball "Czechia 0 Mexico 3" with csv row `Mexico,Czech Republic` → Mexico is home → `Mexico,Czech Republic,3,0`). Double-check home/away inversion for every row.
- [ ] **Step 3:** For 2026-06-25 rows (lines 49461–49466), include ONLY those confirmed full-time at execution time; otherwise leave `NA`.
- [ ] **Step 4:** Write the verified list to the PR description / scratchpad with source citations. No code commit in this task.

**Acceptance:** every settleable match has a cross-checked FT score with correct orientation.

---

### Task 2: Fill the scores in results.csv

**Files:** Modify `data/raw/results.csv` (lines 49451–49460, +49461–49466 if final).

- [ ] **Step 1:** For each verified match, replace `,NA,NA,` with `,<home_score>,<away_score>,` on that exact row. Edit only the two score fields; leave date/teams/tournament/city/country/neutral untouched.
- [ ] **Step 2:** Verify no other rows changed: `git diff --stat data/raw/results.csv` shows only the intended lines. (Note: file is gitignored — diff via `git diff --no-index` against a pre-edit copy, or inspect the edited lines directly with `grep -n "2026-06-2[34]" data/raw/results.csv`.)
- [ ] **Step 3:** Confirm each edited row now has integer scores: `grep -n "2026-06-2[34].*FIFA World Cup" data/raw/results.csv` — none of the played rows show `NA`.

**Acceptance:** played rows carry integer scores; unplayed rows still `NA`; no unintended edits.

---

### Task 3: Run the safe settlement pipeline

**Files:** writes `data/fixtures.json`, `data/predictions.json`, `data/backtest/wc26-accountability.json`, `data/match-facts.json` (derived — committed truth).

- [ ] **Step 1:** Patch fixtures: `npx tsx scripts/fetch-match-results.mts` — Expected: logs the newly-scored fixtures patched into `fixtures.json`.
- [ ] **Step 2:** Settle predictions: `npm run pipeline:settle` — Expected: logs each newly-graded match (result, Brier); no edits to locked splits.
- [ ] **Step 3:** Rebuild accountability: `npm run report:accountability` — Expected: regenerates `wc26-accountability.json` with the new `official.aggregates.n`.
- [ ] **Step 4:** Capture the new settled count: `node -e "const d=require('./data/predictions.json');console.log(d.entries.filter(e=>e.result!==undefined).length)"`. Record it (call it `NEW_N`).

**Acceptance:** `NEW_N` = 41 + (matches settled this run); accountability metrics recomputed.

---

### Task 4: Verify immutability + update the settled-count test

**Files:** Modify `tests/forecast-pulse.test.ts:36`.

- [ ] **Step 1 (immutability):** Confirm no locked probability moved. For each newly-settled slug, verify `split` + `lockedAt` are byte-identical to pre-settle. Quick check: `git diff data/predictions.json | grep -E '^[-+].*"(split|lockedAt|home|draw|away)"' | grep -v result` returns nothing meaningful (only added settlement fields).
- [ ] **Step 2 (failing test):** Update `tests/forecast-pulse.test.ts` line 36 `expect(points.length).toBe(41)` → `toBe(NEW_N)`.
- [ ] **Step 3:** Run: `npx vitest run tests/forecast-pulse.test.ts` — Expected: PASS at the new count.
- [ ] **Step 4 (full gates):** `npx vitest run` · `npm run lint` · `node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build` — all green. Fix any other test that pins the old `41`/`n` (search: `grep -rn "\b41\b\|graded" tests/ | grep -i "n\|settl\|grad"`).

**Acceptance:** all gates green; locked history provably unchanged.

---

### Task 5: (Optional) refresh champion projections + commit

**Files:** Modify `data/simulation.json` (if refreshed).

- [ ] **Step 1:** Confirm `ml:simulate` is read-only on `results.csv` (reads model.json + fixtures; does NOT refetch). If confirmed, run `npm run ml:simulate` to refresh `simulation.json` champion odds against settled state. If unsure, SKIP (default is skip-on-doubt).
- [ ] **Step 2:** Re-run full gates if `simulation.json` changed.
- [ ] **Step 3:** Commit (stage only the changed derived JSON + the test, never `git add -A`):

```bash
git add data/fixtures.json data/predictions.json data/backtest/wc26-accountability.json data/match-facts.json tests/forecast-pulse.test.ts
# add data/simulation.json only if refreshed
git commit -m "data: settle Jun 23-24 results and re-grade model ledger"
```

- [ ] **Step 4:** Open PR `data/settle-jun-results` → main with the sourced-scores citation table from Task 1.

**Acceptance:** PR shows the new graded matches; metrics recompute; zero locked predictions altered.

## Self-review / coverage

- Spec "Data workstream (A)" steps 1–5 → Tasks 1–5. ✓
- Data-safety + immutability constraints → Global Constraints + Task 4 Step 1. ✓
- forecast-pulse settled-count → Task 4. ✓
