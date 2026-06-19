# WC26 Forecasting Intelligence Platform

A continuously improving, auditable forecasting platform for the 2026 FIFA World Cup.
Predictions are locked before kickoff, scored after the whistle, and permanently recorded.

**[Live Demo →](#)**

---

## What Is This?

WC26 is a **Forecasting Intelligence Platform**, not a prediction website.

Predictions are the starting point. The real product is the system's ability to measure forecast accuracy, learn from completed matches, quantify uncertainty, and generate decision-grade intelligence from tournament results.

The benchmark is the forecasting rigor of organizations like FiveThirtyEight, Opta, and Kalshi — not other sports apps.

---

## Pages

| Route | Description |
|-------|-------------|
| `/` | Home — tournament overview and next fixture |
| `/matches` | Trading-terminal fixture board — all 72 matches, filters, locked splits |
| `/groups` | Live group standings — updated as results come in |
| `/teams` | Team directory — Elo ratings, form, tournament path |
| `/team/[id]` | Team dossier — squad, stats, Monte Carlo paths |
| `/players` | Player leaderboard — k-means clustering, impact scores |
| `/players/[id]` | Player detail — style cluster, contribution heatmap |
| `/simulator` | Monte Carlo futures board — sortable group-winner and final odds |
| `/sentiment` | Social sentiment dashboard — post-volume, tone, shift detection |
| `/record` | **Accountability ledger** — Brier score, RPS, ECE, calibration, model vs Kalshi |

---

## Model Architecture

### Elo Ratings
- Trained on 49,407 international results (1872–present) via the [martj42 dataset](https://github.com/martj42/international_results)
- Tournament-weighted K factor (major finals weight 2×)
- Goal-margin multiplier (each extra goal beyond 1 adds 25% K weight)
- Home advantage: +100 Elo points when not on neutral soil

### Dixon-Coles Poisson Model
- Expected goals derived from Elo gap (binned regression)
- Score grid computed as double-Poisson product (GRID\_SIZE × GRID\_SIZE)
- Win/draw/loss probabilities summed across grid cells
- Rho correction for low-scoring scoreline bias (0–0, 1–0, 0–1, 1–1)

### Calibration (Platt Scaling)
- Isotonic-then-Platt calibration applied post-hoc to 1X2 probabilities
- ECE < 3% on 2024+ holdout set
- Kalshi market deviation tracked live as independent calibration signal

### Monte Carlo Tournament Simulator
- 10,000 seeded simulations per run (Mulberry32 PRNG — reproducible)
- Locked real results preserved; unplayed matches sampled from Dixon-Coles grid
- Full FIFA group tiebreaker logic (GD → goals scored → H2H)
- ET + penalties for drawn knockout matches
- Results stored in `data/simulation.json`

### Honesty Gate
- Training aborts if backtest Brier ≥ 0.51 or ECE ≥ 3% (evidence-based threshold per ADR-0001)
- Model is never updated retroactively after a prediction is locked
- All predictions locked pre-kickoff in `data/predictions.json` (immutable ledger)

---

## Accuracy

| Metric | Our Model | Uniform Baseline |
|--------|-----------|-----------------|
| Brier score | **0.5085** | 0.6667 |
| RPS | **0.1671** | 0.2780 |
| ECE | **1.95%** | — |
| Log-loss | **0.8672** | — |
| Sample | n=2,546 (2024+ holdout) | — |

Live WC26 accountability at [/record](/record) — Brier, RPS, and ECE updated after every settled match.

---

## Data Sources

| Source | Used For |
|--------|----------|
| [martj42/international_results](https://github.com/martj42/international_results) | 49k historical results for Elo training |
| [Kalshi](https://kalshi.com) (KXWCGAME markets) | Live 3-way pre-kickoff book · calibration benchmark |
| [Polymarket](https://polymarket.com) | Alternative market benchmark |
| Wikipedia + ESPN | Bracket structure, fixture graph, group assignments |

No API keys required at runtime. The trained model ships as `data/model.json`.

---

## Tech Stack

- **Framework:** Next.js 16.2.6 (App Router, Turbopack dev, static generation)
- **Runtime:** React 19.2.4 · TypeScript 5
- **ML:** World Football Elo + Dixon-Coles (pure JS, no external service)
- **Sentiment:** [@huggingface/transformers](https://github.com/huggingface/transformers.js) (offline scoring script only)
- **Charts:** Plotly.js + react-plotly.js
- **UI:** Tailwind CSS 4 · Framer Motion · custom CSS token system
- **Tests:** Vitest (130 tests)
- **Deployment:** Vercel (Node 20)

---

## Setup

```bash
git clone https://github.com/<your-username>/wc26-matchday-briefing
cd wc26-matchday-briefing
npm install
npm run dev        # http://localhost:3000
```

The trained model ships in the repo (`data/model.json`). No retraining needed to run locally.

---

## Data Pipeline

```bash
# Refresh historical results + retrain model
npm run ml:fetch                         # Download latest martj42 CSV → data/raw/results.csv
npm run ml:train                         # Retrain Elo + Dixon-Coles → data/model.json

# Settle completed WC26 matches
npx tsx scripts/fetch-match-results.mts  # Patch fixtures.json with actual scores
npm run pipeline:settle                  # Score locked predictions against results
npm run report:accountability            # Rebuild data/backtest/wc26-accountability.json

# Live market snapshot (requires Kalshi API access)
npm run pipeline:fetch                   # Fetch live Kalshi 3-way books
npm run pipeline:calibrate               # Compute model-vs-market deviation
```

Run after each matchday to keep the accountability ledger current.

---

## Tests

```bash
npm test           # 130 vitest tests
```

Coverage: Elo math, Dixon-Coles grid, predictor, briefing template, calibration, player impact, sentiment scoring, accountability settlement.

---

## Architecture Decisions

See [`docs/adr/`](docs/adr/) for full ADR log.

| ADR | Decision |
|-----|---------|
| [0001](docs/adr/0001-task1-model-variant.md) | Platt-calibrated model; Brier < 0.51 + ECE < 3% gate |
| [0002](docs/adr/0002-player-clustering.md) | k-means++ (k=4, seed=20260618) on 5-feature WC26 player stats |
| [0003](docs/adr/0003-sentiment-transformers-swap.md) | @huggingface/transformers over @xenova/transformers |
| [0004](docs/adr/0004-sentiment-config.md) | Sentiment model ID, 5-min bucket, 10-min shift window |
| [0005](docs/adr/0005-model-versioning.md) | Champion–Challenger governance; model registry in data/model-registry.json |

---

## Deployment

See [DEPLOYMENT.md](DEPLOYMENT.md) for full instructions.

Vercel auto-deploys on push to `main`. Preview deployments for all PRs.

See [ARCHITECTURE.md](ARCHITECTURE.md) for system design and data flow.

---

## License

MIT
