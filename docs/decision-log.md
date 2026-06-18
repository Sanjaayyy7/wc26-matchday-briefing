# Decision Log — WC26 Three-Features

Lightweight running ledger (plan §L). Every cross-cutting/irreversible decision is appended here. Heavyweight choices also get a formal ADR in `adr/`.

Format: `## YYYY-MM-DD — <agent> — <one-line decision>` then Decision · Reason · Alternatives rejected · Impact.

---

## 2026-06-17 — controller — Branch carrying the in-flight design refactor; commit it as its own snapshot
- **Decision:** Created `feat/wc26-three-features` off `main`, carrying the 29 dirty files, then committed the in-flight design refactor as snapshot `3fe0e51` so new-feature commits sit cleanly on top.
- **Reason:** `main` was dirty and the untracked `cinematic.tsx`/`app-chrome.tsx` are reused by the plan; stashing would break the reuse. User chose this strategy explicitly.
- **Alternatives rejected:** stash (would remove reused untracked files); commit refactor on main (puts in-flight work permanently on main).
- **Impact:** all work isolated on a branch; reversible via branch deletion.

## 2026-06-17 — controller — Phase 0 research findings (gate output)
- **Decision:** Confirmed the signatures the plan depends on before any feature code.
- **Findings:**
  - `lib/calibration.ts`: `brier(model: Split, realized: Outcome)` and `rps(model, realized)` take a **percentage-point Split (~100) + outcome string**, NOT positional arrays. `calibrationBins(preds: {p, hit}[]) → {bins, ece}`. `deVig(raw: Split)`. → `eval-model.mts` must call these with that shape; the Task-1 unit test uses a local `mse` helper (no `brier` dependency), so no conflict.
  - `lib/rng.ts`: `mulberry32(seed: number) → () => number`. K-Means seeds via `mulberry32(seed)` then calls `rng()`.
  - `components/app-chrome.tsx`: nav is a `NAV` array (not in `cinematic.tsx`); `Trophy`/`Activity` icons already imported → used for Players/Sentiment without new imports.
  - `components/cinematic.tsx` exports: RouteStack, CanvasSection, DataPlane, SignalStat, SignalLine, MetricRun, ArtifactScene, HeroScene, FixtureLine, AgentActivity, MatchMarketLine. (`AppChrome` is in `app-chrome.tsx`.)
  - `scripts/shared.mts` exports: `appDir`, `loadEnv`, `fixtures()`, `teams()`, `fixtureBySlugOrDie(slug)`, `outDir(slug)`, `kalshiEventTicker(f)` — scaffold for new fetchers.
  - `lib/match-view.ts`: `ScorerDisplay {player,team,minute,assist?}`, cards `{player,team,type,minute,reason?}`; match-facts file is `Record<slug, MatchFactsDisplay | string>` → **guard string entries** when aggregating player stats / sentiment events.
- **Impact:** no blockers; plan §I unchanged except import paths noted above.
