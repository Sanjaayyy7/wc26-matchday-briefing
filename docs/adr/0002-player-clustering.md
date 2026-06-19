# ADR-0002: Player Clustering — k-means++ on WC26 Match-Derived Stats

**Date**: 2026-06-18
**Status**: accepted
**Deciders**: players-agent (Task 2)

## Context

Task 2 requires grouping WC26 players into "playing style clusters" displayed
on `/players`. Only 3 group-stage fixtures have scoreboard data; 48 teams
and 66 seeded players have no shot/key-pass box scores. The feature matrix is
therefore sparse. We need a deterministic, dependency-free clustering approach
that degrades gracefully when data is thin and that surfaces meaningful
groupings as data accumulates during the tournament.

## Decision

Use k-means++ seeded by `mulberry32(20260618)` on a 5-feature matrix
`[goals, assists, shots, keyPasses, n90]`, standardized with z-score
(zero-std guard → 1). Select k ∈ {3..6} by mean silhouette coefficient;
first k that achieves the best score wins (tie-break: lowest k).

**Chosen k**: 4 (silhouette = 1.000 on current dataset; near-zero variance
in 59/66 players who have zero stats collapses them into one tight cluster).

**Feature rationale**:
- `goals`, `assists`: direct match-fact evidence (verified/derived rows)
- `shots`, `keyPasses`: box-score fields for future enrichment
- `n90` (minutes/90): volume proxy; separates starters from substitutes

**Data strategy**: `fetch-players.mts` tries Wikidata SPARQL first; falls back
to a curated seeded roster of ≥50 WC26 players (confidence 0.3). All rows
carry `_prov` and pass `assertProvenance()`. The UI surfaces a visible
"seeded" badge on every player whose provenance `originType === "seeded"`.

## Alternatives Considered

### Alternative 1: DBSCAN
- **Pros**: No k required; handles noise points.
- **Cons**: Requires tuning ε/minPts; non-deterministic ordering; harder to
  label clusters meaningfully for UI display.
- **Why not**: Adds tuning complexity; k-means++ is sufficient and fast.

### Alternative 2: k=3 fixed
- **Pros**: Simpler.
- **Cons**: Ignores the silhouette signal; may under-separate attack vs
  midfield when more box-score data arrives.
- **Why not**: Silhouette-driven selection is only marginally more complex and
  will auto-tune as data fills in.

### Alternative 3: External library (ml-kmeans, scikit-learn)
- **Pros**: Battle-tested implementations.
- **Cons**: New dependency; `lib/kmeans.ts` is ≈80 lines with full tests;
  eliminates runtime bundle risk.
- **Why not**: No new npm dependencies needed for a small, well-tested
  in-house implementation.

## Consequences

### Positive
- Deterministic: same seed → same clusters across CI runs.
- Provenance-clean: every row auditable; seeded data clearly labelled.
- Self-tuning k: silhouette will rebalance when real box-score data arrives.
- Zero new npm dependencies.

### Negative
- With 59/66 players at zero stats, k=4 is numerically degenerate today;
  the "Utility" cluster contains nearly everyone.
- Silhouette = 1.0 on near-identical zero vectors is an artefact, not a
  signal of genuine separability.

### Risks
- **Data sparsity**: As the tournament progresses and box scores are filled
  in, cluster assignments will change on each `players:build` run. Mitigation:
  the seed is fixed (20260618) and the build is idempotent for a given
  `player-stats.json` snapshot.
- **Seeded roster accuracy**: Seeded rows are curated best-effort; some
  players may be on wrong teams or wrong positions. Mitigation: confidence
  is capped at 0.3 and the "seeded" badge warns users.
