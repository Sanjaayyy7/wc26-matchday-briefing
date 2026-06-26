# Codex Premium Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Push the shipped Codex reskin to ultra-premium — OpenAI-Sans-matched typography unified across all pages, a richer bookend gradient on a pitch-black canvas, and a premium Reliability+histogram audit replacing the cheap calibration scatter.

**Architecture:** Four workstreams on PR #41 (`feat/codex-reskin`). Pure CSS token edits (type + gradient), one new TDD'd pure analysis module + one SSR SVG component, and a focused `app/page.tsx` relayout. No new runtime deps.

**Tech Stack:** Next.js 16, React 19, Tailwind v4 (`@utility`/CSS-var tokens in `globals.css`), Inter Variable, SSR SVG (no chart lib), Vitest, `scripts/design-inspector.mts`.

## Global Constraints

- **No new dependencies** (`AGENTS.md`: non-standard Next.js; read `node_modules/next/dist/docs/` before Next APIs).
- **Background stays `#000000`** — `--canvas`/`--void` unchanged; only gradient *bands* get richer.
- **Dark-only.** No `next-themes`, no toggle.
- **Font = Inter, tuned to OpenAI Sans metrics** — do NOT add a font dep.
- **Honesty content is load-bearing:** model BREACH shown; calibration verdicts/callouts **data-derived, never hardcoded**; static NumberTicker (no count-up); canonical rank-based verdict; SSR diagram (no Plotly); `selectUpcomingLocks` future-only.
- **Commits:** NO `Co-Authored-By` trailer. Never `git add -A` — add explicit paths. PR body ends with the Claude Code line.
- **DATA SAFETY:** never run `ml:fetch` / `matchday` / `pipeline:polymarket` / `fetch-*` (they wipe seeded data). Branch shows n=41.
- **Gates (run ALL, from `app/`) before each commit:** `npx vitest run` · `npm run lint` (0 errors; ~12 pre-existing warnings OK) · `npm run design:inspect` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`.
- **Tailwind v4 dev gotcha:** after editing `@utility`/tokens, `pkill -f "next dev"` + `rm -rf .next/dev` + restart, or dev serves stale CSS. Prod build always correct.

---

### Task 1: Typography token retune (OpenAI Sans DNA)

**Files:**
- Modify: `app/globals.css` (the `@utility text-*` blocks, ~lines 302–358)

**Interfaces:**
- Produces: retuned `text-hero/display/title/body/label/caption/micro` utilities consumed by every page.

- [ ] **Step 1: Edit the type utilities** to the measured metrics. Replace the existing `text-hero`, `text-display`, `text-title`, `text-body`, `text-label`, `text-caption`, `text-micro` blocks with:

```css
@utility text-hero {
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 6vw, 6.5rem); /* S1 — size unchanged */
  font-weight: 500;            /* OpenAI Sans display = medium */
  letter-spacing: -0.03em;     /* signature tight display tracking */
  line-height: 1.02;
}
@utility text-display {
  font-family: var(--font-display);
  font-size: clamp(1.875rem, 3.4vw, 3.5rem);
  font-weight: 500;
  letter-spacing: -0.028em;
  line-height: 1.08;
}
@utility text-title {
  font-family: var(--font-display);
  font-size: clamp(1.125rem, 1.4vw, 1.375rem);
  font-weight: 500;
  letter-spacing: -0.01em;
  line-height: 1.3;
}
@utility text-body {
  font-size: 0.9375rem;
  font-weight: 400;
  line-height: 1.6;
  letter-spacing: -0.01em;
  color: var(--ink-muted);
}
@utility text-label {
  font-size: 0.75rem;
  font-weight: 500;
  letter-spacing: -0.006em;
  color: var(--ink-muted);
}
@utility text-caption {
  font-size: 0.75rem;
  font-weight: 400;
  letter-spacing: -0.006em;
  color: var(--ink-muted);
}
```

For `text-micro` (uppercase eyebrows keep positive tracking) change only the weight:

```css
@utility text-micro {
  font-size: 0.625rem; /* 10 */
  font-weight: 500;
  letter-spacing: 0.04em;
}
```

- [ ] **Step 2: Restart dev clean** (Tailwind v4 gotcha):

Run: `pkill -f "next dev" 2>/dev/null; rm -rf .next/dev`
(Restart `npm run dev` only if doing live visual QA now; otherwise rely on build.)

- [ ] **Step 3: Build + inspector gate**

Run: `npm run build && npm run design:inspect`
Expected: build compiles 200/200 static pages; `Design inspector passed.`

- [ ] **Step 4: Commit**

```bash
git add app/globals.css
git commit -m "style(type): retune type scale to OpenAI Sans metrics (w500, tight tracking)"
```

---

### Task 2: Unify raw font-sizes + add inspector guard

**Files:**
- Modify: `scripts/design-inspector.mts` (add a rule)
- Modify: `tests/design-inspector.test.ts` (add a case)
- Modify: page/feature files that use raw font-sizes (discovered in Step 2 — priority: `app/**/page.tsx`, `components/command/*`, `components/cinematic.tsx`, `components/landing/tournament-hero.tsx`)

**Interfaces:**
- Consumes: `text-*` tokens from Task 1.
- Produces: a `no-raw-font-size` design rule that fails on raw font-size utilities in `app/**/page.tsx`.

- [ ] **Step 1: Write the failing inspector test.** In `tests/design-inspector.test.ts`, add:

```ts
it("flags raw font-size utilities on route pages", () => {
  const v = inspectProject(/* uses real project root */);
  // After cleanup this must be empty; the rule must exist and be wired.
  const offenders = v.filter((x) => x.rule === "no-raw-font-size");
  expect(offenders).toHaveLength(0);
});
```

(If the existing test imports a fixture root, match that pattern; the assertion is "zero `no-raw-font-size` violations remain.")

- [ ] **Step 2: Add the rule to `scripts/design-inspector.mts`.** Near the other regexes (after `RADIUS_TOKEN_RE`, ~line 39) add:

```ts
// Raw font-size on route pages → drift. Pages must use the text-* tokens.
const RAW_FONT_SIZE_RE =
  /\btext-(?:xs|sm|base|lg|xl|2xl|3xl|4xl|5xl|6xl|7xl)\b|\btext-\[clamp\(/;
```

Inside the `if (PAGE_RE.test(rel) && !PAGE_SHELL_EXEMPT.has(rel))` block (after the `radius-token` push, ~line 214) add:

```ts
pushMatches(
  violations,
  rel,
  text,
  RAW_FONT_SIZE_RE,
  "no-raw-font-size",
  "Route pages must use the text-* tokens (text-hero/display/title/body/label/caption), not raw font-size utilities.",
);
```

- [ ] **Step 3: Run the inspector to list every offender**

Run: `npm run design:inspect`
Expected: FAIL — prints each `app/**/page.tsx:line [no-raw-font-size]`. This is the worklist.

- [ ] **Step 4: Fix each flagged page** by mapping raw sizes to tokens:
  - `text-5xl/6xl/7xl` or `text-[clamp(...)]` hero copy → `text-hero`
  - `text-3xl/4xl` section titles → `text-display`
  - `text-lg/xl/2xl` subheads/leads → `text-title`
  - `text-base/sm` paragraphs → `text-body`
  - `text-xs` labels/captions → `text-label` or `text-caption`
  - Drop now-redundant `font-bold`/`tracking-tight`/`leading-*` that the token already sets.

  Also fold `components/cinematic.tsx` `SignalStat` (`text-[clamp(1.625rem,2.4vw,2.25rem)] font-bold ...`) to `text-display` (or `text-title` if too large), and clean `components/command/*` + `components/landing/tournament-hero.tsx` the same way. (Feature components aren't gated by the page rule but must be unified for the cross-page goal.)

- [ ] **Step 5: Inspector + full build green**

Run: `npm run design:inspect && npm run build && npx vitest run`
Expected: `Design inspector passed.`; build 200/200; vitest all pass (incl. the new inspector test).

- [ ] **Step 6: Commit**

```bash
git add scripts/design-inspector.mts tests/design-inspector.test.ts app components
git commit -m "style(type): unify pages on text-* tokens + guard against raw font-size drift"
```

---

### Task 3: Richer bookend gradient (pitch-black canvas unchanged)

**Files:**
- Modify: `app/globals.css` — `.dark` `--gradient-hero` (~190), `--gradient-cta` (~193), and the `hero-glow` utility (~500)

**Interfaces:**
- Produces: richer `--gradient-hero`/`--gradient-cta` consumed by `GradientBand`.

- [ ] **Step 1: Replace the gradient tokens in `.dark`** with richer multi-stop values that terminate in true `#000`:

```css
  --gradient-hero:
    linear-gradient(115deg, transparent 38%, rgba(120,150,255,.20) 50%, transparent 60%),
    radial-gradient(120% 95% at 50% -12%, rgba(120,140,255,.42) 0%, transparent 46%),
    radial-gradient(85% 75% at 22% 10%, rgba(91,83,255,.55) 0%, transparent 52%),
    linear-gradient(150deg, #3a2db0 0%, #241c7a 22%, #130f42 48%, #05050f 74%, #000 100%);
  --gradient-cta:
    linear-gradient(115deg, transparent 30%, rgba(130,160,255,.22) 50%, transparent 66%),
    linear-gradient(100deg, #05050f 0%, #241c7a 28%, #4b3ff0 62%, #7c7bff 100%);
```

- [ ] **Step 2: Refine `hero-glow`** for a cleaner top bloom (slightly stronger, still masked):

```css
@utility hero-glow {
  background: radial-gradient(
    ellipse 78% 58% at 50% 0%,
    color-mix(in oklab, var(--accent) 16%, transparent),
    transparent
  );
  mask-image: radial-gradient(ellipse 78% 58% at 50% 0%, black 28%, transparent 72%);
}
```

- [ ] **Step 3: Restart dev clean + build**

Run: `pkill -f "next dev" 2>/dev/null; rm -rf .next/dev; npm run build`
Expected: build compiles; gradient tokens present in `.next/static/chunks/*.css`.

- [ ] **Step 4: Visual confirm** (deferred to Task 7 QA, or quick check now if dev running). Hero band reads richer violet + a faint electric-blue diagonal streak, mid stays pitch black.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "style(gradient): richer hero/cta bookend, cleaner falloff to true black"
```

---

### Task 4: `lib/reliability-audit.ts` — pure analysis (TDD)

**Files:**
- Create: `lib/reliability-audit.ts`
- Test: `tests/reliability-audit.test.ts`

**Interfaces:**
- Consumes: `CalibrationBin` from `lib/accountability` (`{ midpoint, predicted, observed, n }`).
- Produces:
  - `type ReliabilityBin = { predicted: number; observed: number; n: number; gap: number; direction: "over" | "under" | "on" }`
  - `type ReliabilityAnalysis = { bins: ReliabilityBin[]; ece: number | null; callouts: string[]; hasData: boolean }`
  - `function analyzeReliability(bins: CalibrationBin[]): ReliabilityAnalysis`

- [ ] **Step 1: Write the failing tests** in `tests/reliability-audit.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { analyzeReliability } from "@/lib/reliability-audit";
import type { CalibrationBin } from "@/lib/accountability";

const bin = (predicted: number, observed: number, n: number): CalibrationBin => ({
  midpoint: predicted, predicted, observed, n,
});

describe("analyzeReliability", () => {
  it("returns no-data for fewer than 2 usable bins", () => {
    expect(analyzeReliability([]).hasData).toBe(false);
    expect(analyzeReliability([bin(0.5, 0.5, 3)]).hasData).toBe(false);
    expect(analyzeReliability([]).ece).toBeNull();
    expect(analyzeReliability([]).callouts).toEqual([]);
  });

  it("classifies overconfident bins (observed below predicted)", () => {
    const a = analyzeReliability([bin(0.2, 0.25, 10), bin(0.8, 0.55, 10)]);
    expect(a.hasData).toBe(true);
    const hi = a.bins.find((b) => b.predicted === 0.8)!;
    expect(hi.direction).toBe("over");
    expect(hi.gap).toBeCloseTo(-0.25, 5);
  });

  it("classifies underconfident and on-diagonal bins", () => {
    const a = analyzeReliability([bin(0.3, 0.45, 10), bin(0.6, 0.61, 10)]);
    expect(a.bins.find((b) => b.predicted === 0.3)!.direction).toBe("under");
    expect(a.bins.find((b) => b.predicted === 0.6)!.direction).toBe("on");
  });

  it("computes sample-weighted ECE", () => {
    // gaps |.05|,|.25| with n 30,10 → (30*.05 + 10*.25)/40 = .1
    const a = analyzeReliability([bin(0.2, 0.25, 30), bin(0.8, 0.55, 10)]);
    expect(a.ece).toBeCloseTo(0.1, 5);
  });

  it("emits data-derived callouts (ECE + best-calibrated + overconfidence)", () => {
    const a = analyzeReliability([bin(0.2, 0.22, 20), bin(0.8, 0.55, 20)]);
    expect(a.callouts.some((c) => /ECE .* vs 3\.0% target/.test(c))).toBe(true);
    expect(a.callouts.some((c) => /Best calibrated/.test(c))).toBe(true);
    expect(a.callouts.some((c) => /overconfident/i.test(c))).toBe(true);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npx vitest run tests/reliability-audit.test.ts`
Expected: FAIL — `analyzeReliability` not found.

- [ ] **Step 3: Implement `lib/reliability-audit.ts`:**

```ts
import type { CalibrationBin } from "./accountability";

export type ReliabilityBin = {
  predicted: number; // 0..1 mean predicted probability
  observed: number;  // 0..1 observed outcome frequency
  n: number;
  gap: number;       // observed - predicted (signed)
  direction: "over" | "under" | "on";
};

export type ReliabilityAnalysis = {
  bins: ReliabilityBin[];
  ece: number | null;   // sample-weighted mean |gap|, 0..1
  callouts: string[];   // data-derived plain-English lines
  hasData: boolean;     // >= 2 usable bins
};

const ON_THRESHOLD = 0.05; // within 5 pts of the diagonal reads as "on"
const pct = (v: number): number => Math.round(v * 100);

function buildCallouts(bins: ReliabilityBin[], ece: number | null): string[] {
  const out: string[] = [];
  if (ece !== null) out.push(`ECE ${(ece * 100).toFixed(1)}% vs 3.0% target`);

  const over = bins.filter((b) => b.direction === "over");
  if (over.length) {
    const worst = over.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    out.push(
      `Around ${pct(worst.predicted)}% confidence the model is overconfident by ${Math.round(Math.abs(worst.gap) * 100)} pts`,
    );
  }
  const under = bins.filter((b) => b.direction === "under");
  if (under.length) {
    const worstU = under.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    out.push(
      `Around ${pct(worstU.predicted)}% the model is underconfident by ${Math.round(Math.abs(worstU.gap) * 100)} pts`,
    );
  }
  const best = bins.reduce((a, b) => (Math.abs(b.gap) < Math.abs(a.gap) ? b : a));
  out.push(`Best calibrated around the ${pct(best.predicted)}% band`);
  return out;
}

export function analyzeReliability(bins: CalibrationBin[]): ReliabilityAnalysis {
  const usable = bins
    .filter((b) => b.n > 0)
    .sort((a, b) => a.predicted - b.predicted);
  if (usable.length < 2) {
    return { bins: [], ece: null, callouts: [], hasData: false };
  }
  const rbins: ReliabilityBin[] = usable.map((b) => {
    const gap = b.observed - b.predicted;
    const direction = Math.abs(gap) < ON_THRESHOLD ? "on" : gap < 0 ? "over" : "under";
    return { predicted: b.predicted, observed: b.observed, n: b.n, gap, direction };
  });
  const totalN = rbins.reduce((s, b) => s + b.n, 0);
  const ece = totalN > 0 ? rbins.reduce((s, b) => s + (b.n / totalN) * Math.abs(b.gap), 0) : null;
  return { bins: rbins, ece, callouts: buildCallouts(rbins, ece), hasData: true };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npx vitest run tests/reliability-audit.test.ts`
Expected: PASS (5 tests).

- [ ] **Step 5: Commit**

```bash
git add lib/reliability-audit.ts tests/reliability-audit.test.ts
git commit -m "feat(reliability): data-derived calibration analysis (gaps, ECE, callouts)"
```

---

### Task 5: `components/reliability-audit.tsx` — premium SSR audit

**Files:**
- Create: `components/reliability-audit.tsx`

**Interfaces:**
- Consumes: `analyzeReliability` + `ReliabilityBin` from Task 4; `CalibrationBin` type.
- Produces: `function ReliabilityAudit({ bins, graded }: { bins: CalibrationBin[]; graded: number }): JSX.Element`

- [ ] **Step 1: Implement the component** (SSR SVG, tokens-only, no raw hex, `tabular` numerics):

```tsx
import type { CalibrationBin } from "@/lib/accountability";
import { analyzeReliability, type ReliabilityBin } from "@/lib/reliability-audit";

// SSR reliability audit: predicted (x) vs observed (y). The model curve vs the
// perfect-calibration diagonal; the area between them is the miscalibration we
// publish, shaded by direction. A sample-count histogram shares the x-axis.
const W = 460;
const H = 360;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PLOT_H = 248;            // reliability plot height
const HIST_H = 56;            // histogram height
const GAP = 16;              // gap between plot and histogram
const SPAN_X = W - PAD_L - PAD_R;
const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

const x = (p: number) => PAD_L + p * SPAN_X;
const y = (p: number) => PAD_T + PLOT_H - p * PLOT_H;
const histTop = PAD_T + PLOT_H + GAP;

function gapColor(d: ReliabilityBin["direction"]): string {
  if (d === "on") return "var(--up)";
  if (d === "over") return "var(--down)";
  return "var(--warn)";
}

export function ReliabilityAudit({ bins, graded }: { bins: CalibrationBin[]; graded: number }) {
  const a = analyzeReliability(bins);
  if (!a.hasData) {
    return (
      <p className="text-fine text-[var(--ink-faint)] py-8 text-center">
        Reliability audit appears once ≥2 probability bins have settled matches.
      </p>
    );
  }
  const pts = a.bins;
  const maxN = Math.max(...pts.map((b) => b.n), 1);
  const curve = pts.map((b) => `${x(b.predicted).toFixed(1)},${y(b.observed).toFixed(1)}`).join(" ");

  // Closed band between the model curve and the diagonal = the published gap.
  const band =
    pts.map((b) => `${x(b.predicted).toFixed(1)},${y(b.observed).toFixed(1)}`).join(" ") +
    " " +
    [...pts].reverse().map((b) => `${x(b.predicted).toFixed(1)},${y(b.predicted).toFixed(1)}`).join(" ");

  const eceStr = a.ece !== null ? `${(a.ece * 100).toFixed(1)}%` : "—";

  return (
    <figure className="flex flex-col gap-5">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" role="img"
        aria-label="Reliability audit: predicted probability versus observed outcome frequency, with sample-count histogram">
        {/* gridlines + ticks */}
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={y(0)} x2={x(t)} y2={y(1)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.5} />
            <line x1={x(0)} y1={y(t)} x2={x(1)} y2={y(t)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.5} />
            <text x={x(t)} y={histTop + HIST_H + 16} textAnchor="middle" fontSize={10} fill="var(--ink-faint)" className="data-mono">{Math.round(t * 100)}</text>
            <text x={x(0) - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-faint)" className="data-mono">{Math.round(t * 100)}</text>
          </g>
        ))}

        {/* published miscalibration band (curve ↔ diagonal) */}
        <polygon points={band} fill="var(--down)" fillOpacity={0.12} />

        {/* perfect-calibration diagonal */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 4" />

        {/* model reliability curve */}
        <polyline points={curve} fill="none" stroke="var(--ink)" strokeWidth={1.75} />

        {/* bin nodes sized by n, coloured by direction */}
        {pts.map((b, i) => (
          <circle key={`pt-${i}`} cx={x(b.predicted)} cy={y(b.observed)}
            r={3 + Math.sqrt(b.n) * 1.4} fill={gapColor(b.direction)} fillOpacity={0.9}
            stroke="var(--canvas)" strokeWidth={1} />
        ))}

        {/* axis labels */}
        <text x={x(0.5)} y={H - 2} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">Predicted probability</text>
        <text x={12} y={y(0.5)} textAnchor="middle" fontSize={11} fill="var(--ink-faint)" transform={`rotate(-90 12 ${y(0.5)})`}>Observed frequency</text>

        {/* sample-count histogram (shared x-axis) */}
        <line x1={x(0)} y1={histTop + HIST_H} x2={x(1)} y2={histTop + HIST_H} stroke="var(--line)" strokeWidth={1} />
        {pts.map((b, i) => {
          const bw = Math.max(6, (SPAN_X / pts.length) * 0.6);
          const bh = (b.n / maxN) * HIST_H;
          return (
            <rect key={`bar-${i}`} x={x(b.predicted) - bw / 2} y={histTop + HIST_H - bh}
              width={bw} height={bh} fill="var(--ink-muted)" fillOpacity={0.55} />
          );
        })}
        <text x={x(0) - 8} y={histTop + 8} textAnchor="end" fontSize={9} fill="var(--ink-faint)" className="data-mono">n</text>
      </svg>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fine text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />calibrated</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--down)" }} />overconfident</span>
        <span className="flex items-center gap-1.5"><span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />underconfident</span>
        <span>· bubble = sample count</span>
      </div>

      {/* data-derived plain-English callouts */}
      <ul className="flex flex-col gap-1.5 border-t border-[var(--hairline)] pt-4">
        {a.callouts.map((c, i) => (
          <li key={i} className="text-caption flex items-start gap-2 text-[var(--ink-muted)]">
            <span aria-hidden className="mt-1 inline-block h-1 w-3 shrink-0" style={{ background: "var(--accent)" }} />
            <span className="tabular">{c}</span>
          </li>
        ))}
      </ul>

      <figcaption className="text-fine text-[var(--ink-faint)] tabular">
        {graded} graded · ECE {eceStr} vs 3.0% target
      </figcaption>
    </figure>
  );
}
```

- [ ] **Step 2: Inspector + build gate** (catches raw hex / tabular / arbitrary-size violations in the new file)

Run: `npm run design:inspect && npm run build`
Expected: `Design inspector passed.`; build compiles.

- [ ] **Step 3: Commit**

```bash
git add components/reliability-audit.tsx
git commit -m "feat(reliability): premium SSR reliability+histogram audit component"
```

---

### Task 6: Relayout `app/page.tsx` "The Reckoning" (audit + rail, one section)

**Files:**
- Modify: `app/page.tsx`
- Check/Modify: `components/calibration-diagram.tsx` (delete only if now unreferenced) + `tests/` for it

**Interfaces:**
- Consumes: `ReliabilityAudit` (Task 5).

- [ ] **Step 1: Swap the import.** In `app/page.tsx`, replace `import { CalibrationDiagram } from "@/components/calibration-diagram";` with `import { ReliabilityAudit } from "@/components/reliability-audit";`.

- [ ] **Step 2: Remove the standalone "Calibration · the model, audited" `CanvasSection`** (currently ~lines 284–302) — its content moves into The Reckoning.

- [ ] **Step 3: Rebuild "The Reckoning" grid** (the `<CanvasSection eyebrow="Live ledger" title="The Reckoning">` block). Put the framed audit as the left column and keep the Model-health + Championship rail on the right; move Intelligence briefing / Recent settlements / Next locks BELOW the grid. Replace the section's inner markup with:

```tsx
<CanvasSection eyebrow="Live ledger" title="The Reckoning">
  <div className="flex flex-col gap-16">
    {/* ── AUDIT + RAIL (Image #7) ── */}
    <div className="grid animate-rise gap-12 lg:grid-cols-[2fr_320px]">
      <div className="flex flex-col gap-4">
        <p className="text-caption max-w-md text-[var(--ink-muted)]">
          On the diagonal = calibrated. Off it = miscalibrated. We publish the gap.
        </p>
        <ShowcaseFrame>
          <div className="p-6 md:p-8">
            <ReliabilityAudit
              bins={accountability.official.calibrationBins ?? []}
              graded={agg.n}
            />
          </div>
        </ShowcaseFrame>
      </div>

      <aside className="flex flex-col gap-10">
        <RailSection title="Model health">
          <RailMetric label="Status" value={status} accent={statusColor} />
          <RailMetric label="Brier" value={brierStr} />
          <RailMetric label="Baseline" value="0.667" />
          <RailMetric label="RPS" value={rpsStr} />
          <RailMetric label="ECE" value={eceStr} />
          <RailMetric label="Accuracy" value={accuracyStr} />
        </RailSection>

        <RailSection title="Championship probability">
          <div className="flex flex-col gap-3.5">
            {champions.map((c) => (
              <Link key={c.name} href={`/team/${c.id}`} className="group block">
                <div className="flex items-baseline justify-between gap-2">
                  <span className="text-caption truncate text-[var(--ink)] transition-colors duration-300 group-hover:text-[var(--up)]">
                    {c.name}
                  </span>
                  <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
                    {`${c.pct.toFixed(1)}%`}
                  </span>
                </div>
                <span className="mt-1.5 block h-1.5 w-full overflow-hidden bg-[var(--hairline)]">
                  <span className="block h-full" style={{ width: `${(c.pct / topChampionPct) * 100}%`, background: "var(--up)" }} />
                </span>
              </Link>
            ))}
          </div>
        </RailSection>

        <RailSection title="Forecast record">
          <RailMetric label="Settled" value={String(agg.n)} />
          <RailMetric label="Correct" value={String(correct)} accent="var(--up)" />
          <RailMetric label="Open locks" value={String(openLocks)} accent="var(--warn)" />
          <RailMetric label="Hits" value={String(hits)} accent="var(--up)" />
          <RailMetric label="Close" value={String(gradeCounts.CLOSE)} />
          <RailMetric label="Misses" value={String(misses)} accent="var(--down)" />
        </RailSection>
      </aside>
    </div>

    {/* ── BRIEFING + FEEDS (below the audit) ── */}
    <div className="grid gap-12 lg:grid-cols-[2fr_320px]">
      <div className="flex flex-col gap-16">
        {/* keep the existing Intelligence briefing 2×2 block here */}
        {/* keep the existing Recent settlements block here */}
        {/* keep the existing Next locks block here */}
      </div>
    </div>
  </div>
