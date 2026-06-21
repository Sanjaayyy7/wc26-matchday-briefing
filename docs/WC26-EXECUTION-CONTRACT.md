# WC26 Execution Contract

The operating role for **every** execution in this repo. Enforced by
`scripts/execution-inspector.mts` (`npm run inspect:execution`) and surfaced each
session by the SessionStart hook in `.claude/settings.json`. Sibling to
`design-inspector.mts`: that guards *design*, this guards *workflow*.

> The product is a forecasting **organization** disguised as software. Its only
> moat is trust. Every execution must protect that. Truth over narrative;
> evidence over intuition; improvement over ego.

## 1. Mandated skill workflow (the "IMPORTANT FOLLOW strictly" role)

Never execute ad hoc. Route work through, in order:

1. `superpowers:using-superpowers` — skill-check before any action.
2. `superpowers:brainstorming` — before ANY new feature/UI/behavior (HARD-GATE: no implementation before an approved design).
3. `superpowers:writing-plans` → `superpowers:executing-plans` — written plan, then execute with review checkpoints.
4. `superpowers:test-driven-development` — for any pure logic (precedent: `lib/settlement-sort.ts`, `lib/upcoming-locks.ts`).
5. `superpowers:systematic-debugging` — for any bug/unexpected behavior, before proposing fixes.
6. `superpowers:verification-before-completion` — evidence before any "done" claim.
7. `superpowers:finishing-a-development-branch` — branch → PR.

Default working skills (use unless clearly N/A): repo-scan, codebase-onboarding,
deep-research, product-lens, frontend-design, design-system, nextjs-turbopack,
verification-loop, browser-qa, code-review, security-review.

## 2. Quality gates — ALL must pass before every commit (run from `app/`)

```
npm run build
npx vitest run
node --import tsx scripts/design-inspector.mts
npx eslint <changed files>
```

## 3. Git discipline

- **Never implement on `main`/`master`.** One feature branch + one PR per logical change.
- **Never `git add -A`.** Stage explicit paths. (Root cause of a prior `AGENTS.md`/`CLAUDE.md` deletion.)
- Commit messages: conventional prefix; end with the Co-Authored-By trailer.
- PR-mode for data/automation — human-in-the-loop, never auto-push to prod.

## 4. Data-safety rules (hard)

- **Never run `npm run matchday` / `ml:fetch` to "refresh" results.** It re-downloads `results.csv` from the live mirror, which has no future-dated WC26 results, and would **wipe the seeded scores + un-settle the ledger.** To settle: edit `data/raw/results.csv` (or fixtures) with *sourced* finals → `fetch-match-results` → `pipeline:settle` → `report:accountability`.
- **Never fabricate match results, metrics, or scores.** Only settle confirmed full-time scores cross-checked across credible sources (ESPN/FOX/CBS/FIFA/Yahoo). In-progress / not-started matches stay LOCKED.
- **Predictions are immutable.** Settlement only *adds* result/grade fields; never edits a locked probability.
- **Single source of truth.** Every displayed number must derive from `data/backtest/wc26-accountability.json` / `data/predictions.json` / `data/learning-signals.json`. No hardcoded metric narrative in components.

## 5. Do-not-reverse decisions

- **NumberTicker is static** — count-up rendered SSR `0` (SEO/credibility harm). Don't re-add animation.
- **Matchday automation is PR-mode** — opens a reviewable data PR. Don't switch to auto-push.
- **Model BREACH is shown on purpose** — honest small-sample admission, not a bug to hide.
- **Calibration Model-Evolution verdict is data-derived** (`buildEvolutionLog`) — never re-hardcode an optimistic "within the gate / holding" message.
- **External review findings (Perplexity etc.) must be verified against live code/curl before acting** — they have produced false positives (phantom /simulator 404, "Record failed", SSR-zero "data mismatch").

## 6. Verification

Claims of "done/fixed/passing" require shown command output or a live/prerender check.
Prefer concrete evidence (prerendered HTML, curl, test output) over assertion.
