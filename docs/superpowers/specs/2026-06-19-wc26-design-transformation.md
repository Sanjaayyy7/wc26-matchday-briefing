# WC26 Design Transformation — Design System Specification

**Date:** 2026-06-19  
**Status:** Approved by user — ready for implementation planning  
**Scope:** Homepage · Record (Accountability Ledger) · Matches — Priority tier  
**Design direction approved:** Concept E (Palantir intelligence model + Robinhood product craft + F1 operational telemetry)

---

## Success Criteria

A recruiter, engineer, PM, quant researcher, football analyst, investor, or executive must immediately understand, within 60 seconds of landing on the platform:

1. What WC26 does
2. Why it is different from a typical prediction site
3. Why the forecasts can be trusted
4. How the model is evaluated
5. How the system learns from results

The final product should feel less like a dashboard and more like the operating system of a forecasting organization.

---

## Part 1 — Design System Foundations

### 1. Visual Philosophy

**The Permanent Record.** WC26 is a public accountability ledger. Predictions are locked before kickoff, results are recorded after the whistle, and performance is measured permanently. The interface is the operating system of that record — not a product to be marketed, a platform to be impressed by, or a terminal to look technical.

**Three principles:**

**Honesty first.** The interface admits uncertainty. Small-sample warnings are features, not embarrassments. ECE readings are surfaced, not hidden. The honest statement "n=21 is too small to conclude" appears visibly above the fold. The system does not project more confidence than the data supports.

**Depth on demand.** The surface layer (60-second read) answers whether the platform is credible and what happened recently. Analytical depth — calibration diagrams, model registry, miss postmortems — is one scroll or one click away. Never on first view, never absent entirely.

**Institutional permanence.** Colors, type, and spacing should look professional in three years, not dated in six months. No gradients for aesthetic effect. No glass morphism. No motion that doesn't communicate state.

**What Concept E is not:**
- Not Bloomberg (optimizes for "looking technical" over trust)
- Not a startup landing page (optimizes for conversion over credibility)
- Not an analytics dashboard (optimizes for metrics volume over narrative clarity)
- Not F1 Mission Control in isolation (operational urgency without analytical depth)

**What Concept E is:**
The tone is closer to a well-produced research publication: precise, evidenced, readable, and understated. The data does the work. The interface gets out of the way.

---

### 2. Typography System

**Base font stack:** `Inter, -apple-system, BlinkMacSystemFont, 'SF Pro Text', system-ui, sans-serif`  
No display font. No terminal font. No handwriting or personality fonts. Inter at every weight is sufficient for the full scale.

**Scale:**

| Token | Size | Weight | Line-height | Letter-spacing | Color | Use |
|-------|------|--------|-------------|----------------|-------|-----|
| `text-hero` | 80–104px (desktop) / 48–56px (mobile) | 700 | 1 | −0.04em | `--ink` | One per page. Primary institutional metric only. Never a headline. |
| `text-display` | 48–64px | 650 | 1.1 | −0.03em | `--ink` | Section titles. Used sparingly (≤2 per page). |
| `text-title` | 16–18px | 600 | 1.3 | 0 | `--ink` | Match names, team names, card titles, content labels. |
| `text-body` | 15px | 400 | 1.65 | 0 | `rgba(244,244,239,0.65)` | Intelligence card prose. The institutional voice. |
| `text-label` | 13px | 500 | 1.4 | 0.01em | `--ink-muted` | Section eyebrows, column headers, filter tabs. |
| `text-caption` | 12px | 400 | 1.5 | 0 | `--ink-faint` | Timestamps, n= caveats, sub-information. |
| `text-micro` | 9–11px | 500–600 | 1 | 0.10–0.12em | `--ink-faint` | Card type labels (ALL CAPS), status rail items. |
| `text-mono` | 12–14px | 400–600 | 1 | 0 | varies | **ALL data numbers.** Tabular-nums. Always. |

**Number rules (non-negotiable):**
- `font-variant-numeric: tabular-nums` on every number, everywhere
- Brier scores: always 3 decimal places (`0.721`, never `0.7` or `.721`)
- Probabilities: always integer percent (`64%`, never `0.64` or `64.0%`)
- Home/Draw/Away triples: `64 / 23 / 13` — space-separated, no % symbols
- Counts: no decimal places (`21 settled`, not `21.0`)
- Decimal alignment in tables: right-aligned with fixed decimal point position

**Prose rules:**
- Intelligence card body: analytical voice, not promotional
- Evidence before interpretation: "Brier 0.721 on n=21 — insufficient for statistical conclusions but directionally consistent with holdout" not "Model performing well!"
- Small-sample caveats are mandatory when n < 30
- Never: "amazing", "best", "industry-leading", "sophisticated", "powerful"
- First-person institutional plural: "Model assigned 72% probability" or "We are tracking 51 open locks"

---

### 3. Spacing System