</CanvasSection>
```

Move the existing Intelligence-briefing, Recent-settlements, and Next-locks blocks verbatim into the marked spot (they currently live in the old main column). Keep `ShowcaseFrame` + `Reveal` imports.

- [ ] **Step 4: Handle the orphaned diagram.**

Run: `grep -rn "calibration-diagram" app components tests`
If `components/calibration-diagram.tsx` is no longer imported anywhere, delete it AND its component test (keep `lib/calibration-diagram.ts` — still used for geometry math elsewhere if referenced; re-grep to confirm). If a test references the deleted component, remove that test.

```bash
# only if grep shows no remaining importers of the component:
git rm components/calibration-diagram.tsx
```

- [ ] **Step 5: All gates green**

Run: `npm run design:inspect && npx vitest run && npm run lint && npm run inspect:execution && npm run model:inspect && npm run build`
Expected: inspector passes; vitest all pass; lint 0 errors; execution + model inspectors pass; build 200/200.

- [ ] **Step 6: Commit**

```bash
git add app/page.tsx components tests
git commit -m "feat(home): The Reckoning = reliability audit + rail in one section (Image #7)"
```

---

### Task 7: Visual QA + ship

**Files:** none (verification + integration)

- [ ] **Step 1: Clean dev restart**

Run: `pkill -f "next dev" 2>/dev/null; rm -rf .next/dev; npm run dev` (background)

- [ ] **Step 2: Playwright HOST MCP QA.** If "browser already in use": `pkill -f "mcp-chrome-<id>"` + `rm -f <profile>/Singleton*` (automation chrome, safe). Capture:
  - home @1440 — full page (gradient richer, type tighter)
  - home @390 — mobile (no layout break; audit + rail stack)
  - the reliability audit close-up (curve + shaded gap + histogram + callouts render; BREACH/ECE honest)
  - `/command` @1440 — typography unified (no drift vs home)

  Screenshots land in `/Users/sanjaym/Desktop/KALSHI/README/*.png` — review, then delete them.

- [ ] **Step 3: Fix any visual issues** found (token/gradient/spacing), re-run the full gate set, commit with a `fix(...)` message.

- [ ] **Step 4: Final full gate sweep**

Run: `npx vitest run && npm run lint && npm run design:inspect && npm run inspect:execution && npm run model:inspect && npm run build`
Expected: all green.

- [ ] **Step 5: Ship (user-gated).** Retarget PR #41 base → `main`, close #40, merge:

```bash
git push
gh pr edit 41 --base main
gh pr close 40 --comment "Superseded by #41 (Codex reskin + premium pass)."
# merge after green checks / user go-ahead:
gh pr merge 41 --squash --delete-branch
```

Confirm prod deploy (Vercel auto-deploys `main`).

---

## Self-Review

**Spec coverage:** WS1 typography → Tasks 1+2; WS2 gradient → Task 3; WS3 reliability audit → Tasks 4+5+6; WS4 ship → Task 7. Inspector guard (spec 1c) → Task 2. Data-derived callouts (spec invariant) → Task 4 `buildCallouts`. Image-#7 layout (spec 3c) → Task 6. All covered.

**Placeholder scan:** No TBD/TODO. The only "keep the existing block here" markers in Task 6 Step 3 are explicit move instructions for named, already-existing blocks — not unwritten code.

**Type consistency:** `analyzeReliability(CalibrationBin[]) → ReliabilityAnalysis{ bins, ece, callouts, hasData }`; `ReliabilityBin{ predicted, observed, n, gap, direction }`; `ReliabilityAudit({ bins, graded })`. Names identical across Tasks 4→5→6. `CalibrationBin` matches `lib/accountability.ts` (`midpoint, predicted, observed, n`).
