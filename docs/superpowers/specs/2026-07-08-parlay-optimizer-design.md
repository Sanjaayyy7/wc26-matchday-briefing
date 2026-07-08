# Parlay Optimizer — Design Spec

**Date:** 2026-07-08
**Status:** Approved design (user, 2026-07-08), pre-implementation
**Branch:** `feat/parlay-optimizer` (worktree, parallel to Phase 4)
**User decisions:** objective = confidence-tiered hit-max · full product (locked ledger + grading + app page) · skill-routed workflow per MUSTUSE catalog · dedicated inspector gate

## 1. What this is

Per WC26 match, generate one model-optimized Kalshi parlay slip: 2-5 legs
drawn STRICTLY from Kalshi-listed markets for that match, each leg priced by
our Dixon-Coles score grid, the slip's joint probability computed EXACTLY on
the grid (legs within a match are correlated — the grid gives the true joint,
which is the edge over multiplying marginals), every leg carrying templated
reasoning assembled only from computed quantities. Slips lock pre-kickoff
into an immutable ledger, grade post-FT leg-by-leg, and render Kalshi-style
on a new app page. A `parlay-inspector` joins the design/execution/model
inspector gate suite.

## 2. Market universe (probed live 2026-07-08, FRA-MAR)

| Series | Markets | Grid predicate |
| --- | --- | --- |
| `KXWCGAME` | 3 (reg-time H/D/A) | sign(h−a) |
| `KXWCSPREAD` | 4 (win by >1.5 / >2.5 per team) | h−a vs line |
| `KXWCTOTAL` | 6 (O/U 0.5…5.5) | h+a vs line |
| `KXWCTEAMTOTAL` | ~7 (team O/U lines) | h (or a) vs line |
| `KXWCBTTS` | 1 | h>0 ∧ a>0 |
| `KXWCSCORE` | 25 (exact scores) | single cell |
| `KXWCADVANCE` | 2 | win90 ∪ (draw90 ∩ winET) |

≈46 markets/match; each contributes a YES and a NO candidate leg (~92
candidates). **Excluded on honesty grounds (not grid-derivable): player
props (goalscorer/assists/starters), corners, method-of-victory ET/pens
splits beyond ADVANCE, mentions/announcer markets.** The engine must be
structurally unable to emit a leg without a grid predicate.

Event ticker pattern: `{SERIES}-{YYMONDD}{HOMEABBR}{AWAYABBR}` (e.g.
`KXWCADVANCE-26JUL09FRAMAR`), same family as `kalshiEventTicker` in
`scripts/shared.mts` (KXWCGAME already used by the prediction lock flow).
Kalshi prices de-vigged with the `lock-predictions.mts` mid-price idiom.

## 3. Engine — `lib/parlay.ts` (pure, no I/O)

**Grid.** `scoreGrid(λh, λa, ρ)` over 0..GRID_SIZE−1 per side, same
`lambdasFromElo` path the predictions use, computed from `data/model.json`
params + current Elos at slip-lock time (the same model state that locked
the match prediction — one source of numbers).

**Predicates.** `legPredicate(market): ((h: number, a: number) => boolean) | null`
— null means unpriceable (excluded upstream; inspector enforces none leak).
NO legs = negation.

**Joint.** For reg-time-only leg sets: Σ grid mass over cells where all
predicates true. With an ADVANCE leg: joint =
Σ(win-branch cells passing all reg-time legs) +
`etWinProb` × Σ(draw-branch cells passing all reg-time legs), where
`etWinProb = 1/(1+10^(−(eloH−eloA)/800))` — copied verbatim from the
simulator's knockout fold (`lib/simulate.ts:160`), one convention everywhere.
(ADVANCE-No side symmetric.)

**Selection (pre-registered, deterministic).**
- Candidate legs: model prob ≥ `LEG_FLOOR = 0.60`, market listed on Kalshi
  at slip time.
- Seed: highest marginal-prob candidate; ties broken by ticker lexicographic.
- Greedy add: at each step take the candidate with the highest conditional
  probability `P(L | current slip) ≤ REDUNDANCY_CAP = 0.97` (a leg implied
  by the slip is filler, not content); reject if adding drops joint below
  `JOINT_FLOOR = 0.35`; stop when no candidate qualifies or
  `MAX_LEGS = 5` reached.
- Leg count therefore emerges from confidence — the user requirement "model
  decides how many legs".
- If no 2-leg slip clears every floor: **no slip for that match**, recorded
  as `{ slug, lockedAt, verdict: "no-slip", reason: "no 2-leg combo ≥ floors" }`
  — honesty over content.

**Determinism:** same inputs ⇒ byte-identical slip. No randomness anywhere.

## 4. Reasoning — templated, hallucination-proof by construction

Each leg's `reasoning` string is assembled ONLY from these computed fields:
model prob, top-3 contributing grid cells + their mass, Elo diff, team form
string (model.json `forms`), Kalshi de-vig prob + signed edge. Fixed grammar:

```
"<Leg title>: model <P>% ≥ floor; top scorelines <s1>/<s2>/<s3> = <mass>%;
Elo <±D>; Kalshi <K>% (edge <±E>)."
```

No freeform text generation anywhere in the pipeline. The inspector
re-derives every number in the string from the stored inputs; a mismatch is
a gate failure. This is the "no hallucinations throughout the workflow"
requirement made mechanical.

## 5. Ledger — `data/parlays.json` (committed, immutable)

