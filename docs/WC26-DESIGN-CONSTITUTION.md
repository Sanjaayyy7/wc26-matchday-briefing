# WC26 Design Constitution & Premium Benchmark

The standard: stand next to Robinhood, Apple, Perplexity, and OpenAI/Codex without
flinching. This document is the rulebook every patch (and every subagent) must obey.
Research first, justify, then build patch-by-patch, review against the inspector, pivot
when it isn't good enough.

---

## 1. What makes the references premium (technique → purpose)

### Robinhood — "data as the hero"
- **Technique:** enormous confident editorial headlines, tight tracking; near-monochrome
  with ONE signal accent; line charts with smooth gradient area fills, precise tick
  treatment, and a single hover detail; tasteful number transitions; buttery scroll.
- **Purpose of each asset:** the number/chart *is* the product. Whitespace = trust.
  Every figure is framed as a moment, not a stat in a table.

### Apple — "type as architecture, light as material"
- **Technique:** massive perfectly-kerned type, one idea per viewport, rigorous 8pt
  rhythm, obscene vertical breathing room; scroll-driven storytelling (pinned/sticky
  reveals, scrubbed media); pure black voids; color used sparingly.
- **Purpose:** each section sells exactly one thing; motion reveals; silence = luxury.

### Perplexity — "calm clarity"
- **Technique:** restrained neutral palette + a single accent, generous whitespace,
  refined grotesk, subtle depth; the input is the hero and everything recedes.
- **Purpose:** focus and trust; the tool is the star, never the chrome.

### OpenAI / Codex — "editorial authority"
- **Technique:** research-journal grid of story cards, strong hierarchy, big margins,
  monochrome + restraint, abstract art cards, lots of air.
- **Purpose:** intellect and credibility; the work is the hero; content-forward.

**Common denominator:** restraint, one accent, rigorous spacing, world-class data/asset
fidelity, choreographed motion, and the confidence to leave space empty.

---

## 2. Brutal side-by-side — what WE lack (be honest)

1. **Scroll choreography:** near-zero. They stage reveals; we are static.
2. **Spacing rhythm:** evenly dense, not "one idea per viewport." Need Apple-grade air.
3. **Data-viz fidelity:** functional, not Robinhood-grade — no refined axes, no hover
   detail, weak gradient craft, no micro-interaction.
4. **Type:** improved (Archivo) but numbers aren't yet hero-grade; scale still sprawls.
5. **Color discipline:** the rainbow `chroma-rule` accent is a cheap "AI" tell. Premium =
   ONE accent + monochrome + the honest red.
6. **Light/surface:** flat black since the globe was removed — no atmosphere. They use
   light as material, with restraint.
7. **Micro-interactions:** inconsistent hover/focus/transition. Theirs are a system.
8. **Warmth:** all-data, can read cold. A restrained texture/grain/light layer helps.
9. **Type-scale clusters:** ~10 sizes = inconsistent. Consolidate to 5 intentional steps.
10. **Empty-space confidence:** we fill columns; they leave luxurious voids.

---

## 3. The Constitution (rules every patch obeys)

- **One direction:** Editorial Terminal — Swiss annual report × Bloomberg × stadium.
- **Palette:** jet canvas, one warm ink, ONE signal accent (verdict green) + honest red
  for BREACH. Retire the rainbow chroma decoration.
- **Type:** Archivo display (≤3 weights), Inter body, JetBrains mono for **tabular data
  only**. A five-step scale — no more.
- **Spacing:** strict 8px rhythm; one focal idea per viewport; generous vertical air.
- **Motion:** cinematic + mechanical; scroll reveals (fade + 4px rise, scrubbed); no
  springs/bounce; one signature moment per page; honor `prefers-reduced-motion`.
- **Data viz:** explicit purpose, real axes, sample-size encoding, one hover detail,
  smooth curves, restrained color. The data is the hero.
- **Honesty:** BREACH / miss loud, never hidden.
- **Surfaces:** hairlines over boxes; light as atmosphere, used sparingly; no glass, no
  shadow piles, no rounded route cards.
- **Every pixel justified.** If it doesn't serve the story, cut it.

---

## 4. Patch roadmap (build order)

| # | Patch | Why it's first |
|---|-------|----------------|
| P1 | Type-scale consolidation (5 steps) + retire rainbow accent → one accent | foundation; touches every page |
| P2 | Calibration diagram premium rebuild (axes, calibrated-zone band, ECE drop-lines, sample sizing) | core honesty viz, weakest asset |
| P3 | Scroll choreography — staged section reveals + one signature scroll moment | biggest "static vs premium" gap |
| P4 | Spacing/rhythm pass — one-idea-per-viewport, restrained hero atmosphere | Apple-grade air |
| P5 | Data-viz polish sweep — pulse hover, championship bars, brier bars, settlement rows | Robinhood-grade fidelity |
| P6 | Micro-interaction system — consistent hover/focus/transition tokens | cohesion |
| P7 | Page sweep — Record, Matches, Methodology to the same system | uniformity |

## 5. Inspector protocol (each patch)

1. Subagent implements ONE patch on its own branch.
2. Gates: `build` · `vitest` · `eslint` · `design-inspector` · `execution-inspector`.
3. Screenshot review against this constitution. Ask: *premium enough, or pivot?*
4. Only on pass → commit → PR → merge. Otherwise revise or pivot.