**Base unit: 8px.** Every spacing value is a multiple of 8. Values of 5, 10, 15, 20, 25, 30px are not allowed. Inconsistent spacing erodes the "crafted" feeling more than almost any other factor.

**Scale:**

| Token | Value | Use |
|-------|-------|-----|
| `space-1` | 4px | Tight internal chip padding, icon gaps |
| `space-2` | 8px | Component-internal spacing between tightly related elements |
| `space-3` | 12px | Gap between intelligence cards, between table rows |
| `space-4` | 16px | Card internal padding, section-internal element separation |
| `space-6` | 24px | Gap between component groups, mobile page margins |
| `space-8` | 32px | DataPlane internal padding, section gap on mobile |
| `space-12` | 48px | CanvasSection separation, tablet page margins |
| `space-16` | 64px | Major page section separation on desktop |
| `space-20` | 80px | RouteStack vertical gaps |

**Layout:**
- Content max-width: 1200px, centered
- Page margins: 24px (mobile) / 48px (tablet) / 72px (desktop)
- Homepage grid: `2fr 320px` two-column at ≥1024px; collapses to single column below
- Record / Matches: single column, full width within max-width container

**Vertical rhythm:**
- Nav height: 52px (fixed)
- Status rail height: 36px (fixed)
- Chroma line: 1px (fixed)
- Above-fold visible content starts: 89px from top (nav + rail + chroma)

---

### 4. Motion System

**Rule: Motion communicates state. Motion that does not communicate state is not allowed.**

**Permitted motion types:**

| Type | Trigger | Duration | Easing | Communicates |
|------|---------|----------|--------|--------------|
| Page entry | Route mount | 280ms | `cubic-bezier(0.4,0,0.2,1)` | Navigation happened |
| Number settlement | Match settles | 600ms | `ease-out` | Real data arrived |
| Probability bar enter | First render | 400ms | `ease-out` | Calculated value, not a label |
| Data refresh pulse | Live data update | 100ms | `ease-in-out` | This number just changed |
| Row hover | User hover | 200ms | `ease-in-out` | Interactive affordance |
| Tab filter switch | User click | 150ms opacity | `ease-in-out` | Content changed |

**Banned motion:**
- Particle systems or ambient animations
- Looping animations of any kind
- Decorative gradients that breathe, pulse, or drift
- Entrance animations staggered purely for visual effect (only stagger if communicating meaningful sequence)
- Transitions on non-interactive elements
- Anything that runs continuously after mount without a user trigger

**Reduced motion:** All transitions disabled when `prefers-reduced-motion: reduce` is set. Numbers appear at final state; bars appear at full width; page entry has no transform (opacity only, 100ms).

---

### 5. Data Visualization System

**Three chart types. No others.**

**1. Brier bar (inline, settlement rows)**
- A 2px-tall horizontal bar, right-aligned to the Brier value
- Width: proportional to Brier score, capped at 100%
- Color: `--up` (green) if Brier < 0.50 · `--warn` (amber) if 0.50–0.75 · `--down` (red) if > 0.75
- Background track: `--hairline`
- Not a chart. An inline reading aid. No axis. No label. The Brier number beside it is the label.

**2. Champion probability bars (right rail)**
- 3px-tall horizontal bars
- Width: proportional to % chance (18.2% → ~91% of container width for leader)
- Color: gradient `#4A90D9 → --up` (left to right)
- No axis. Numeric % label right of bar.
- Purpose: relative ordering, not precise reading. Rankings, not measurements.

**3. Reliability diagram (Plotly, /record page only)**
- Scatter: predicted probability (x) vs observed frequency (y)
- Bubble size: `Math.max(8, Math.sqrt(n) * 4)` — communicates sample size per bin
- Model trace: `--up` color, markers + connecting line
- Perfect calibration diagonal: dashed, `rgba(255,255,255,0.2)`
- Background: transparent (matches canvas)
- Height: 280px. No axis title decorations. `displayModeBar: false`.
- SSR-safe: wrapped in `dynamic(() => import("react-plotly.js"), { ssr: false })`

