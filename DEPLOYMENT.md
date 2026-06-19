# Deployment

## Vercel (Production)

This app deploys to Vercel with zero configuration. Next.js is auto-detected.

### Environment Variables

**No environment variables are required at runtime.** The trained model ships as `data/model.json`.

The `PROMPT_FILE` variable in `.env.local` is used only by the local scripting tool `scripts/run-briefing.mts`, not by the Next.js web app. Do not set it in Vercel.

### First Deploy

```bash
npm install -g vercel
cd /path/to/app
vercel login
vercel --prod
```

### Continuous Deployment via GitHub

1. Push the repository to GitHub (public or private).
2. Go to [vercel.com](https://vercel.com) → **New Project** → Import your GitHub repo.
3. Accept all defaults — Next.js is auto-detected; no env vars needed.
4. Every push to `main` triggers a production deploy.
5. Every pull request gets an isolated preview URL.

### Build Health Check

Before deploying, always verify:

```bash
npm run build    # must complete with 0 TypeScript errors
npm test         # must pass all 130 tests
```

Never deploy with a failing build or failing tests.

---

## Updating Tournament Data

After each matchday, run the settlement pipeline and push:

```bash
# 1. Refresh match results from source dataset
npm run ml:fetch

# 2. Patch fixtures.json with actual scores for completed WC26 matches
npx tsx scripts/fetch-match-results.mts

# 3. Settle locked predictions against actual results
npm run pipeline:settle

# 4. Rebuild accountability metrics (Brier, RPS, ECE, calibration)
npm run report:accountability

# 5. Commit and push — Vercel auto-deploys
git add data/fixtures.json data/predictions.json data/backtest/wc26-accountability.json
git commit -m "data(settlement): settle matchday results"
git push origin main
```

---

## Runtime Environment

- **Node.js:** 20 (Vercel default for Next.js 16)
- **No native binaries at runtime:** `@huggingface/transformers` and `onnxruntime-node` are used only by offline scripts (`scripts/score-sentiment.mts`). They are listed in `serverExternalPackages` in `next.config.ts` to prevent bundling errors — they are never imported by Next.js API routes.
- **Static generation:** 199 pages are pre-rendered at build time. No database or external API calls during page rendering.
- **API routes:** `/api/preview` and `/api/follow-up` are dynamic (Node.js runtime) but call only local pure-JS functions — no outbound network at request time.

---

## Vercel Project Settings

| Setting | Value |
|---------|-------|
| Framework | Next.js (auto-detected) |
| Build Command | `npm run build` |
| Install Command | `npm install` |
| Output Directory | `.next` |
| Node.js Version | 20.x |
| Environment Variables | None required |

---

## Monitoring

After each deployment:

1. Check [/record](/record) — confirm `n` matches shows correctly settled entries.
2. Verify build in Vercel dashboard shows **Ready** status.
3. Spot-check a fixture page (`/fixture/<slug>`) loads with predictions.
4. Confirm `/simulator` loads Monte Carlo odds table.

If Brier or ECE on `/record` looks wrong after settlement, check that `data/backtest/wc26-accountability.json` was rebuilt and committed before pushing.
