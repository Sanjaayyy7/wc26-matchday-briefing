# Architecture

## System Overview

```
data/raw/results.csv          ← martj42 (49k international matches, 1872–present)
       ↓
scripts/train-model.mts       ← Elo ratings fit + Dixon-Coles Poisson regression
       ↓
data/model.json               ← trained artifact: ratings, params, calibration, backtest
       ↓
lib/predict.ts                ← fixture prediction engine (Elo gap → Poisson grid → 1X2 split)
       ↓
app/api/preview/route.ts      ← deterministic prediction endpoint (no LLM, pure JS)
       ↓
app/fixture/[slug]/page.tsx   ← SSG fixture detail pages (72 fixtures, generated at build time)
```

## Key Modules

### Prediction Pipeline
| File | Role |
|------|------|
| `lib/elo.ts` | Elo rating delta calculation (K factor, goal margin, home advantage) |
| `lib/poisson-model.ts` | Dixon-Coles score grid; lambdas from Elo gap; rho correction |
| `lib/predict.ts` | Fixture-level coordinator: calls Elo + Poisson, returns split + scoreline |
| `lib/simulate.ts` | Monte Carlo tournament simulator (seeded, FIFA tiebreakers, ET/pens) |
| `lib/rng.ts` | Mulberry32 PRNG (reproducible simulations across runs) |
| `lib/calibration.ts` | Kalshi market deviation tracking; model-vs-market Brier |

### Data Layer
| File | Role |
|------|------|
| `data/model.json` | Trained Elo params + calibration coefficients + backtest report |
| `data/fixtures.json` | All 72 WC26 fixtures; `homeScore`/`awayScore` added as matches complete |
| `data/predictions.json` | Immutable locked prediction ledger (probabilities frozen pre-kickoff) |
| `data/bracket.json` | Knockout bracket structure (Wikipedia + ESPN verified) |
| `data/simulation.json` | Monte Carlo tournament simulation results (10k runs) |
| `data/backtest/wc26-accountability.json` | Live accuracy metrics (rebuilt after every settlement) |
| `data/markets/kalshi-resolutions.json` | Kalshi contract outcomes (settlement cross-check) |
| `data/model-registry.json` | Champion-Challenger model version governance log |

### Accountability & Settlement
| File | Role |
|------|------|
| `lib/accountability.ts` | Pure function: `buildAccountability(ledger, matchFacts, kalshiResolutions, polymarket)` → Brier/RPS/ECE/calibration bins |
| `lib/predictions-ledger.ts` | `settle()`: adds result/modelBrier/modelRps/logLoss to locked entries |
| `scripts/fetch-match-results.mts` | Patches fixtures.json with actual scores from martj42 CSV |
| `scripts/settle-predictions.mts` | Runner: reads fixtures + ledger → settles → writes predictions.json |
| `scripts/build-accountability.mts` | Runner: calls buildAccountability → writes wc26-accountability.json |

### UI
| File | Role |
|------|------|
| `app/` | Next.js 16 App Router; fixture/team/player pages are SSG |
| `components/cinematic.tsx` | Layout primitives (CanvasSection, DataPlane, RouteStack, SignalLine) |
| `app/globals.css` | CSS token system (`--void`, `--canvas`, `--ink`, `--up`, `--down`, etc.) |
| `components/app-chrome.tsx` | Navigation shell + theme toggle (dark/light) |
| `components/calibration-chart.tsx` | Plotly reliability diagram (predicted vs observed frequency) |

---

## Data Flow: Matchday Settlement

After each matchday, run this sequence:

```
1. npm run ml:fetch
   → Downloads latest martj42 CSV to data/raw/results.csv

2. npx tsx scripts/fetch-match-results.mts
   → Reads CSV, matches WC26 rows by team name → team ID
   → Writes homeScore/awayScore into data/fixtures.json

3. npm run pipeline:settle
   → Reads fixtures.json + predictions.json + kalshi-resolutions.json
   → Calls settle() for each unsettled locked entry
   → Writes back predictions.json with result/modelBrier/modelRps/logLoss

4. npm run report:accountability
   → Calls buildAccountability() with settled ledger
   → Writes data/backtest/wc26-accountability.json
   → Includes calibrationBins for the reliability diagram on /record
```

Then commit and push — Vercel auto-deploys.

---

## Build Output

```
npm run build
→ 199 static pages + 2 dynamic API routes
→ Zero external runtime dependencies (model.json + predictions.json ship in build)
→ TypeScript strict mode; 0 errors required
→ @huggingface/transformers is serverExternalPackage (offline scripts only, never imported by API routes)
```

---

## Model Governance

See `data/model-registry.json` and `docs/adr/0005-model-versioning.md`.

Current champion: `v1.0.0-platt` (Brier 0.5085, ECE 1.95%, n=2,546).

A Challenger may only replace the Champion if Brier improves, ECE remains ≤ 3%, walk-forward RPS improves, no feature leakage, no overfitting, and results are reproducible. Promotion decisions are documented in the registry — models are never silently overwritten.
