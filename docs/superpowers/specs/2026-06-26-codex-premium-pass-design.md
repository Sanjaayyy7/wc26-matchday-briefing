# Codex Premium Pass — Design Spec

**Date:** 2026-06-26
**Branch:** `feat/codex-reskin` (PR #41, stacked on `feat/linear-redesign`)
**Supersedes look of:** the just-shipped Codex reskin (same branch) — this is a richness/quality pass on top, not a new aesthetic.

## Goal

Push the shipped Codex reskin from "correct" to "ultra-premium," in four workstreams, all on PR #41:

1. **Typography** — retune the type scale to the *measured* OpenAI Sans DNA and unify it across **every** page (incl. `/command`), so nothing drifts.
2. **Gradient** — make the bookend gradient richer/more cinematic while the background stays **pitch black (`#000000`)**.
3. **The Reckoning** — replace the cheap calibration bubble-scatter with a premium, purposeful **Reliability + histogram audit**.
4. **Ship** — retarget #41 → `main`, close #40, merge (prod auto-deploys).

Honesty-first content invariants are preserved throughout (see Invariants).

## Source of truth (sampled live, 2026-06-26)

Measured from `chatgpt.com/codex` via Playwright `getComputedStyle`:

- Font family: **`"OpenAI Sans"`** (proprietary — no public CDN, not licensable to ship). We keep **Inter** (already loaded, no new dep — `AGENTS.md` warns against deps) and tune it to OpenAI Sans's metrics. ~95% visual match; glyph shapes differ slightly. This is the agreed, realistic "identical feel."
- **Tracking is the signature:** display (≥40px) ≈ **−0.028 to −0.030em**; mid/body ≈ **−0.010em**.
- **Weight = 500 (medium)** on hero + all section heads (not light, not bold).
- **Leading:** ~1.0 single-line display, ~1.15 wrapping heads.

## Workstream 1 — Typography

### 1a. Retune tokens in `app/globals.css`

| token | current | target |
|---|---|---|
| `text-hero` | w520 / −0.012em / lh 1.05 | **w500 / −0.030em / lh 1.02** |
| `text-display` | w460 / −0.014em / lh 1.06 | **w500 / −0.028em / lh 1.08** |
| `text-title` | w590 / −0.012em / lh 1.3 | **w500 / −0.010em / lh 1.3** |
| `text-body` | w400 / 0em / lh 1.65 | **w400 / −0.010em / lh 1.6** |
| `text-label` | w500 / +0.01em | **w500 / −0.006em** |
| `text-caption` | w400 | **w400 / −0.006em** |
| `text-micro` (eyebrow) | w400 / +0.04em | keep tracking (uppercase eyebrows stay positive); confirm weight 500 |

Nav links + CTA pills + buttons: ensure **−0.010em**.

### 1b. Kill raw font-size drift (unify)

42 raw `text-{xl..7xl}` / `text-[clamp(...)]` / `font-bold` usages exist across ~24 files. Replace those on **pages and feature components** with the `text-*` tokens. Priority: all `app/**/page.tsx` + `components/command/*` (forecast-record, command-shell, model-evolution, forecast-drivers, match-detail, score-probability-surface) + `components/cinematic.tsx` `SignalStat` (currently `text-[clamp(...)] font-bold tracking-tight` → fold to a token).

**Out of scope:** shadcn primitives (`components/ui/{button,card,dialog,input,toggle}.tsx`) — library defaults, leave alone.

### 1c. Guard

Extend `scripts/design-inspector.mts`: flag raw font-size utilities (`text-3xl`, `text-[clamp`, etc.) appearing in `app/**/page.tsx`. Add the matching case to `tests/design-inspector.test.ts`.

## Workstream 2 — Gradient

Edit **only** the gradient tokens in `.dark` (`app/globals.css`):

- `--gradient-hero`: deeper violet core, a brighter **electric-blue diagonal light-streak** (matches the Codex hero), smoother multi-stop falloff terminating at **true `#000`** (no muddy indigo middle).
- `--gradient-cta`: richer, more luminous electric-blue close.
- `hero-glow` utility: minor refinement for a cleaner top bloom.

**Unchanged:** `--canvas`/`--void` = `#000000`; all mid-sections stay pitch black. No structural/layout change.

## Workstream 3 — The Reckoning (Reliability + histogram audit)

### 3a. New pure helper — `lib/reliability-audit.ts` (TDD first)

From `CalibrationBin[]`, compute (all **data-derived**, never hardcoded):
- per-bin `{ predicted, observed, n, gap = observed − predicted, direction: "over" | "under" | "on" }`
- `ece`, `worstOverconfidentBand`, `bestCalibratedBand`
- plain-English callout strings derived from the above (e.g. "Above 60% the model is overconfident", "Best calibrated in the 25–45% band", "ECE 10.2% vs 3.0% target").

Tests in `tests/reliability-audit.test.ts`: empty/insufficient bins, over- vs under-confident classification, callout text, ECE math. Reuse existing `lib/calibration-diagram.ts` math where it already exists.

### 3b. New SSR component — `components/reliability-audit.tsx`

Server-rendered SVG (no chart lib, like the current diagram):
- **Top panel — reliability curve:** perfect-calibration diagonal (dashed); model's binned curve as a polyline through bin nodes (sized by `n`); the **area between curve and diagonal filled** with a semantic gradient — red wash where overconfident (curve below diagonal), cool/neutral wash where underconfident. Refined axes/gridlines, 0–100 both axes, mono tick labels.
- **Bottom panel — sample-count histogram:** bars per bin aligned to the same x-axis.
- **Callout list:** the data-derived plain-English lines + `ECE x% vs 3.0% target · N graded`.
- Semantic colors via tokens (`--up`/`--down`/`--warn`); honors `prefers-reduced-motion`.
- Replaces `components/calibration-diagram.tsx` usage. Keep the old file only if still referenced elsewhere; otherwise delete (note orphans, don't delete pre-existing dead code beyond our own).

### 3c. Relayout `app/page.tsx` "The Reckoning" (Image #7)

- Fold the separate "Calibration · the model, audited" showcase **into** `The Reckoning`.
- Grid: **left (2fr)** = the framed `ReliabilityAudit` (inside `ShowcaseFrame`); **right (320px)** = existing Model-health + Championship rail (Forecast record can stay in the rail or move below).
- Below the grid: Intelligence briefing / Recent settlements / Next locks (unchanged content).
- One calibration moment, not two.

## Workstream 4 — Ship

- All commits on `feat/codex-reskin`.
- Each commit: all 6 gates green — `npx vitest run` · `npm run lint` (0 errors) · `node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`.
- Visual QA (Playwright HOST MCP, after `rm -rf .next/dev` + dev restart): home @1440, home @390 (mobile), reliability-audit close-up, `/command` @1440 (typography unified).
- Finish: retarget PR #41 → `main`, close #40, merge.

## Invariants (carry through unchanged)

- Model **BREACH** shown on purpose; calibration verdicts **data-derived**, never hardcoded.
- **Static** NumberTicker (no count-up). Canonical rank-based verdict. SSR diagram (no Plotly).
- `selectUpcomingLocks` future-only filter. Green/red data semantics preserved in the new viz.
- **No `Co-Authored-By` trailer** on commits. PR body ends with the Claude Code line.
- **DATA SAFETY:** never run `ml:fetch` / `matchday` / `pipeline:polymarket` (they wipe seeded `results.csv`). Branch shows n=41 data.
- Tailwind v4 dev gotcha: after new `@utility`/token edits, `pkill next dev` + `rm -rf .next/dev` + restart or CSS serves stale. Prod build always correct.

## Out of scope

- Mobile hamburger nav (known gap, deferred).
- Merging PR #39 (data n=51).
- Phase-3 model work.
- Light theme (dark-only).