```jsonc
{
  "slug": "france-vs-morocco",
  "lockedAt": "2026-07-08T...Z",
  "modelDataThrough": "2026-07-07",
  "etWinProbHome": 0.62,            // only when an ADVANCE leg present
  "legs": [
    {
      "ticker": "KXWCADVANCE-26JUL09FRAMAR-FRA",
      "side": "yes",
      "title": "France advances",
      "modelProb": 0.78,
      "kalshiMid": 0.775,           // de-vigged; null if book empty
      "reasoning": "France advances: model 78% ≥ floor; ..."
    }
  ],
  "jointProb": 0.47,
  // added by grading, never mutating the above:
  "result": { "legs": [{ "ticker": "...", "hit": true }], "slipHit": true, "gradedAt": "..." }
}
```

Lock-time Kalshi snapshot for ALL candidate markets (not just chosen legs)
stored beside the ledger at `data/markets/parlay-snapshots/<slug>.json` —
the inspector's evidence that every leg's ticker existed at lock and that
prices weren't invented.

## 6. Pipeline

- **`scripts/lock-parlays.mts`** (`npm run parlay:lock`) — for each upcoming
  locked-prediction fixture without a slip: fetch all 7 series' markets,
  de-vig, run engine, write slip + snapshot. Refuses to touch fixtures whose
  kickoff has passed, and NEVER rewrites an existing slip (idempotent
  re-run = "0 new"). Runs in the same ops window as `pipeline:lock`.
- **`scripts/settle-parlays.mts`** (`npm run parlay:settle`) — grades slips
  for settled fixtures: reg-time legs from the 90' score via
  `lib/knockout-grading` (same `after`/`homeScore90` semantics as
  prediction grading — pens matches grade reg-time legs off the 90' draw),
  ADVANCE legs from `knockout-results.json` `winnerId`. Appends `result`
  only; locked fields byte-immutable. Runs in the settle cadence.
- **Accountability:** `build-accountability.mts` gains a slips section —
  slips graded, slip hit rate, leg hit rate, mean stored jointProb vs
  realized slip hit rate (calibration of the joint number itself).

## 7. Inspector — `scripts/parlay-inspector.mts` (`npm run parlay:inspect`)

Gates (all must pass; wired into the standard gate suite beside
design/execution/model inspectors):
1. Every leg ticker exists in the stored lock-time snapshot for that slug.
2. Every leg has a defined grid predicate (no unpriceable market leaked).
3. Recomputing modelProb and jointProb from stored inputs (model params at
   `modelDataThrough`, stored etWinProbHome) reproduces stored values ±1e-9.
4. Floors respected: every leg ≥ LEG_FLOOR, joint ≥ JOINT_FLOOR, 2 ≤ legs ≤ 5,
   every non-seed leg's conditional ≤ REDUNDANCY_CAP.
5. Reasoning strings parse under the fixed grammar and every embedded number
   re-derives from stored inputs.
6. Immutability: locked fields of previously-committed slips byte-identical
   (mirror of the prediction settle check).
7. `no-slip` records carry the machine-checkable reason.

## 8. App page — `/parlay`

Kalshi-style slip cards in the shipped Linear design system (Surface,
type tokens, `--accent` interactive-only, data-semantic `--up/--down`):
upcoming slips (legs with model% vs Kalshi% chips, joint prob, expandable
per-leg reasoning), graded history (per-leg ✓/✗ chips, slip verdict,
running slip/leg hit rates). Static data from `data/parlays.json` like every
other page — no client fetches. Design-inspector rules apply (no fabricated
numbers, single-source, honesty-first: misses render as prominently as hits).
Built under the `frontend-design` skill.

## 9. Error handling

| Failure | Behavior |
| --- | --- |
| Kalshi series returns no markets | universe shrinks; if <2 candidates, no-slip record |
| Kalshi API down at lock time | abort lock for that slug with console error; retry later; never fabricate prices (`kalshiMid: null` only when a series lists but book is empty) |
| Fixture kickoff passed | lock refuses (no post-hoc slips, ever) |
| Grading before results exist | slug skipped, "0 graded" |
| Ticker present in slip but missing from snapshot | inspector FAIL (hard gate) |

## 10. Testing

Engine (fixture-based, zero network): predicate correctness per series
(YES + NO) · joint == brute-force enumeration on a small grid · ADVANCE
branch math vs hand-computed decomposition · greedy selection determinism +
each floor binding (constructed markets that trip each constraint) ·
redundancy cap rejects implied legs · no-slip path. Pipeline: lock
idempotence, immutability, grading vs knockout-grading fixtures (90' draw +
pens case). Inspector: one failing fixture per gate proves each gate fires.
Page: render test with hits+misses fixture. Full repo gates before every
commit.

## 11. Scope & rollout (two plans, one spec)

- **Plan A — engine + pipeline + inspector** (lib/parlay.ts,
  lock/settle/inspector scripts, ledger, accountability section). Ships
  first; slips exist as committed JSON + report.
- **Plan B — `/parlay` page** (frontend-design skill), consumes the ledger.
- First live target: remaining QFs if Plan A lands in time; otherwise SFs
  (lock ~Jul 14-15). No slip is ever produced for a match already kicked off.

## 12. Risks

- **Thin Kalshi books** on niche series (TEAMTOTAL/SCORE) → mids noisy;
  mitigated: de-vig + `kalshiMid` is display/benchmark-only, never a
  selection input (selection is pure model — hit-max, user decision).
- **Public slips that miss** — by design; the calibration-of-jointProb
  metric turns misses into product content (accountability brand).
- **ET share model is crude** (Elo logistic, no pens skill) — same
  convention the simulator already ships; consistency beats false precision;
  stated on the methodology page when Plan B lands.
- **Correlation blind spot across matches:** none — slips are single-match
  by construction (v1 scope; cross-match combos out of scope).
