# Parlay Optimizer v2 — Combo-Eligible Slips — Design Spec

**Date:** 2026-07-08
**Status:** Approved design (user, 2026-07-08), pre-implementation
**Supersedes:** selection universe + floors of `2026-07-08-parlay-optimizer-design.md`
(v1). Everything not restated here (reasoning grammar, snapshot evidence,
immutability semantics, determinism, error-handling defaults) carries over
from the v1 spec unchanged.
**Branch:** `feat/parlay-v2-combo` (off `feat/parlay-page`; rebase onto main
when PR #49 merges)
**User decisions (2026-07-08):** leg universe = model-priced combo-eligible
series only · sides = YES+NO everywhere except 3-way moneylines (YES-only) ·
per-match slips only · hit-first floors (LEG ≥ 0.75, JOINT ≥ 0.60, 2–4 legs) ·
relock all 4 QFs as v2 before their kickoffs · 1H model = binomial goal-split
on the existing DC grid (approach A)

## 1. Why v2 exists

v1 slips are mathematically sound but **not purchasable**: their backbone is
exact-score fades (`KXWCSCORE`) and team totals (`KXWCTEAMTOTAL`), and
Kalshi's combo builder does not list either series. A slip that cannot be
bought as one ticket fails the product's purpose. Kalshi's combo builder
(verified by user in-app, 2026-07-08, screenshots on file) exposes exactly
two brackets per match and allows mixing them freely within one combo:

- **Regulation Time:** 3-way moneyline, spread, total, both-teams-to-score,
  and the four 1st-half variants (ML / spread / total / BTTS).
- **Full Match:** to-advance, goalscorers, total corners, team corners.

A 3-leg cross-bracket combo (Reg ML + Reg total NO + goalscorer) was placed
in-app by the user — cross-bracket combinability is confirmed, not assumed.

v2 restricts the candidate universe to combo-eligible series that our model
can actually price, retunes floors for a hit-first risk profile, and adds a
first-half probability layer so 1H legs share one exact joint with
full-match legs.

## 2. Market universe (probed live 2026-07-08, FRA-MAR; all priced)

Single source of truth: a **series registry** exported from
`scripts/shared.mts`, consumed by lock, settle, inspector, and page.

| Series | Bracket | Markets (FRA-MAR) | Sides | Grade window | Lattice predicate over (h₁,a₁,h,a) |
| --- | --- | --- | --- | --- | --- |
| `KXWCGAME` | reg | 3 (H/D/A) | **YES only** | 90′ | sign(h−a) |
| `KXWCSPREAD` | reg | 4 (win by >1.5 / >2.5 per team) | YES+NO | 90′ | h−a vs line |
| `KXWCTOTAL` | reg | 6 (O 0.5…5.5) | YES+NO | 90′ | h+a vs line |
| `KXWCBTTS` | reg | 1 | YES+NO | 90′ | h>0 ∧ a>0 |
| `KXWC1H` | reg | 3 (H/D/A at HT) | **YES only** | HT | sign(h₁−a₁) |
| `KXWC1HSPREAD` | reg | 2 (win 1H by >1.5 per team) | YES+NO | HT | h₁−a₁ vs line |
| `KXWC1HTOTAL` | reg | 4 (O 0.5…3.5 1H goals) | YES+NO | HT | h₁+a₁ vs line |
| `KXWC1HBTTS` | reg | 1 | YES+NO | HT | h₁>0 ∧ a₁>0 |
| `KXWCADVANCE` | full | 2 | YES+NO | advance | win90 ∪ (draw90 ∩ winET) |

≈46 candidate legs/match. YES-only on the two 3-way moneylines mirrors the
combo builder UI (one price button per outcome; no NO side offered).

**Dropped from v1 universe (combo-ineligible):** `KXWCSCORE`,
`KXWCTEAMTOTAL`.
**Combo-eligible but structurally excluded (unmodeled):** `KXWCGOAL`
(goalscorers), `KXWCCORNERS`, `KXWCTCORNERS` — no player or corners model
exists; selecting them would mean trusting Kalshi's own price, which
violates the model-only selection principle. The engine remains structurally
unable to emit a leg without a lattice predicate. Methodology states the
exclusion ("listed in the combo builder, not modeled, therefore never
picked").

**Combinability invariant (new inspector gate):** every leg's series must be
in the registry with `comboEligible: true`, all legs same match, ML legs
YES-side. A v2 slip is a valid Kalshi combo ticket by construction.

## 3. First-half layer — binomial goal-split (approach A)

The shipped Dixon-Coles 90′ grid (with tau) stays the single ground truth.
Given a final 90′ score (h,a), each home goal lands in the first half
independently with probability `Q_FIRST_HALF`, likewise away goals:

```
P(h₁,a₁,h,a) = P_DC(h,a) · C(h,h₁)·q^h₁·(1−q)^(h−h₁) · C(a,a₁)·q^a₁·(1−q)^(a−a₁)
```

- **`Q_FIRST_HALF = 0.45`, pre-registered.** Historical share of goals
  scored before half-time across World Cups runs ≈ 44–46% (goals cluster
  late). Refit from our own captured HT scores is deferred until enough
  accumulate; any change is a new pre-registered constant with a dated
  methodology note — never a silent retune.
- The 4-dim lattice is 0..GRID_SIZE−1 on h,a with h₁ ≤ h, a₁ ≤ a — small
  enough to enumerate exactly. Joint = Σ lattice mass over cells passing all
  predicates. Cross-half correlation is exact within-model ("1H under 1.5"
  and "FT under 3.5" correlate correctly; that is the edge over multiplying
  marginals).
- **Why not independent half-Poissons:** convolving λq and λ(1−q) halves
  loses the DC tau correction, so full-match prices on /parlay would drift
  from /forecasts on the same market. One engine, one set of numbers.
- **ADVANCE interaction:** unchanged v1 fold — joint =
  Σ(win-branch cells passing all legs) + etWinProb · Σ(draw-branch cells
  passing all legs). 1H predicates evaluate on (h₁,a₁) inside both branches;
  extra time cannot contain first-half goals, so the split is independent of
  the ET outcome given the 90′ score. `etWinProb` stays the simulator's Elo
  logistic, verbatim.
- **Known crudeness (disclosed, methodology):** goal timing is assumed
  independent of score state; q is a tournament-wide constant, not
  team-specific. Same honesty pattern as the crude ET share.

## 4. Selection — pre-registered v2 floors, hit-first

Greedy hit-max, deterministic, identical mechanics to v1 with new constants:

- `LEG_FLOOR_V2 = 0.75` (was 0.60)
- `JOINT_FLOOR_V2 = 0.60` (was 0.35)
- `MAX_LEGS_V2 = 4` (was 5); min 2 unchanged
- `REDUNDANCY_CAP = 0.97` unchanged (conditional P(L | slip) above cap =
  filler, rejected)
- Sides filtered per registry at candidate generation (YES-only ML enforced
  before selection ever sees a NO-ML candidate).
- Seed = highest marginal; ties by ticker lexicographic. Add = highest
  conditional ≤ cap; reject if joint would drop below `JOINT_FLOOR_V2`;
  stop at no qualifying candidate or 4 legs.
- If no 2-leg slip clears every floor: **no-slip record** with reason
  `"no 2-leg combo ≥ v2 floors"`. Under hit-first floors this is the
  *expected* outcome for tight matches (ESP-BEL-like, v1 joint 0.55) —
  honesty over content, stated on the page.

Rationale: the slip is designed to hit on the day (target joint ≥ 0.60),
sized 2–4 legs, payout modest. "Expect it to grade green tomorrow" is the
product promise; variance ("luck") is what the joint number prices —
calibration of stored jointProb vs realized hit rate is the public metric
that keeps that promise auditable.

## 5. Ledger — versioned, immutable, backward-compatible

`data/parlays.json` entries gain `engineVersion`:

- Absent field ⇒ `"v1"` (the 4 existing QF slips; never edited).
- New slips ⇒ `"v2-combo"`.
- Identity key becomes `(slug, engineVersion)`. `parlay:lock` v2 relocks all
  4 QFs (kickoffs not passed) alongside their v1 entries; idempotent re-run
  = "0 new" per version.
- v2 slips store everything v1 stored **plus** `qFirstHalf: 0.45` and
  `floors: { leg: 0.75, joint: 0.60, maxLegs: 4 }` so the inspector
  recomputes from stored inputs alone (±1e-9), no version-conditional
  constants baked into the inspector.
- New display-only slip field `comboImpliedProb`: product of the legs'
  stored de-vigged mids — `kalshiMid` per leg (`null` if any leg mid is null).
  Approximate by construction (Kalshi's combo pricing adds vig/fees);
  labeled "≈" wherever rendered. **Never a selection input** — unchanged
  core principle.
- Snapshots unchanged: full candidate-book snapshot per (slug, version) at
  `data/markets/parlay-snapshots/<slug>-v2.json`.

Both versions grade. Both count in accountability, reported split by
version (v1 record is an honest artifact of the pre-combo engine, not
hidden).

## 6. Grading — HT capture + version-aware settle

- **Results capture** (`data/knockout-results.json` flow) gains optional
  `ht: { home, away }` per match, sourced from ESPN scoreboard linescores
  (period 1) during the existing dual-source verify step; OneFootball as
  cross-check.
- `gradeLeg` extends by grade window from the registry:
  - `90′` series — 90-minute score, exactly v1 semantics (pens matches grade
    reg legs off the 90′ draw).
  - `HT` series — `ht` scores; if `ht` missing, those legs return `null`
    (ungradable) and the **slip verdict stays pending** with a console
    warning naming the missing datum. Never fabricated, never guessed from
    FT.
  - `advance` — `winnerId`, v1 semantics.
- `parlay:settle` grades every ungraded slip of either version; appends
  `result` only; locked fields byte-immutable.

## 7. Inspector — version-aware gates

All 7 v1 gates retained, evaluated against **the slip's own stored floors
and universe** (v1 slips validate as v1; no gate rewrites history). New:

8. **Combo-eligibility:** every leg's series is registry-listed
   `comboEligible`, single match per slip, ML legs YES-side only,
   leg count within the slip's stored `maxLegs`.
9. **Lattice reproduction (v2):** recomputing jointProb from stored model
   params + stored `qFirstHalf` + stored `etWinProbHome` reproduces stored
   value ±1e-9 (extends v1 gate 3 to the 4-dim lattice).
10. **`comboImpliedProb` re-derives** from stored leg mids (or is null when
    any mid is null).

## 8. App page — /parlay v2

- v2 slips render as the live cards (same slip-card system, joint prob stays
  the single signature number).
- New per-slip line: `model joint X% · Kalshi combo ≈Y%` with signed edge —
  display-only, "≈" mandatory.
- v1 cards get a small badge: `v1 engine — pre-combo, not purchasable as one
  ticket`. Misses render as prominently as hits, unchanged.
- Record section splits by engine version (slip hit rate, leg hit rate,
  mean stored jointProb vs realized — per version).
- No client fetches; static from the ledger; design-inspector rules apply;
  native `<details>` reasoning unchanged. Next.js version in this repo
  diverges from training data — read `node_modules/next/dist/docs/` before
  touching app code (AGENTS.md).

## 9. Methodology page additions

1. **Combo-eligible universe** — slips are restricted to markets Kalshi's
   combo builder can actually combine; goalscorers/corners are combo-eligible
   but unmodeled, therefore never selected.
2. **First-half split** — q = 0.45 binomial goal-split on the DC grid,
   crudeness disclosed (constant q, timing independent of score state),
   same pattern as the ET-share note.
3. **v2 floors** — dated pre-registration of LEG 0.75 / JOINT 0.60 /
   2–4 legs, hit-first rationale, and the explicit statement that tight
   matches are expected to produce no-slip records.

## 10. Error handling (delta over v1 table)

| Failure | Behavior |
| --- | --- |
| 1H series lists no markets for a match | universe shrinks; selection proceeds on the rest |
| `ht` missing at settle for slip with 1H legs | 1H legs `null`, slip pending, console warning; re-settle after capture |
| ESPN linescores absent for a finished match | capture `ht` from OneFootball; if both fail, record match without `ht` and leave affected slips pending |
| v1 slip encountered by v2 lock | untouched (different version key), never rewritten |
| Combo-ineligible series in candidate fetch | structurally impossible (registry-driven fetch); inspector gate 8 backstops |

## 11. Testing

- **Lattice:** marginal over (h₁,a₁) sums back to P_DC(h,a) exactly;
  q=0 ⇒ all 1H predicates on 0-0; q=1 ⇒ 1H ≡ FT; total mass = grid mass.
- **Evaluators:** per-series YES + NO vs hand-enumerated small lattice;
  joint == brute-force enumeration; ADVANCE × 1H hand-computed case
  (win-branch + draw-branch decomposition with a 1H leg).
- **Selection:** floors binding (constructed candidates tripping each of
  LEG/JOINT/maxLegs/redundancy), YES-only ML enforced at candidate stage,
  determinism, no-slip path under v2 floors.
- **Ledger/pipeline:** per-version lock idempotence, v1 entries
  byte-untouched by v2 lock, HT grading (0-0 HT case, pens-draw case,
  missing-`ht` pending case).
- **Inspector:** one failing fixture per gate incl. new 8/9/10; real ledger
  (4 v1 + 4 v2 slips) passes all gates.
- **Page:** render test with mixed v1/v2 fixture (badge, combo-≈ line,
  per-version record).
- Full repo gates (vitest, eslint, build, design/execution/model/parlay
  inspectors) before every commit.

## 12. Rollout & deadline

Single implementation plan (writing-plans skill), executed inline per
project discipline. Order: registry → lattice + evaluators → selection v2 →
lock v2 (relock 4 QFs) → inspector gates → HT capture + settle → page +
methodology.

**Hard deadline: FRA-MAR kickoff 2026-07-09 20:00Z** — v2 lock must run
before it. Remaining QF locks follow the same run (ESP-BEL Jul 10 19:00Z,
NOR-ENG Jul 11 21:00Z, ARG-SUI Jul 12 01:00Z). If the deadline is at risk,
ship registry→lock→inspector first (slips exist as committed JSON), page
trails within the same day.

## 13. Risks

- **q = 0.45 is crude** — goals skew late; a constant q slightly misprices
  extreme 1H legs. Mitigation: 1H legs still clear a 0.75 floor on their own
  model prob; disclosure; refit path defined.
- **Hit-first floors shrink content** — tight matches yield no-slip. This is
  the accepted trade (user decision); the page says so.
- **Thin 1H/ADVANCE books** — mids noisy; display-only, de-vigged, `null`
  tolerated.
- **Kalshi combo pricing opaque** — `comboImpliedProb` is a mid-product
  approximation; labeled "≈"; actual ticket price seen at purchase.
- **YES-only ML pool loss** — NO-side fades on spreads/totals remain the
  high-prob backbone; verified live (e.g. NO "Morocco 1H by >1.5" ≈ 0.97+,
  NO O3.5 ≈ 0.85+).
- **Relock optics** — two slips per QF in the ledger. Mitigation: version
  badge + methodology note; v1 stays graded; nothing deleted.
