# Design: Linear-grade UI redesign + tournament data refresh

**Date:** 2026-06-25
**Status:** Approved (design); pending plan
**Branch:** `feat/linear-redesign` (redesign + docs); `data/*` (data refresh, separate PR)

## Mission

Two missions, sequenced data-first:

1. **Data refresh (A):** Settle the latest WC26 results (Jun 23→ FT-confirmed) and re-grade
   the model's locked predictions, so the live site reflects the real tournament.
2. **Linear redesign (B):** Re-skin the platform to be visually on par, 1:1, with
   [linear.app](https://linear.app) — across the nav routes — while merging Home + Record
   into one unified Ledger and fixing the `/matches` readability problem (onefootball-style
   date navigation).

Phase 3 modelling (fatigue/rest + goal-form) is explicitly **deferred** — superseded by this
mission per user decision (2026-06-25).

### Scope

- **In:** the 6 nav routes after merge — `/` (Ledger, absorbs Record), `/matches`, `/command`,
  `/teams`, `/simulator`, `/methodology`; the shared shell/header; the design token system;
  the `design-inspector` guardrail; data settlement of played fixtures.
- **Inherit-only:** non-nav secondary routes (`/groups`, `/players`, `/sentiment`, `/fixture/*`,
  `/team/*`) get the new tokens + shell automatically but no bespoke redesign this pass.
- **Out:** Phase 3 model work; live-market refetch; any change to locked predictions.
- **Optional (A2):** enrich `/teams` with real FIFA tournament team-stats. Flagged, not committed.

## Hard constraints (do NOT violate)

- **DATA SAFETY.** `data/raw/results.csv` is gitignored + hand-seeded. NEVER run `ml:fetch` /
  `matchday` / `pipeline:polymarket` — they re-download and WIPE the seed. Safe settlement path
  only: edit `results.csv` rows (fill `NA` scores) → `npx tsx scripts/fetch-match-results.mts`
  → `pipeline:settle` → `report:accountability`. Never fabricate; unstarted/in-progress matches
  stay locked.
- **Preserved honesty-first content (survives the reskin — these are correctness, not aesthetics):**
  model **BREACH is shown on purpose**; calibration verdict stays **data-derived** (never
  hardcoded optimistic); `NumberTicker` stays **static** (SSR/no-JS correctness); canonical
  `official.verdict` is the single verdict source across pages; `selectUpcomingLocks` (future
  kickoffs only) drives "Next locks".
- **Deliberate override:** this mission retires the prior *anti-glass / no-rounded-box /
  content-on-the-void* aesthetic constitution by explicit user instruction. The
  `design-inspector` is rewritten to enforce the NEW system, not the old one.
- **Next.js 16 is not the Next you know.** Read `node_modules/next/dist/docs/` before writing
  framework code; heed deprecations.
- **design-inspector gotcha:** it scans `lib/` and its old `shadow-` regex false-positives on
  the literal substring `shadow-<word>` in comments. The rewrite must avoid reintroducing that
  trap.

## Reference: Linear tokens (extracted live, 2026-06-25)

Measured from linear.app via headless browser `getComputedStyle`:

| Role | Linear (dark) | Notes |
|---|---|---|
| Canvas | `#08090a` | near-black, faint cool |
| Surface (card) | `#0f1011` | one hair lighter than canvas |
| Card border | `rgba(255,255,255,0.05)` | barely-there |
| Header border | `rgba(255,255,255,0.08)` | |
| Ink (primary) | `#f7f8f8` | |
| Muted text | `#8a8f98` | secondary/body |
| Accent (brand) | `#5e6ad2` indigo; link `#6d78d5`; bright `#8fa6ff` | used sparingly |
| Radius | **8px** cards; pill (9999px) buttons | |
| Shadow | none on inline cards | elevation = bg delta + border, not shadow |
| Font | Inter Variable | |
| h1 | 64px / weight **510** / ls −0.022em / lh 1.0 | medium, NOT 700+ |
| h2 | 40px / 510 / −0.022em / lh 1.1 | |
| h3 | 20px / 590 / −0.012em / lh 1.33 | |
| body p | 15px / 400 / lh 1.6 / muted | |
| Header | fixed · `backdrop-filter: blur(20px)` · translucent · hairline | glassy sticky |

**Signature insight:** Linear is restraint, not heavy glass. The look = subtle elevated rounded
surface + medium-weight tight type + ONE indigo accent + a glass header. The four real shifts
from current WC26: (a) introduce a rounded elevated `--surface` card; (b) display weight 800→~510
with tighter tracking; (c) repalette to Linear grays + indigo; (d) glassy sticky header.

## New design constitution (what the rewritten inspector enforces)

**Keep (discipline):** tokens-only — no raw hex in `.tsx/.ts` (only `globals.css`, `data/`,
`lib/kit-color.ts`); no `bg-white|black|gray|slate|zinc` literals; numeric display via
`NumberTicker`/`tabular`; motion = `duration-300` + single ease; no visible background
grids/meshes.

**Newly allowed / required:** the `Surface` card (token bg + hairline + `--radius-card`); the
glass header utility; ONE controlled hero gradient per page (indigo/brand, masked, low-alpha —
never rainbow, never a glow halo); display weights 460–600 via the retuned type utilities.

**Still forbidden:** arbitrary px/rem utilities (use tokens/scale or `clamp()`); ad-hoc
`boxShadow` (only `--shadow-pop` token on hover/overlays); more than one accent hue as decoration
(indigo is THE accent; jade/clay/gold are reserved for data semantics only).

## Token system changes (`globals.css`)

- **Dark theme → Linear palette:** `--canvas #08090a`, `--surface #0f1011`, `--ink #f7f8f8`,
  `--ink-muted #8a8f98`, `--hairline rgba(255,255,255,.06)`, `--line rgba(255,255,255,.09)`.
- **Accent:** add `--accent #5e6ad2`, `--accent-bright #8fa6ff`. `--tint` for primary buttons
  becomes ink (Linear's primary button is light); indigo is the link/active/focus accent.
- **Data semantics unchanged:** `--up` jade, `--down` clay, `--warn` gold, verdict ramp — charts
  keep meaning. Stage ramp unchanged.
- **Light theme:** retune to Linear's light editorial (`#fbfbfb` canvas, white surface, ink
  `#0f1011`, indigo accent). Toggle kept; default dark.
- **New tokens:** `--radius-card: 0.5rem` (8px), `--radius-pill: 9999px`, `--blur-glass: 20px`,
  `--surface` (real, not transparent), `--shadow-pop` (soft, overlays only).
- **Type utilities retuned:** `text-hero/display/title` → Inter Variable, weights 510–590,
  ls −0.022em, lighter line-heights. `text-body/label/caption` ~unchanged.
- **Font:** display switches from Archivo → Inter Variable (matches Linear). Keep JetBrains Mono
  for `data-mono`/tabular. Configure via `next/font` weight axis.

## Primitives (`components/`)

- `Surface` — Linear card. `bg-[--surface] border border-[--hairline] rounded-[--radius-card]`,
  optional `interactive` hover (hairline→line, faint bg). Replaces the bare `DataPlane` boxes on
  route pages where a contained card reads better; `DataPlane`/`CanvasSection` rhythm retained.
- `GlassHeader` — fixed/sticky, `backdrop-blur-[--blur-glass]`, translucent canvas, hairline
  bottom border. Wraps the existing nav + status rail (BREACH/ECE kept — honesty signal).
- `Hero` — medium-weight tight display headline + one masked indigo gradient wash.
- `DateNav` (new, for `/matches`) — onefootball-style segmented date bar: `Yesterday · Today ·
  Tomorrow` + scrollable date chips + "jump to today"; keyboard-operable (arrow keys, roving
  tabindex), `aria-selected` on active day.

## Page designs

### `/` — The Ledger (Home ⊕ Record, unified)

Home absorbs Record into one authoritative track-record surface. Sections (RouteStack rhythm):

1. **Hero** — `correct/n correct picks` (static NumberTicker) + Brier/accuracy strip + masked
   indigo gradient; "Next · locked" chip (upcoming-locks). Medium-weight display.
2. **Today's slate** (when present) — locked pre-kickoff reads.
3. **Calibration — the model, audited** — the SSR-SVG `CalibrationDiagram` (signature; NOT the
   blank-first-paint Plotly client chart) + ECE-vs-target caption + Model-health rail (BREACH
   shown).
4. **Settlement record** — the sortable `SettlementTable` from Record (date/Brier sort), in a
   Surface. The diversified centrepiece — not a dump.
5. **Intelligence briefing** — 2×2 sourced claims (perf / calibration / largest miss / market).
6. **Team breakdown** — per-team forecasting performance (Record's table).
7. **Open calls** + **Caveats** — frozen locks + honest limits.

`/record` → permanent **301 redirect to `/`**; nav drops "Record" (7→6 items). Verdict, metrics,
calibration all read the single `wc26-accountability.json` source (no cross-page divergence).

### `/matches` — Forecasts (readability fix)

- Sticky `DateNav` at top; default selected = **Today**; chips for each matchday; "jump to today".
- Matches **grouped by date** (newest-relevant reachable without infinite scroll), rendered as a
  Surface card grid (crest · matchup · model split / result / verdict). Keeps existing filters
  (stage/group/status) as a secondary control row.
- Settled cards show result + verdict chip; locked cards show the model split + kickoff.

### `/command`, `/teams`, `/simulator`, `/methodology`

Re-skinned to the Linear system within their existing shells (Command keeps its full-screen
terminal shell, exempt from page-shell checks). Tables/cards → Surface; type → new scale; accent
→ indigo. `/teams` optional A2 enrichment (FIFA tournament stats) flagged separately.

## Data workstream (A) detail

1. Enumerate `results.csv` rows dated ≥ 2026-06-23 with `NA` scores.
2. Source FT-confirmed finals via firecrawl **search** (scrape historically blocked),
   cross-checked across onefootball / FIFA / fbref. Resolve home/away orientation against the
   csv row order. Only settle matches confirmed Full-Time; leave in-progress/unstarted as `NA`.
3. Fill scores → `fetch-match-results.mts` → `pipeline:settle` → `report:accountability`.
4. Verify: locked probabilities byte-identical before/after (history immutable); settled `n`
   increases by exactly the number filled; gates green.
5. Optionally refresh champion projections via `ml:simulate` (read-only on results) if safe.

Acceptance: site shows the new graded matches; accountability metrics recompute; no locked
prediction mutated; `forecast-pulse` settled-count test updated to the new n.

## Guardrail rewrite (`scripts/design-inspector.mts`)

Replace the anti-box/anti-elevation rules with Linear-system rules:

- **Keep:** tokens-only (raw hex), no `bg-(white|black|gray|slate|zinc)`, tabular/NumberTicker for
  numerics, motion `duration-300`, no background-line meshes, page-shell (`WCS26Shell`+`RouteStack`
  +`CanvasSection`), section-label headings.
- **Replace:** drop `ROUTE_BOX_RE`/`no-box-layout` (rounded Surfaces now allowed); drop the
  blanket `shadow-` ban → allow `--shadow-pop`; allow `rounded-[--radius-card|--radius-pill]`.
- **Add:** forbid raw `rounded-2xl/3xl/4xl` on routes (enforce the 8px `--radius-card` token);
  forbid >1 decorative accent hue; require the glass header utility on the shell; fix the
  `shadow-<word>`-in-comments false-positive (anchor the regex to class attributes).
- Inspector must end **green** across all migrated routes in the same PR (it gates every route at
  once — the redesign therefore lands as one cohesive PR, not a half-migrated app).

## QA: visual-diff harness + a11y

- **Visual-diff harness (new, `scripts/visual-diff.mts` or test):** headless-browser screenshots
  of each route at a fixed viewport (1440×900 + mobile 390×844), saved to an artifacts dir, plus
  reference captures of analogous linear.app surfaces. Reviewed in a tight loop: build → screenshot
  → compare against Linear → revise until the gap is not spottable. Bar = the user's "pixel-1:1".
- **A11y acceptance (testable):** muted text meets WCAG AA contrast on `--canvas`
  (`#8a8f98` on `#08090a` ≈ 5.0:1 ✓); all interactive elements keyboard-reachable with visible
  `:focus-visible`; `DateNav` arrow-key operable + `aria-selected`; `prefers-reduced-motion`
  honored (already wired); semantic landmarks (`<header>`/`<nav>`/`<main>`); no information by
  color alone (verdict chips carry text).

## PR decomposition + gates

- **PR-A — data refresh** (`data/settle-jun-results` off main): settlement + re-grade only; small,
  ships first, independently reviewable.
- **PR-B — Linear redesign** (`feat/linear-redesign`): tokens + guardrail rewrite + primitives +
  all 6 routes + Ledger merge + matches DateNav. One cohesive PR (the inspector gates all routes
  at once). Built via subagent-driven TDD, decomposed into sequential tasks in the plan.

Gates before every commit (run from `app/`): `npx vitest run` · `npm run lint` (0 errors) ·
`node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run
model:inspect` · `npm run build`. Workflow: each change its own branch + PR; never `git add -A`;
no `Co-Authored-By` (project setting).

## Success criteria

- Site reflects the latest FT-confirmed results, model re-graded, no locked prediction altered.
- All 6 nav routes render the Linear system; rewritten `design-inspector` green.
- Home+Record are one unified Ledger; `/record` 301s to `/`; nav = 6 items.
- `/matches` opens on Today with onefootball-style date navigation; no infinite-scroll-to-find.
- Visual-diff loop: no spottable gap vs linear.app on the priority surfaces.
- A11y acceptance criteria met. All gates green. Honesty-first content intact.

## Open decisions (default unless user says otherwise)

- Display font Archivo→Inter Variable (recommended, matches Linear). Default: switch.
- A2 FIFA team-stats enrichment on `/teams`: default **deferred** unless requested.
- Champion-sim refresh via `ml:simulate`: default **yes if confirmed read-only**.