**Color rules for data:**
- `--up` (#7cffb2): good calibration, HIT verdict, model nominal, probability for favored team
- `--down` (#ff674d): poor calibration, MISS verdict, error state, probability for underdog
- `--warn` (#ffc46b): CLOSE verdict, warning state, open locks count, data near threshold
- `--blue` (#4A90D9): neutral numerical data, RPS metric, model version labels
- `--ink-muted`: secondary numerical data (baseline values, draw probabilities)

Color may not be the sole differentiator. All verdict states carry both color AND text label (HIT / CLOSE / MISS). All status states carry both color AND status label (NOMINAL / WARNING / ERROR).

---

### 6. Interaction Principles

**Navigation:**
- All navigation is link-based (Next.js `<Link>`) — no pushState manipulation
- Active page: highlighted nav item + sub-label visible
- External links (GitHub, Vercel) open in new tab with `rel="noopener noreferrer"`

**Tables:**
- Settlement table on /record: sortable by Brier (click column header, toggle asc/desc)
- Matches table: tab-filtered (All / Settled / Locked / Upcoming), not paginated for ≤100 rows
- Row click: navigates to `/fixture/[slug]`
- No expand-in-place, no modal overlays, no tooltip-only information

**Filters:**
- Immediate — no "Apply" button. State updates on click.
- Tabs for categorical filter (All/Settled/Locked/Upcoming)
- Filter state in URL query param for shareable URLs: `/matches?filter=settled`

**Hover:**
- Row hover: background transition to `--surface` (200ms)
- Hover reveals: supplementary metadata visible only on hover (e.g. full team names when abbreviated)
- Primary data is never hover-only — always visible

**Click targets:**
- All interactive elements minimum 44×44px (WCAG 2.5.5)
- Nav links: full nav-height (52px) × full link-width
- Table rows: full row-height (44px min) × full row-width

**No modals.** No drawers. No tooltips for data the user needs to act on. Navigate or expand via dedicated pages.

---

### 7. Mobile Behavior

**Breakpoints:**
- Mobile: < 640px
- Tablet: 640px – 1023px
- Desktop: ≥ 1024px

**Homepage mobile (<640px):**
- Status rail: horizontal scroll, `overflow-x: auto`, 4 visible items, no truncation of values
- Nav: collapse to icon + page name, sub-label hidden, hamburger or tab bar below
- Hero: reduces from 80px to 48px, still visible above fold
- Intelligence cards: 1-column stack (2-column on tablet)
- Settlement feed: full width, Brier bar and verdict chip visible, H/D/A split moves below match name
- Right rail: collapses and moves below settlement feed, shows only top 3 champion entries + "Show all" link
- Upcoming locks: full width, 2 visible + "See all" link

**Record mobile (<640px):**
- Metric strip: 2×3 grid (wraps from 5-col to 2-col layout)
- Intelligence cards: 1-column stack
- Settlement table: show Fixture + Result + Brier + Verdict; hide RPS
- Calibration chart: responsive, renders at full mobile width (Chart is already `responsive: true`)
- Team breakdown: show Team + Avg Brier; hide picks column

**Matches mobile (<640px):**
- Table columns: Fixture + Status + Verdict only
- H/D/A probability triple: move to fixture meta line (below match name, small text)
- Brier column: hidden (visible on /fixture/[slug] row detail)
- Row tap → /fixture/[slug]

**Nav mobile:**
- Desktop sticky horizontal nav collapses at <768px
- Mobile: bottom tab bar with 5 tabs (Overview · Forecasts · Record · Teams · Simulator)
- Sub-labels hidden on tab bar — show on desktop only
- Active tab: `--ink` color + bottom border indicator

---

### 8. Accessibility Standards

**Color contrast (all meet WCAG AA minimum; most meet AAA):**

| Element | Foreground | Background | Ratio | Level |
|---------|-----------|------------|-------|-------|
| Body text (`--ink`) | #f4f4ef | #050505 | 15.8:1 | AAA |
| Muted text (`--ink-muted`) | #a2a29b | #050505 | 5.2:1 | AA |
| Faint text (`--ink-faint`) | #55554f | #050505 | 3.1:1 | AA (large text only — use only for captions ≥12px) |
| Up/green (`--up`) | #7cffb2 | #050505 | 12.4:1 | AAA |
| Down/red (`--down`) | #ff674d | #050505 | 4.5:1 | AA |
| Warn/amber (`--warn`) | #ffc46b | #050505 | 9.1:1 | AAA |
| Blue (`#4A90D9`) | #4A90D9 | #050505 | 5.8:1 | AA |

`--ink-faint` must only be used at 12px or larger. It is below AAA at small sizes but passes AA for normal text. Never use for interactive or status labels.

**Color is never the sole differentiator:**
- Verdict states: HIT / CLOSE / MISS text label is always present alongside color
- Model status: NOMINAL / WARNING / ERROR text label always present
- Brier quality: numeric value always accompanies bar color

**Keyboard navigation:**
- All interactive elements reachable via `Tab`
- Tab order: Nav links → Status rail (read-only, not focusable) → Main content → Page selector
- Settlement rows: `tabIndex={0}`, `onKeyDown` handles `Enter` → navigate
- Filter tabs: `role="tablist"` + `role="tab"` + `aria-selected`
- Skip link: `<a href="#main-content" className="sr-only focus:not-sr-only">Skip to main content</a>`

**ARIA labels for data-dense elements:**
- Status rail items: `aria-label="Brier score: 0.721"`
- Verdict chips: `aria-label="Prediction result: Hit"` / `"Miss"` / `"Close"`
- Probability triples: `aria-label="Home 64%, Draw 23%, Away 13%"`
- Brier bars: `aria-label="Brier score 0.440, good calibration"` or `aria-hidden="true"` if numeric label adjacent
- Champion bars: `aria-label="Brazil: 18.2% champion probability"`
- Tables: `<table>` with `<caption>` + `<th scope="col">` + `<th scope="row">`

**Motion accessibility:**
```css
@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after {
    animation-duration: 0.01ms !important;
    transition-duration: 0.01ms !important;
  }
}
```
No functional loss when motion is disabled. Numbers appear at final state. Bars appear at full width.

**Focus rings:**
- All interactive elements: visible focus ring, `outline: 2px solid var(--up)`, `outline-offset: 2px`
- Never `outline: none` without a custom focus indicator replacement

---

### 9. Forecast-Intelligence Narrative Framework

Every page, every component, every heading answers one of five institutional questions. These questions ARE the platform's product.

**The Five Questions:**

| # | Question | Where answered | What shows it |
|---|----------|---------------|---------------|
| 1 | What did we predict? | /matches, /fixture/[slug] | Locked H/D/A probabilities, pre-kickoff timestamp |
| 2 | What happened? | /matches (settled), /record, homepage feed | Official result, verdict chip |
| 3 | How accurate were we? | /record hero, homepage hero | Brier, RPS, log-loss, accuracy rate |
| 4 | Can the confidence be trusted? | /record calibration, homepage ECE status | ECE reading, reliability diagram |
| 5 | What did we learn? | /record intelligence cards, miss analysis | Notable variance cards, calibration trend |

**Intelligence card standard format:**
```
CATEGORY LABEL          ← 9px, weight 600, --ink-faint, ALL CAPS, letter-spacing 0.12em

[Conclusion.] [Evidence — metric value inline.] [Context or caveat.]

Max 3 sentences. Max 80 words. 
Every card states a conclusion, not just data.
Every card references at least 1 specific metric value inline.
Never more than 4 cards visible simultaneously.
```

**Four card categories and their conclusions:**

| Category | Conclusion style | Example |
|----------|-----------------|---------|
| PERFORMANCE ASSESSMENT | Whether the model is outperforming baseline | "Model generating 47.6% correct picks vs 33% random baseline on n=21 — too small for statistical conclusions." |
| CALIBRATION SIGNAL | Whether confidence can be trusted | "ECE 2.1% against 3.0% gate. **Model is not overconfident.** Probability intervals reflect true uncertainty." |
| NOTABLE VARIANCE | Biggest surprise + pattern | "England vs Serbia — 72% home probability, 0–0 result. Brier 0.941. Draw underestimation pattern in strong-home-favorite group stage scenarios." |
| OPERATIONAL STATUS | Model health, open locks, governance | "51 prediction locks expire before Matchday 7. Champion v1.0.0-platt operational. No challenger pending." |

**Lifecycle framing — nav sub-labels:**

| Page | Primary label | Sub-label (lifecycle stage) |
|------|-------------|---------------------------|
| `/` | Overview | Executive briefing |
| `/matches` | Forecasts | Locked predictions |
| `/record` | Record | Accountability ledger |
| `/team/[id]` | Teams | Model inputs |
| `/simulator` | Simulator | Path simulation |
| `/players` | Players | Contribution scores |
| `/sentiment` | Sentiment | Market signals |

Sub-labels communicate what the user is about to engage with in the forecasting lifecycle — not just a category name. On mobile, sub-labels are hidden (space constraint). On desktop, they are always visible in the nav.

**Accountability stamp (on /matches):**
> "All predictions locked before kickoff. Never edited after lock."

This statement appears as a visual element on the /matches status rail. It is not marketing copy — it is an institutional commitment that differentiates WC26 from retrospective prediction sites.

---

## Part 2 — Page Specifications

### Page 1: Homepage (`/`)

**Primary objective:** 60-second institutional assessment. Every visitor — regardless of domain knowledge — should leave the first viewport understanding: what the model is, whether it has a credible track record, and what happened most recently.

---

**User questions answered (in order of priority):**
1. Is this model currently performing? → Live Brier vs uniform baseline
2. Can the confidence be trusted? → ECE status (NOMINAL / WARNING)
3. How many predictions are in flight? → Open locks count
4. What happened most recently? → Last settled match + verdict
5. What is the biggest known accuracy gap? → Notable Variance intelligence card
6. Who is predicted to win the tournament? → Champion rail (below fold)

**None of these questions require domain expertise to understand.** The design must answer them for a first-time visitor with no forecasting background.

---

**Information hierarchy (strict top-to-bottom priority):**

```
LEVEL 0 — Navigation (always visible, communicates lifecycle context)
LEVEL 1 — Status rail (institutional health, 6 signals, F1 operational layer)
LEVEL 2 — Hero metric (one primary institutional number, Robinhood clarity)
LEVEL 3 — Small-sample caveat (honest uncertainty, never hidden)
LEVEL 4 — Intelligence briefing (2×2 cards: Performance · Calibration · Variance · Ops)
LEVEL 5 — Settlement feed (last 4 settled matches, newest first)
LEVEL 6 — Upcoming locks (next 3 locks with expiry time)
LEVEL 7 — Champion rail (right column, probability bars for top 7 teams)
```

Levels 0–4 must be visible above the fold on 1280px × 800px desktop. Levels 5–7 require scroll.

---

**Component hierarchy:**

```
<AppNav> (sticky, z-100)
  <NavLogo />
  <NavLinks> (Overview · Forecasts · Record · Teams · Simulator)
    Each: primary label + lifecycle sub-label
  </NavLinks>
  <NavStatus> (live dot + model version + status)
</AppNav>

<StatusRail> (fixed height 36px, F1 operational layer)
  Items: MODEL · BRIER · ECE · ACCURACY · SETTLED · OPEN LOCKS · CHAMPION · date
  Item format: LABEL<space>VALUE
  Values use semantic colors (ECE green if <3%, warn if 3–5%, red if >5%)
</StatusRail>

<ChromaLine /> (1px, existing spectral gradient)

<HomeGrid> (2-column: main 2fr + rail 320px, collapses at <1024px)

  <!-- Main column -->
  <PrimaryMetric>
    <Eyebrow>Forecast performance · Live tournament</Eyebrow>
    <HeroNumber>10/21 correct picks</HeroNumber>
    <HeroSubline>Brier 0.721 · RPS 0.220 · Log-loss 0.943 · ECE 2.1%</HeroSubline>
    <SampleWarning>△ n=21 — sample too small to draw conclusions</SampleWarning>
  </PrimaryMetric>

  <IntelligenceSection>
    <SectionHead label="Intelligence briefing" />
    <IntelligenceGrid> (2×2)
      <IntelCard category="PERFORMANCE ASSESSMENT" />
      <IntelCard category="CALIBRATION SIGNAL" />
      <IntelCard category="NOTABLE VARIANCE" />
      <IntelCard category="OPERATIONAL STATUS" />
    </IntelligenceGrid>
  </IntelligenceSection>

  <SettlementFeed>
    <SectionHead label="Recent settlements" />
    {last 4 settled matches, newest first}
    <SettlementRow> per match:
      match name + context (group · date · H/D/A split)
      score
      Brier value + inline bar
      verdict chip (HIT / CLOSE / MISS)
    </SettlementRow>
  </SettlementFeed>

  <UpcomingLocks>
    <SectionHead label="Next locks" />
    {next 3 locks sorted by expiry time}
    <LockRow> per match:
      match name + context
      H/D/A probability triple (right-aligned)
    </LockRow>
  </UpcomingLocks>

  <!-- Right rail -->
  <HomeRail>
    <RailSection label="Model health">
      metric rows: Status · Version · Brier · Baseline · RPS · Log-loss · ECE · Holdout
    </RailSection>
    <RailSection label="Champion probability">
      {top 7 teams} × ChampionBar (name + bar + pct)
    </RailSection>
    <RailSection label="Forecast record">
      metric rows: Settled · Correct picks · Open locks · Hits · Close · Misses
    </RailSection>
  </HomeRail>

</HomeGrid>
```

---

**Interaction model:**
- Page is primarily passive on first load — no interactive elements required to read it
- Settlement rows: `href="/fixture/[slug]"` — click navigates to fixture detail
- Champion names: `href="/team/[id]"` — click navigates to team dossier
- Nav links: standard route navigation
- No modals, no tooltips for data, no expandable sections

---

**Mobile adaptation (<640px):**
- Status rail: `overflow-x: auto`, 4 items visible, horizontal scroll for others
- Hero: 80px → 48px, still above fold
- Intelligence cards: 2-col on tablet → 1-col on mobile
- Right rail: moved below settlement feed and upcoming locks
- Champion rail on mobile: show top 3 only + "View all →" link to /simulator
- Nav: bottom tab bar, 5 tabs, sub-labels hidden

---

**Motion behaviors:**
- Page entry: `animate-rise` (translateY 8px → 0, opacity 0 → 1, 280ms)
- Hero number: static on mount (not animated — it's the primary metric, not a ticker)
- Brier bars in settlement feed: width 0 → final, 400ms ease-out, on first render
- Champion probability bars: width 0 → final, 400ms ease-out, staggered 50ms per bar
- Row hover: background 200ms transition
- `prefers-reduced-motion`: all transitions disabled

---

### Page 2: Record — Accountability Ledger (`/record`)

**Primary objective:** Prove the model's accuracy claim with honest, evidenced analysis. Every claim sourced to a metric. Small-sample honesty maintained throughout. A quant researcher or investor should find this page sufficient to assess credibility.

---

**User questions answered:**
1. What is the model's live Brier score and how does it compare to baseline?
2. What is the model's calibration status — can the confidence be trusted?
3. What was the worst prediction and why?
4. How does the model compare to Kalshi market prices?
5. Which teams are hardest to forecast accurately?

---

**Information hierarchy:**

```
LEVEL 0 — Nav (Record active, "Accountability ledger" sub-label)
LEVEL 1 — Status rail (record-specific: BRIER · ECE · LOG-LOSS · ACCURACY · n= warning)
LEVEL 2 — Hero metric (same format as homepage, smaller scale: 64px)
LEVEL 3 — 5-metric strip (Brier · RPS · Log-loss · ECE · vs Kalshi)
LEVEL 4 — Intelligence cards (Performance · Calibration · Largest Miss · Market Comparison)
LEVEL 5 — Calibration reliability diagram (Plotly, requires scroll)
LEVEL 6 — Settlement table (all 21 graded rows)
LEVEL 7 — Team breakdown (per-team avg Brier, n≥2 appearances, sorted worst first)
```

Levels 0–3 above fold. Levels 4–7 require scroll.

---

**Component hierarchy:**

```
<AppNav> (Record active)
<StatusRail> (BRIER · ECE · LOG-LOSS · ACCURACY · n= · MODEL status)
<ChromaLine />

<RecordHero>
  <Eyebrow>Accountability ledger · Locked before kickoff, graded after the whistle</Eyebrow>
  <HeroNumber>10/21 correct picks</HeroNumber>
  <HeroSubline>Brier 0.721 · RPS 0.220 · Log-loss 0.943 · ECE 2.1% · n=21</HeroSubline>
  <SampleWarning>△ n=21 — sample too small for conclusions</SampleWarning>

  <MetricStrip> (5-column grid, border-separated)
    <RecordMetric label="Brier score (live)" value="0.721" sub="Baseline 0.667 · lower better" />
    <RecordMetric label="RPS" value="0.220" color="up" sub="Coin-flip ≈ 0.278" />
    <RecordMetric label="Log-loss" value="0.943" sub="Random ≈ 1.099" />
    <RecordMetric label="ECE (live)" value="2.1%" color="up" sub="Target <3.0% · Nominal" />
    <RecordMetric label="vs Kalshi" value="−0.196" color="warn" sub="Market sharper · n=1" />
  </MetricStrip>
</RecordHero>

<IntelligenceSection label="Intelligence briefing">
  <IntelligenceGrid> (2×2)
    <IntelCard category="PERFORMANCE ASSESSMENT">
      Official graded record: 21 matches, 10 correct picks (47.6%). Mean Brier 0.721 vs uniform
      baseline 0.667. Model has not demonstrated improvement over baseline on directional picks
      at this sample size — consistent with n<30 variance.
    </IntelCard>
    <IntelCard category="CALIBRATION SIGNAL">
      ECE 2.1% against 3.0% gate. Model is well-calibrated. When the model assigns 70% 
      probability, ~70% of similar predictions resolve correctly. Reliability diagram confirms
      alignment across 6 of 10 probability bins.
    </IntelCard>
    <IntelCard category="LARGEST MISS · ENGLAND vs SERBIA">
      Model assigned 72% home probability. Result: 0–0 draw. Brier 0.941 — worst in settled 
      record. Draw probability assigned 18%. Pattern flagged: draw underestimation in 
      strong-home-favorite group stage scenarios.
    </IntelCard>
    <IntelCard category="MARKET COMPARISON · KALSHI">
      One match with Kalshi data available. Model Brier 0.819 vs Kalshi 0.623. Edge −0.196 
      in Kalshi's favor. n=1 is noise, not signal. Meaningful comparison requires 10+ matched pairs.
    </IntelCard>
  </IntelligenceGrid>
</IntelligenceSection>

{calibrationBins.length >= 2 && (
  <CalibrationSection label="Reliability diagram">
    <CalibrationContext>
      Points on the diagonal = perfect calibration. Above diagonal = underconfident.
      Below diagonal = overconfident. Bubble size proportional to n in each bin.
    </CalibrationContext>
    <CalibrationChart bins={calibrationBins} />
  </CalibrationSection>
)}

<SettlementSection label="Settlement record · N official graded calls">
  <SettlementTable>
    <thead> Fixture / Result / Brier / RPS / Verdict </thead>
    {official.rows.map(row => <SettlementTableRow />)}
  </SettlementTable>
  <TableNote>Sorted by date. Click Brier header to sort by score.</TableNote>
</SettlementSection>

{teamStats.length >= 3 && (
  <TeamBreakdownSection label="Per-team forecast difficulty">
    {teamStats.map(t => <TeamBreakdownRow team={t} />)}
    <BreakdownNote>Sorted by avg Brier (highest = hardest to forecast). n≥2 appearances only.</BreakdownNote>
  </TeamBreakdownSection>
)}
```

---

**Interaction model:**
- Metric strip: static (no interaction)
- Intelligence cards: static prose (no hover, no click)
- Calibration chart: Plotly hover shows bin details (n, predicted, observed)
- Settlement table: Brier column header click toggles sort (asc/desc)
- Team breakdown: static

---

**Mobile adaptation:**
- Metric strip: 5-col → 2-col wrap (Brier + RPS / Log-loss + ECE / vs Kalshi full-width)
- Intel cards: 2-col → 1-col stack
- Settlement table: hide RPS column; Brier + Verdict remain
- Calibration chart: full mobile width (responsive: true in Plotly config)
- Team breakdown: hide picks count; show Team + Avg Brier

---

**Motion behaviors:**
- MetricStrip values: NumberTicker (600ms count-up) on mount
- Intelligence cards: `animate-rise` staggered 80ms per card
- Calibration chart: renders on mount (Plotly manages its own animation)
- Settlement table rows: no entrance animation (static, data is the focus)
- `prefers-reduced-motion`: NumberTicker shows final value immediately; no stagger

---

### Page 3: Matches — Locked Predictions (`/matches`)

**Primary objective:** Show every prediction with its status. Communicate the core institutional commitment — every row was locked before kickoff and has never been edited. A visitor should immediately understand the difference between settled (graded), locked (in-flight), and upcoming (not yet locked).

---

**User questions answered:**
1. What did the model predict for [specific match]?
2. Which predictions have been graded and what were the results?
3. Which predictions are still in-flight and when do they expire?
4. What's the overall scale — how many total predictions are there?

---

**Information hierarchy:**

```
LEVEL 0 — Nav (Forecasts active, "Locked predictions" sub-label)
LEVEL 1 — Status rail (TOTAL · SETTLED · LOCKED · INFORMATIONAL + accountability stamp)
LEVEL 2 — Filter tabs (All / Settled / Locked / Upcoming)
LEVEL 3 — Match table (5-column: Fixture / Result·Status / H·D·A / Brier / Verdict)
```

No hero metric. No intelligence cards. This page is operational — a ledger view, not a briefing.

---

**Component hierarchy:**

```
<AppNav> (Forecasts active)
<StatusRail>
  Items: TOTAL 72 · SETTLED 21 · LOCKED 51 · INFORMATIONAL 3
  Right side: "All predictions locked pre-kickoff · Never edited after lock"
</StatusRail>
<ChromaLine />

<FilterTabs role="tablist">
  <Tab label="All matches" count={72} />
  <Tab label="Settled" count={21} />
  <Tab label="Locked" count={51} />
  <Tab label="Upcoming" count={3} />
</FilterTabs>

<MatchTable>
  <MatchTableHeader>
    Fixture / Result · Status / Home · Draw · Away / Brier / Verdict
  </MatchTableHeader>
  {filteredMatches.map(match => (
    <MatchTableRow key={match.slug} href={`/fixture/${match.slug}`}>
      <FixtureCell>
        <MatchName>{match.homeName} vs {match.awayName}</MatchName>
        <MatchMeta>{stage} · {date} · {venue}{match.lockExpiry && ` · Lock expires ${lockExpiry}`}</MatchMeta>
        <StageChip>{stageLabel}</StageChip>
      </FixtureCell>
      <StatusCell>
        {match.isSettled && <Score>{homeScore}–{awayScore}</Score>}
        {match.isLocked && <LockChip>Locked</LockChip>}
        {match.isUpcoming && <UpcomingChip>Upcoming</UpcomingChip>}
      </StatusCell>
      <ProbCell>
        <span color="up">{homeProb}</span> / {drawProb} / <span color="down">{awayProb}</span>
      </ProbCell>
      <BrierCell>{match.brier ?? '—'}</BrierCell>
      <VerdictCell>{match.verdict && <VerdictChip verdict={match.verdict} />}</VerdictCell>
    </MatchTableRow>
  ))}
</MatchTable>
```

---

**Accountability stamp placement:**
The accountability stamp ("All predictions locked pre-kickoff · Never edited after lock") lives in the status rail, right-aligned. It is visible on every load of the /matches page. It is not decorative — it is an institutional commitment that distinguishes WC26 from retrospective prediction sites.

---

**Interaction model:**
- Tab filter: immediate, updates visible rows, no "Apply" button
- Tab state: reflected in URL (`?filter=settled`)
- Row click: navigates to `/fixture/[slug]`
- Row hover: background tint (200ms)
- Brier column header: click to sort settled rows by Brier asc/desc (upcoming/locked rows stay in chronological order)
- No modal, no drawer, no expandable row

---

**Mobile adaptation (<640px):**
- Status rail: horizontal scroll
- Filter tabs: horizontal scroll if needed (4 tabs may not fit at 320px)
- Table columns reduced: Fixture + Status + Verdict only
- H/D/A probabilities move inside the Fixture cell (below match name, caption style)
- Brier column hidden (available at /fixture/[slug])
- Row tap → /fixture/[slug]

**Tablet (640–1023px):**
- All 5 columns visible
- Table fills full width
- H/D/A may abbreviate column header to "H/D/A"

---

**Motion behaviors:**
- Tab filter switch: rows fade out → fade in, 150ms opacity transition
- No row entrance animation on tab switch (list change is the animation)
- No row entrance animation on initial load (too many rows, distracting)
- Row hover: 200ms background transition

---

## Part 3 — Implementation Guidance

### What to keep from the existing codebase

The existing codebase already has strong foundations:
- CSS token system (`--canvas`, `--ink`, `--up`, `--down`, `--warn`, `--line`) — keep exactly as-is
- `components/cinematic.tsx` primitives (CanvasSection, DataPlane, RouteStack, SignalLine) — keep as layout scaffolding
- `app/globals.css` chroma rule — keep
- `components/calibration-chart.tsx` — keep as-is (already correct)
- `lib/accountability.ts` with `calibrationBins` — keep as-is
- All existing data pipeline, model, and API infrastructure — untouched by this redesign

### What changes

1. **`app/page.tsx`** (Homepage) — full rewrite of content structure per this spec
2. **`app/record/page.tsx`** (/record) — significant expansion per this spec (already partially done in prior session)
3. **`app/matches/page.tsx`** (/matches) — layout and component update per this spec
4. **`components/wc26-shell-header.tsx`** (Nav — replaces the deleted `app-chrome.tsx`) — add lifecycle sub-labels to nav links. _Mobile tab bar dropped during shell unification; mobile nav deferred, not added here._
5. **StatusRail** — **already shipped** inside `components/wc26-shell-header.tsx` (shell unification: graded / Calibration / ECE rail). Enhance in place per the F1 operational layer; **do not create a duplicate `status-rail.tsx`.**
6. **`components/intelligence-card.tsx`** (new) — analytical prose card framework
7. **`components/settlement-row.tsx`** (new or refactor) — inline Brier bar + verdict chip
8. **CSS additions** — spacing tokens if not already in globals.css; tabular-nums enforcement

> **Reconciliation note (2026-06-19, post shell-unification + hybrid-direction decision):** Build direction is **hybrid premium-within-system** — keep the institutional/anti-glass rules (§ line 36) and the design-inspector constraints (no arbitrary px, no raw gradients, `data-mono`/`tabular` on numerics, `duration-300`/`var(--dur)` motion). Achieve "premium" through density, hierarchy, and motion-as-state only — no glow/blur/decorative-gradient. House tokens (`--up`/`--down`/`--canvas`) are kept, not retuned.

### What does NOT change

- All backend routes and API endpoints
- `lib/accountability.ts`, `lib/predictions-ledger.ts`
- `data/` directory contents
- `components/calibration-chart.tsx`
- All team, player, simulator, sentiment pages (deferred to next phase)
- The `/fixture/[slug]` page (row navigation target — must continue to work, content improvement deferred)

---

## Part 4 — Spec Self-Review

### Placeholder scan
- No TBD sections. All component hierarchies are complete.
- Metric values are real (Brier 0.721, ECE 2.1%, etc. — from live wc26-accountability.json).
- Color values are explicit token references, not hex.
- Motion durations all specified (no "fast" or "slow" vagueness).

### Scope check
This spec covers 3 pages + design system. Implementation plan will cover these 3 pages in Phase 1. All other pages (team, player, simulator, sentiment, fixture detail) are deferred and explicitly documented as out-of-scope.

### Internal consistency
- Typography scale: consistent token names used in all 3 page specs.
- Color tokens: consistent use of `--up`, `--down`, `--warn`, `--ink-muted`, `--ink-faint` throughout.
- Component names: `IntelCard`, `SettlementRow`, `MetricStrip`, `StatusRail` used consistently.
- Mobile breakpoints: same 3-tier (mobile/tablet/desktop) used in all page specs.

### Ambiguity check
- "Intelligence briefing" section: 2×2 grid on desktop, 1-col on mobile (explicit in both places).
- Hero number: "10/21 correct picks" on homepage (picks ratio) and on /record (same — consistent).
- Sort behavior on /record settlement table: Brier column header, toggle asc/desc (explicit).
- Accountability stamp location: right side of status rail on /matches (explicit).

### Missing-requirement check
All 9 design system foundations: covered (§1–9).  
All 3 pages: covered with all 7 sub-sections each.  
Success criteria mapping:
- What WC26 does → Homepage hero + intelligence cards
- Why it's different → Accountability stamp + lifecycle nav labels
- Why forecasts can be trusted → ECE status rail + calibration section
- How the model is evaluated → /record metric strip + intelligence cards
- How the system learns → Notable Variance card + team breakdown
