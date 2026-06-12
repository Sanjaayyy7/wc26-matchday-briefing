# Matchday Briefing

A local Next.js 16 app that turns a trained statistical model into kitchen-table briefings for FIFA World Cup 2026 fixtures — probability split, scoreline heatmap, BTTS read, and a follow-up Q&A, all computed locally. **No API keys, no LLM calls, zero marginal cost.**

## How predictions work

- **Ratings:** World Football Elo (eloratings.net method — tournament-weighted K, goal-margin multiplier, home advantage) computed over ~49k internationals (1872 → present) from the [martj42 international results dataset](https://github.com/martj42/international_results).
- **Goals:** expected goals per side from the Elo gap (binned Poisson-rate regression), scored as a Dixon-Coles-corrected double Poisson grid.
- **Honesty gate:** training runs an online backtest (2024+, ratings never see the future). Current model: Brier **0.509** vs 0.667 uniform over 2,546 matches. Training aborts if the model stops beating baseline.
- **Prose:** briefing text is template-generated from model outputs only — no invented injuries, lineups, or tactics; the model says so itself in "Things I'm not sure about".

## Setup

```bash
npm install
npm run dev          # model.json ships in the repo — this just works
```

Refresh data + retrain (e.g. after each matchday):

```bash
npm run ml:fetch     # pull latest results.csv (no auth)
npm run ml:train     # retrain → data/model.json, prints backtest gate
```

## Tests

```bash
npm test             # 106 tests: Elo math, DC grid, predictor, templates vs parsers, calibration math
```

## Market calibration (Kalshi)

```bash
npm run pipeline:fetch -- brazil-vs-morocco       # live 3-way book → de-vigged snapshot
npm run pipeline:run -- brazil-vs-morocco         # model briefing → pipeline-output/
npm run pipeline:calibrate -- brazil-vs-morocco   # model vs market deviation row
npm run pipeline:calibrate -- brazil-vs-morocco 2-1   # after FT: Brier for model AND market
```

The standing benchmark: match or beat the market's Brier score in `pipeline-output/calibration-log.md`.

## Layout

- `data/model.json` — trained artifact (ratings, fit params, backtest report)
- `data/{clubs,fixtures}.json` — WC26 teams + opening fixtures (provenance: `data/README.md`)
- `lib/` — `elo.ts`, `poisson-model.ts`, `predict.ts`, `briefing-template.ts`, parsers, heatmap math
- `scripts/` — dataset fetch, training, Kalshi fetch, briefing runner, calibration scorer
- `app/api/{preview,follow-up}` — deterministic prediction endpoints
- `../wc-analyst-*.md`, `../pl-analyst-*.md` — the prompt-era documents; the Output Contract they define is still the format contract the templates and parsers share

## History

Originally an LLM app (Anthropic streaming + the WC26 analyst prompt one directory up). Pivoted to pure ML 2026-06-12 — see `../audit-ledger.md` and git history. The Output Contract survived the pivot: same parsers, same UI, different brain.
