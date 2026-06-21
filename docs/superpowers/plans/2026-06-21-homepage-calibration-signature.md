# Homepage Signature Artifact — Calibration Reliability Diagram

**Branch:** `feat/homepage-calibration-signature`
**Goal (P1):** Make `/` iconic in 10s. Add one SSR-first signature artifact that renders the product's identity — an *audited forecaster* — by visualizing predicted-vs-observed calibration honestly (including the BREACH).

## Why this artifact
- **Identity:** a reliability diagram IS the signature of a calibrated-forecasting operation.
- **Trust:** shows the model's miscalibration tangibly (dots off the diagonal), reinforcing honesty-first.
- **Premium + SSR-first:** crafted inline SVG, house tokens, no Plotly (the `CalibrationChart` is `ssr:false` → blank first paint; rejected for the hero).
- **Reuse:** consumes existing `accountability.official.calibrationBins`.

## Task 1 — Pure geometry (TDD)
**Files:** `lib/calibration-diagram.ts` + `tests/calibration-diagram.test.ts`.
- `calibrationPoint(bin, {size, pad, rMin?, rMax?, k?})` → `{cx, cy, r}`: maps `predicted`→x, `observed`→y (inverted), `n`→radius (sqrt scale, clamped). Clamp predicted/observed to [0,1].
- Tests: (0,0)→bottom-left `(pad, size-pad)`; (1,1)→top-right `(size-pad, pad)`; (0.5,0.5)→center; radius scales with n and clamps to `rMax`; out-of-range predicted clamps to plot edge.

## Task 2 — Component (SSR, no client)
**File:** `components/calibration-diagram.tsx` (server component, pure SVG).
- Props: `bins: CalibrationBin[]`, `caption?: string`.
- Renders: square SVG; perfect-calibration diagonal (hairline); a dot per bin via `calibrationPoint`, colored by deviation (|predicted−observed|): small=`--up`, large=`--down`, mid=`--warn`; axis labels "Predicted" (x) / "Observed" (y). Empty/`<2` bins → graceful text.
- House tokens only; no raw hex, no arbitrary px in a page file (component file — inspector allows component styling, but keep tokens). `data-mono`/`tabular` on any numeric caption.

## Task 3 — Place on homepage
**File:** `app/page.tsx`.
- Add the diagram as a hero band in the main column of the "Forecast performance" CanvasSection, beside/above the PrimaryMetric. Caption: `Calibration · {n} graded · ECE {x}% ({status})` — all from existing vars (single-source).
- Must not regress: HomeGrid 2fr+320px, static NumberTicker, single-source numbers.

## Gates
build · vitest · `design-inspector` · eslint · `inspect:execution`. Live prerender check that the SVG renders (SSR). One PR.
