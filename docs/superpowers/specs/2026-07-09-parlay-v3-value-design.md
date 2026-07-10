# Parlay Optimizer v3 — Value Profile Design (pre-registered 2026-07-09)

User decisions (2026-07-09, post-QF1): replace the hit-first profile; slips should
resemble a real parlay (e.g. the user's FRA-MAR example — France to advance +
over 1.5 goals YES + Mbappé 1+ — which hit on 2026-07-09), with real payout and
every leg statistically priced by the model. Goalscorer markets join the modeled
universe via SportsAPI Pro player data. Regulation-time moneyline and To-Advance
are mutually exclusive in one Kalshi combo (user-verified in app).

## Engine version

`engineVersion: "v3-value"`. v2.1-combo stops locking; its records (and v1/v2)
remain in the ledger and grade under their own stored rules (never-delete).

## Universe (10 series)

The 9 modeled series plus `KXWCGOAL` (goalscorers, YES-only, strikes 1+/2+/3+).
Corners stay excluded (unmodeled). Sides: YES and NO everywhere except the
YES-only set {KXWCGAME, KXWC1H, KXWCGOAL}.

## Registered constraints (stored on every record as `constraints`)

- `legMin 0.50 ≤ leg model P ≤ legMax 0.90`
- `jointMin 0.30 ≤ joint model P ≤ jointMax 0.60`
- 2–4 legs (`maxLegs 4`)
- `maxLegsPerSeries 1` (all series, incl. GOAL)
- `exclusiveSeries [["KXWCGAME","KXWCADVANCE"]]` — at most one of the pair per
  slip (user-verified Kalshi rule: reg-time ML and To-Advance cannot share a ticket)
- pairwise redundancy: for every leg pair, P(i∧j)/min(P(i),P(j)) ≤ REDUNDANCY_CAP 0.97
- `minEdge 0.03` where `edge = jointProb − comboImpliedProb`; subsets with any
  missing mid are ineligible

## Objective (REGISTERED PRINCIPLE CHANGE)

Selection maximizes `edge = model joint − product of side-adjusted Kalshi mids`
over all 2–4-leg subsets meeting the constraints (exhaustive search,
deterministic tie-breaks: higher joint, then lexicographic ticker+side).
v1/v2 registered "Kalshi mids never influence selection"; v3 explicitly
registers lock-time mids as the value benchmark inside selection. Model
probabilities remain 100% model-derived; mids only rank/gate subsets.
No-slip when no subset qualifies.

## Goalscorer layer (pre-registered)

- Priceable players: the predicted XI (confirmed lineup when available) from
  SportsAPI Pro `GET /api/match/{matchId}/predicted-lineups`.
- Attack weight `A_i = goals_i + xG_i` over WC26 (tournament 16, season 58210,
  per-player tournament statistics); players missing stats get `A_i = 0.1`.
- `share_i = A_i / Σ_XI A_j` (shares sum to 1 over the XI; bench goals ignored —
  registered approximation).
- Joint pricing is exact on the existing lattice: in a cell where the player's
  team scores g, player goals ~ Binomial(g, share_i);
  P(player ≥ k | cell) = Binomial tail. No independence hacks; scorer legs are
  thinned team goals, so correlation with totals/spreads/ML legs is exact.
- Extra-time goals ignored (Kalshi GOAL window includes ET): model P for scorer
  YES legs is a registered conservative under-estimate — edge is understated,
  never inflated.
- ADVANCE × GOAL: advance ET Bernoulli applies to draw cells as in v1/v2;
  scorer thinning uses 90' goals in every cell (registered approximation).
- Stored on each record with GOAL candidates: `playerModel { source,
  lineupConfirmed, players: [{ code, name, teamSide, share }] }` where `code` is
  the ticker infix (e.g. `ESPMOYARZ10`) — the inspector reproduces every scorer
  probability from stored shares + stored lambdas without network access.

## Record schema additions vs v2.1

`constraints` (above), `edge`, `playerModel` (when present). Snapshot file
`<slug>-v3.json` (10 series). Raw SportsAPI Pro responses cached under
`data/raw/sportsapipro/` (gitignored; reproducibility carried by stored shares).
API key via env `SPORTSAPIPRO_API_KEY` only — never committed, never stored in
records or snapshots. If the key/lineups are unavailable at lock time, GOAL
candidates are skipped with a console warning and selection proceeds on the
9-series universe.

## Grading

Non-GOAL legs grade exactly as v2 (`gradeLegV2`, HT window, advance winner).
GOAL legs grade from `goals: [{ side: "home"|"away", player, count }]` on the
knockout-results row (dual-source: SportsAPI Pro incidents + ESPN key events);
leg title player name must match a `player` entry; hit = count ≥ strike;
missing goals data → leg ungradable (pending), never guessed.

## Kalshi surface caveat (recorded)

Kalshi WEB splits Regulation Time and Full Match into separate combo builders;
the user's app combines them in one ticket, and the multivariate collections
API associates all WC series in one collection. The app is the purchasability
ground truth for this project. The GAME⊥ADVANCE exclusion above is the one
user-verified cross-bracket restriction.

## UI

v3 slips are current; every leg shows an app-style build line
(`Point Total → 5.5 → No`, `Goalscorers → Mikel Oyarzabal 1+ → Yes`,
`Full Match → To Advance → Spain → Yes`). v2.1 cards get a "superseded by v3"
note (they remain valid combos); v1/v2 badges unchanged. Methodology and
/parlay protocol copy updated to describe the value objective, the mids
principle change, and the goalscorer layer.
