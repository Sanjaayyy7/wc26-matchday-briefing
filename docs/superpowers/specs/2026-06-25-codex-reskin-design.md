# Codex Reskin — Design Spec

**Date:** 2026-06-25
**Branch:** `feat/codex-reskin` (stacked on `feat/linear-redesign`, PR #40 — supersedes the Linear look)
**Status:** design approved (brainstorming Q&A), pending spec review → writing-plans

---

## 1. Goal & Non-Goals

**Goal.** Make `/` (the unified Ledger dashboard) and the shared chrome visually read like the
ChatGPT/Codex landing reference: a cinematic blue-violet **bookend gradient** (hero + closing CTA
band) over true-black mid-sections, a **centered hero**, a **single slim translucent nav**, and
**gradient-framed showcase panels** — while keeping every honesty-first fact exactly where it is.

This **supersedes** the Linear (PR #40) aesthetic. The Linear *structural* work (unified ledger,
6-item nav, DateNav, shared primitives) is aesthetic-neutral and is **reused**; only the *look*
changes.

**Non-Goals.**
- No marketing-page structure (no pricing tiers, logo wall, "Trusted by", feature-sell copy).
- No page relocation — `/` stays the dashboard front door.
- No change to data, model, pipeline, or any locked prediction.
- No full redesign of the other 5 routes — they inherit the new chrome + a light consistency pass.

---

## 2. Design Decisions (from brainstorming)

| Axis | Decision |
|---|---|
| Clone scope | Reskin `/` in the Codex skin (single dashboard, content stays in place) |
| Gradient base | **Bookend** — gradient behind hero + closing CTA band; true-black mid-sections |
| Hero layout | **Centered** headline + CTA; forecast pulse moves *below* as the first framed showcase |
| Nav | **Restyle to Codex** single slim bar; keep BREACH (restyled); status rail relocates under hero |
| Theme | **Dark-only** — remove light theme + `next-themes` + toggle |
| Panels | **Gradient device frames** on key panels (forecast pulse, calibration, today's slate) |
| Branch | **Stack on `feat/linear-redesign`** — reuse its structure, re-theme, one combined PR |
| Font | **Retune Inter** — lighter hero weight + open tracking; no new font dependency |

---

## 3. Visual Constitution (token layer)

`globals.css` becomes **dark-only** via the **lowest-risk mechanism**: `<html>` is hard-pinned to
`class="dark"` permanently, and the existing **`.dark` token block is rethemed to the Codex values**.
The `@custom-variant dark` stays, so every existing `dark:` utility across components keeps resolving
(no need to hunt down and strip `dark:` variants). The light `:root` palette is left inert (never
activated) or trimmed. Only `next-themes`, the toggle, and theme-switching are removed.

**Token changes / additions** (exact hex finalized in implementation Task 1 by sampling the
reference images — and optionally inspecting the live page via the playwright MCP browser, the same
"measure, don't guess" method used for the Linear tokens):

| Token | Target value | Role |
|---|---|---|
| `--canvas` | `#000000` | true-black page base (Codex mid-sections) |
| `--surface` | `#0e0e10` | cards on black |
| `--ink` / `--ink-muted` / `--ink-faint` | `#f7f8f8` / `#8a8f98` / `#5f5f59` | text (unchanged) |
| `--accent` | `#5b53ff` | links, active nav (shift from Linear `#5e6ad2`) |
| `--gradient-hero` | radial periwinkle `#7c83d8` → electric `#3a3af0` → black | hero band |
| `--gradient-cta` | horizontal variant of the hero family | closing CTA band |
| `--gradient-frame` | `#5b53ff` → `#7b78ff` | device-frame glow behind showcase panels |
| `--up` / `--down` / `--warn` | jade `#7fd1b0` / clay `#e0654f` / gold `#d9a45b` (**unchanged**) | **data semantics only** |

**New CSS utilities** (replace the Linear `velvet-depth`/`hero-atmosphere`/`hero-glow` family):
- `gradient-hero` / `gradient-cta` — the bookend bands (masked radial/linear, no repeating grids).
- `showcase-frame` — rounded panel with a soft `--gradient-frame` glow/border (the Codex mockup motif).

**Typography retune** (Inter kept): `text-hero` weight `560 → ~480`, tracking `-0.022em → ~-0.012em`,
line-height `1.0 → 1.05`; `text-display` similarly opened. Codex display type is lighter and more
open than the tight Linear hero. Add centered-hero alignment in `app/page.tsx` (not a global change).

---

## 4. Layout Changes (`/` + chrome)

### Nav — `components/wc26-shell-header.tsx`
Collapse the current **two rows** (nav row + status rail) into **one slim translucent bar**:
- Left: `◇ WC26` wordmark.
- Center: the 6 nav links (muted → ink on hover; active = ink, subtle accent underline).
- Right cluster: restyled **BREACH** status as a ghost pill + one solid white pill CTA
  (`Today's slate →` linking `/matches`) — mirrors Codex's `Contact sales` + `Go to Cloud` pair.
- The relocated info (`51 of 69 graded · Calibration BREACH · ECE 10.0%`) renders as a thin centered
  strip **under the hero** — nothing is lost, just moved.
- **Delete** `components/theme-toggle.tsx` and its import.

### Hero — `app/page.tsx`
Centered stack on `gradient-hero`:
1. eyebrow `Live tournament · 48 nations · one ledger`
2. `32/51 correct picks` (huge, retuned `text-hero`, static — no ticker animation)
3. `Brier 0.568 · 63% accuracy`
4. one-line dek (existing honesty copy)
5. CTA pill `Open the ledger →` (anchors to the ledger section) + secondary text link `How we grade →`
6. relocated graded/ECE/BREACH strip
Then **directly below**, the `ForecastPulse` inside a `showcase-frame` (the hero mockup beat).

### Mid-sections (flat true-black)
Today's slate, Calibration, Intelligence briefing, Recent settlements, Next locks, the rail, and the
absorbed Record sections keep their structure. Key analytical panels (Calibration diagram, Today's
slate) get wrapped in `showcase-frame`. Everything else stays flat on black.

### Closing CTA band — `app/page.tsx` (new, bottom)
A `gradient-cta` band echoing Codex's "Try Codex today": an honest line
(`Locked before kickoff. Graded in public.`) + a link to `/methodology`. No download/marketing CTA.

---

## 5. New / Changed Components

| File | Change |
|---|---|
| `app/globals.css` | dark-only collapse; Codex tokens; `gradient-hero`/`gradient-cta`/`showcase-frame` utilities; retuned type |
| `app/layout.tsx` | drop `ThemeProvider`/`next-themes`; hard-pin `<html className="... dark">` so the rethemed `.dark` tokens are always active |
| `components/wc26-shell-header.tsx` | single-bar Codex nav; remove toggle; relocate status strip |
| `components/theme-toggle.tsx` | **delete** |
| `components/ui/showcase-frame.tsx` | **new** — gradient device-frame primitive (`as`, `glow?`, `className`) |
| `components/ui/gradient-band.tsx` | **new** — hero/CTA gradient section wrapper (`variant: "hero" \| "cta"`) |
| `app/page.tsx` | centered hero + pulse-below + framed panels + closing band |
| `scripts/design-inspector.mts` | **rewrite to Codex constitution** (see §7) |

`components/ui/surface.tsx`, `glass-header.tsx`, `hero.tsx`, `cinematic.tsx` (RouteStack/CanvasSection)
are reused; `glass-header.tsx` may be folded into the new nav or kept as the translucent wrapper.

---

## 6. Honesty Invariants (hard constraints — must not break)

Per `[[project-wc26-design-transformation]]`:
- **BREACH** verdict shown, not softened.
- Real figures: `32/51` correct, mean Brier `0.568`, ECE `10.0%`, 51 graded — data-derived, not edited.
- **Static** NumberTicker (no count-up animation).
- Canonical `official.verdict` (no local Brier remap).
- **SSR** CalibrationDiagram (no Plotly/client chart swap).
- Green/red **semantic** colors preserved in ForecastPulse (above/below chance) and VerdictChips.
- No edits to locked predictions; immutability holds (verify via git diff on data — but no data changes expected here).

These survive the reskin: the gradient/dark-only chrome is monochrome + violet; **data keeps its
semantic palette**.

---

## 7. Design-Inspector Rewrite (the gate)

`scripts/design-inspector.mts` currently encodes the Linear/anti-glass constitution and will **fail**
a Codex reskin. Rewrite its rules to the Codex constitution while keeping the structural + honesty
guards:

**Keep:** tokens-only (no raw hex in tsx/ts), tabular-numbers, page-shell (`WCS26Shell`/`RouteStack`/
`CanvasSection`), no-background-lines (mesh/repeating grids), motion tokens (`duration-300`/`0.3s`),
retired-box-primitives guard.

**Change:**
- Allow the new gradient/frame tokens (`--gradient-hero`/`--gradient-cta`/`--gradient-frame`) and the
  `gradient-hero`/`gradient-cta`/`showcase-frame` utility class names.
- `chroma-rule` accent jade `--up` → `--accent` (violet).
- Permit the showcase-frame's larger radius via `--radius-card` (bump `--radius-card` value to match
  Codex's rounded panels) — still **token-routed**, no raw `rounded-2xl/3xl/4xl` on pages.
- Drop the Linear-specific "content sits directly on the void, no panels" assumption where it
  conflicts with framed showcases (framed panels are now allowed, but only via `showcase-frame`).

**Self-gate:** the inspector must pass on the whole tree at final HEAD (it gates all routes at once —
a half-migrated app fails, so sequencing is load-bearing: tokens → utilities → primitives → nav →
inspector-rewrite → page → secondary routes).

---

## 8. Scope

- **Primary:** `/` deep reskin (hero, pulse showcase, framed panels, closing band).
- **Global (free):** nav + palette + dark-only propagate to all 6 routes automatically.
- **Secondary:** light consistency pass on `/matches`, `/command`, `/teams`, `/simulator`,
  `/methodology` so the new palette/nav leaves nothing broken (not a full per-route redesign).

---

## 9. Verification Gates (run ALL, from `app/`)

- `npx vitest run` (currently 383 — keep green)
- `npm run lint` (0 errors required; ~12 pre-existing warnings OK) — **run every task**
- `node --import tsx scripts/design-inspector.mts` (the **rewritten** Codex inspector)
- `npm run inspect:execution`
- `npm run model:inspect`
- `npm run build` (200 pages, all routes 200)
- Visual check: playwright MCP browser screenshot of `/` vs the reference (interactive, non-gate).

---

## 10. Risks & Mitigations

- **Inspector fights the reskin** → rewrite it first-class (Task) and sequence so the tree is never
  half-migrated at a gated checkpoint.
- **Dark-only removal breaks `dark:` utilities / next-themes hydration** → keep the `.dark` class
  hard-pinned on `<html>` and the `@custom-variant dark`, so `dark:` variants keep resolving; just
  remove `ThemeProvider`/`next-themes`/toggle. Verify no `useTheme` callers remain and the
  `suppressHydrationWarning` no longer hides a real mismatch (grep for `useTheme`, `next-themes`).
- **Gradient washes out chart contrast / honesty semantics** → gradient is bookend-only; mid-sections
  stay true-black; data palette untouched; check ForecastPulse + Calibration legibility on-screen.
- **Non-standard Next.js build** (per `app/AGENTS.md`) → read `node_modules/next/dist/docs/` before
  any framework-level change (layout/font/route config); no new heavy deps (Inter retuned, not swapped).
- **Bash safety-classifier intermittent outage** → retry; read-only tools unaffected.

---

## 11. Approach

Stack `feat/codex-reskin` on `feat/linear-redesign`. Execute via TDD / subagent-driven-development
with the gate suite above. PR #39 (data) stays independent. The Codex reskin lands as one cohesive PR
that supersedes PR #40's look.
