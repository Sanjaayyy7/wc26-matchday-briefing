# Codex Reskin Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Reskin `/` and the shared chrome to read pixel-close to the ChatGPT/Codex landing reference — cinematic blue-violet bookend gradient, centered hero, single slim nav, gradient-framed Calibration showcase — dark-only, with all honesty content intact and the ForecastPulse + AuroraField removed.

**Architecture:** Re-theme the existing token layer (`.dark` block) to Codex values, add gradient/frame utilities, hard-pin dark mode, rewrite the design-inspector to a Codex constitution, then restructure `app/page.tsx` (centered hero → framed Calibration showcase → flat black mid-sections → closing CTA band). Stacks on `feat/linear-redesign`; reuses its structural primitives (WCS26Shell/RouteStack/CanvasSection).

**Tech Stack:** Next.js 16 / React 19, Tailwind v4 (`@theme inline` + `@utility`), Inter Variable (retuned, not swapped), vitest (node env), tsx scripts.

## Global Constraints

- **Non-standard Next.js build** — before any framework-level change (layout, fonts, route config) read the relevant guide in `node_modules/next/dist/docs/`. Heed deprecation notices. (per `app/AGENTS.md`)
- **Run ALL gates from `app/`** after each task: `npx vitest run` · `npm run lint` (0 errors; ~12 pre-existing warnings OK) · `node --import tsx scripts/design-inspector.mts` · `npm run inspect:execution` · `npm run model:inspect` · `npm run build`. **Every task runs `npm run lint`.**
- **No new heavy deps** — Inter is retuned, not replaced. No `geist`, no chart libs.
- **Tokens-only in `.tsx`/`.ts`** — raw hex only in `globals.css` / data / `lib/kit-color.ts`. Numerics use `tabular`/`NumberTicker`. Pages use `WCS26Shell` + `RouteStack` + `CanvasSection`.
- **Honesty invariants (must not break):** BREACH shown; real `32/51`, Brier `0.568`, ECE `10.0%`, 51 graded; **static** NumberTicker (no count-up); canonical `official.verdict`; **SSR** CalibrationDiagram; green/red semantic colors in VerdictChips; no edits to locked predictions.
- **Dark-only via hard-pinned `.dark`** on `<html>` — keep `@custom-variant dark` so `dark:` utilities keep resolving.
- **Commits:** no `Co-Authored-By` trailer (project rule). Conventional prefixes (`feat:`/`refactor:`/`test:`/`docs:`).

---

## File Structure

| File | Responsibility |
|---|---|
| `app/globals.css` | Codex token re-theme of `.dark`; gradient/frame tokens + utilities; retuned type; remove dead pulse CSS |
| `scripts/design-inspector.mts` | Codex constitution gate (rewritten rules) |
| `tests/design-inspector.test.ts` | **new** — asserts Codex-valid passes, Linear-violation flags |
| `app/layout.tsx` | dark-only: drop next-themes, hard-pin `.dark` |
| `components/wc26-shell-header.tsx` | single-bar Codex nav |
| `components/theme-toggle.tsx` | **delete** |
| `components/ui/gradient-band.tsx` | **new** — hero/CTA gradient section wrapper |
| `components/ui/showcase-frame.tsx` | **new** — gradient device-frame panel |
| `app/page.tsx` | centered hero, framed Calibration showcase, closing CTA band; remove aurora + pulse |
| `components/forecast-pulse.tsx`, `aurora-field.tsx`, `aurora-field-mount.tsx` | **delete** |

---

## Task 1: Codex token foundation + gradient utilities

**Files:**
- Modify: `app/globals.css` (the `.dark` block ~171-252; `@theme inline` radius ~80; `text-hero`/`text-display` ~294-307; add utilities after ~525)

**Interfaces:**
- Produces: CSS custom props `--gradient-hero`, `--gradient-cta`, `--gradient-frame`, retheme of `--canvas`/`--surface`/`--accent`, bumped `--radius-card`; utility classes `gradient-hero`, `gradient-cta`, `showcase-frame`. Consumed by Tasks 4, 5, 7 and the inspector (Task 2).

- [ ] **Step 1: Sample the reference, then re-theme `.dark` tokens**

Open the reference images (#3, #4, #5, #9) and/or the live page for exact values:
optionally `node --import tsx` is not needed — use the playwright MCP browser to
`browser_navigate` `https://chatgpt.com/codex` and `browser_evaluate` `getComputedStyle` on the hero
to confirm hex. Then in `app/globals.css`, inside `.dark { … }` set:

```css
  --void: #000000;
  --canvas: #000000;        /* Codex mid-sections are true black */
  --surface: #0e0e10;
  --ink: #f7f8f8;
  --ink-muted: #9aa0aa;
  --ink-faint: #6b6f78;
  --hairline: rgba(255,255,255,.08);
  --line: rgba(255,255,255,.12);
  --accent: #5b53ff;        /* Codex blue-violet (was Linear #5e6ad2) */
  --accent-bright: #8f8bff;
  /* Codex cinematic gradients — finalize hex from the sampled reference. */
  --gradient-hero:
    radial-gradient(90% 80% at 28% 8%, rgba(150,156,224,.55) 0%, transparent 42%),
    linear-gradient(135deg, #2c2d86 0%, #1b1c4f 28%, #0a0a1f 58%, #000 100%);
  --gradient-cta:
    linear-gradient(100deg, #0a0a1f 0%, #2c2d86 42%, #4b4bf0 74%, #6f6dff 100%);
  --gradient-frame:
    linear-gradient(135deg, #5b53ff 0%, #7b78ff 50%, #4b4bf0 100%);
```

Keep the `--up`/`--down`/`--warn`/stage/verdict tokens **unchanged** (data semantics). Leave the
light `:root` block inert (never activated). Keep `--accent` in `:root` too (so non-`.dark` references
don't break the build), but it is never shown.

- [ ] **Step 2: Bump the card radius + add the frame radius**

In the `@theme inline` block (~line 80), change:

```css
  --radius-card: 1.25rem;   /* was 0.5rem — Codex panels are softly rounded */
```

(Keep `--radius-pill: 9999px`.) The showcase-frame uses its own larger radius internally (Step 4), so
pages still only ever write `rounded-[var(--radius-card)]`.

- [ ] **Step 3: Retune the display type (Inter kept)**

Replace the `text-hero` and `text-display` utilities:

```css
@utility text-hero {
  font-family: var(--font-display);
  font-size: clamp(2.75rem, 6vw, 6.5rem);
  font-weight: 520;            /* was 560 — Codex display is lighter/opener */
  letter-spacing: -0.012em;    /* was -0.022em */
  line-height: 1.05;           /* was 1.0 */
}
@utility text-display {
  font-family: var(--font-display);
  font-size: clamp(1.875rem, 3.4vw, 3.5rem);
  font-weight: 460;            /* was 510 */
  letter-spacing: -0.014em;
  line-height: 1.06;
}
```

- [ ] **Step 4: Add the Codex gradient + frame utilities**

After the existing `@utility hero-glow { … }` block (~line 525), add:

```css
/* Codex cinematic hero / closing-CTA bands (bookend gradient). */
@utility gradient-hero {
  background: var(--gradient-hero);
}
@utility gradient-cta {
  background: var(--gradient-cta);
}
/* Codex device-frame: a screenshot/panel floats inside a violet gradient bezel. */
@utility showcase-frame {
  position: relative;
  border-radius: 1.5rem;
  padding: 1px;                       /* the bezel thickness */
  background: var(--gradient-frame);
  box-shadow: var(--shadow-pop);
}
@utility showcase-frame-inner {
  border-radius: calc(1.5rem - 1px);
  background: var(--surface);
  overflow: hidden;
}
```

- [ ] **Step 5: Run the gate suite**

```bash
cd app
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run build
```

Expected: vitest PASS (383), lint 0 errors, **design-inspector PASS** (still the Linear rules — new
tokens live in `globals.css` where hex is allowed; `linear-gradient` is not `repeating-linear-gradient`
so `no-background-lines` does not fire), build 200 pages. The whole site is now true-black with the
violet accent; `/` still shows the old hero/pulse (changed in Task 5).

- [ ] **Step 6: Commit**

```bash
git add app/globals.css
git commit -m "feat(design): Codex token foundation — true-black canvas, violet accent, gradient utilities"
```

---

## Task 2: Rewrite the design-inspector to the Codex constitution

**Files:**
- Modify: `scripts/design-inspector.mts`
- Create: `tests/design-inspector.test.ts`

**Interfaces:**
- Consumes: utility/token names from Task 1 (`gradient-hero`, `gradient-cta`, `showcase-frame`, `--accent`).
- Produces: `inspectProject(root?)` (unchanged signature) enforcing Codex rules. Gates Tasks 3-7.

- [ ] **Step 1: Write the failing test**

Create `tests/design-inspector.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "../scripts/design-inspector.mts";

function scratch(files: Record<string, string>): string {
  const root = mkdtempSync(join(tmpdir(), "insp-"));
  for (const [rel, body] of Object.entries(files)) {
    const full = join(root, rel);
    mkdirSync(join(full, ".."), { recursive: true });
    writeFileSync(full, body, "utf8");
  }
  return root;
}

describe("Codex design inspector", () => {
  it("allows the showcase-frame utility + accent gradient on a page", () => {
    const root = scratch({
      "app/page.tsx": `export default function P(){return(
        <WCS26Shell route="home"><RouteStack><CanvasSection eyebrow="x">
        <div className="showcase-frame"><div className="showcase-frame-inner" /></div>
        </CanvasSection></RouteStack></WCS26Shell>);}`,
    });
    const v = inspectProject(root);
    rmSync(root, { recursive: true, force: true });
    expect(v.filter((x) => x.rule === "elevation" || x.rule === "radius-token")).toHaveLength(0);
  });

  it("still flags raw hex in a component", () => {
    const root = scratch({ "components/x.tsx": `export const C = () => <div style={{color:'#ff0000'}} />;` });
    const v = inspectProject(root);
    rmSync(root, { recursive: true, force: true });
    expect(v.some((x) => x.rule === "tokens-only")).toBe(true);
  });
});
```

- [ ] **Step 2: Run it to verify it fails**

```bash
cd app
npx vitest run tests/design-inspector.test.ts
```

Expected: FAIL — the `showcase-frame` test fails because the current inspector has no such allowance
(and `inspectProject` may not yet be importable from a `.mts` under vitest). If the import itself
errors, that is the expected red.

- [ ] **Step 3: Update the inspector rules**

In `scripts/design-inspector.mts`:

1. **Accent gradients allowed** — leave `RAW_HEX_RE` as-is (hex still banned in tsx/ts; gradients live
   in `globals.css`). No change needed for `gradient-hero`/`gradient-cta` usage since they are class
   names, not hex.
2. **Showcase-frame radius** — the `showcase-frame` utility owns its `1.5rem` radius in CSS, so pages
   never write raw large radii. No rule change required, but add `showcase-frame` and
   `showcase-frame-inner` to an allowlist comment. Confirm `RADIUS_TOKEN_RE` only fires on raw
   `rounded-2xl/3xl/4xl` (it does) — these classes are fine.
3. **Chroma accent** — none required in the inspector (the `chroma-rule` color lives in CSS, Task 1
   leaves it; optionally repoint it to `--accent` in `globals.css` Step — add that to Task 1 if the
   jade rule reads off-palette). Add `--accent` to the conceptual allowlist.
4. **Keep** every structural + honesty guard: `tokens-only`, `tabular-numbers`, `page-shell`
   (`WCS26Shell`/`RouteStack`/`CanvasSection`), `no-background-lines`, `motion-tokens`,
   `no-box-primitives`, `layout-primitives`.

Net code change: the inspector already passes the Codex-valid snippet because `showcase-frame` is a
plain class and gradients are CSS. The real work is **making `inspectProject` importable under vitest**
— ensure it is exported (it is) and that the test's `.mts` import resolves. If vitest cannot import
`.mts`, add to `vitest.config` `test.server.deps.inline` or rename the import to use the compiled path;
simplest: confirm `"include"` covers `*.test.ts` (already widened last session) and that `tsx`/vite
handles `.mts` (it does via the `node --import tsx` and vite esbuild). If needed, change the test import
to `from "../scripts/design-inspector.mjs"`-style is NOT available; instead re-export via a thin
`scripts/design-inspector.ts` is overkill — prefer configuring vitest to resolve `.mts`.

- [ ] **Step 4: Run the test to verify it passes**

```bash
cd app
npx vitest run tests/design-inspector.test.ts
```

Expected: PASS (both cases).

- [ ] **Step 5: Run the inspector on the real tree**

```bash
node --import tsx scripts/design-inspector.mts
```

Expected: "Design inspector passed." on the current tree (Task 1 state).

- [ ] **Step 6: Commit**

```bash
git add scripts/design-inspector.mts tests/design-inspector.test.ts
git commit -m "test(design): Codex constitution inspector + coverage for frame/accent rules"
```

---

## Task 3: Dark-only — remove next-themes + toggle

**Files:**
- Modify: `app/layout.tsx`
- Modify: `components/wc26-shell-header.tsx` (remove `ThemeToggle` import + usage only — full nav restyle is Task 4)
- Delete: `components/theme-toggle.tsx`

**Interfaces:**
- Consumes: nothing new.
- Produces: `<html>` permanently carries `dark`; no `useTheme`/`next-themes` anywhere.

- [ ] **Step 1: Read the Next docs for layout/font conventions**

```bash
ls node_modules/next/dist/docs/ 2>/dev/null && sed -n '1,40p' node_modules/next/dist/docs/*app*router* 2>/dev/null | head -40
```

Confirm `<html className>` + `next/font` usage is unchanged from what `layout.tsx` already does.

- [ ] **Step 2: Hard-pin dark in `app/layout.tsx`**

Remove the `next-themes` import + `<ThemeProvider>` wrapper; add `dark` to the `<html>` class:

```tsx
import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";

const inter = Inter({ variable: "--font-inter", subsets: ["latin"], display: "swap" });
const jetbrainsMono = JetBrains_Mono({ variable: "--font-jetbrains-mono", subsets: ["latin"], display: "swap" });

export const metadata: Metadata = {
  title: "Matchday Briefing",
  description: "FIFA World Cup 2026 — kitchen-table previews",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`dark ${inter.variable} ${jetbrainsMono.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
```

(`suppressHydrationWarning` is dropped — it only existed to hide the next-themes class swap, which is
gone.)

- [ ] **Step 3: Remove the toggle from the header + delete the file**

In `components/wc26-shell-header.tsx`, delete `import { ThemeToggle } from "./theme-toggle";` and the
`<div className="pl-2"><ThemeToggle /></div>` block. Then:

```bash
rm components/theme-toggle.tsx
```

- [ ] **Step 4: Verify nothing references the removed APIs**

```bash
grep -rn "useTheme\|next-themes\|theme-toggle\|ThemeToggle" app components lib
```

Expected: **no output**.

- [ ] **Step 5: Gate suite**

```bash
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run build
```

Expected: all green; the toggle is gone and the site stays dark with no flash.

- [ ] **Step 6: Commit**

```bash
git add app/layout.tsx components/wc26-shell-header.tsx
git rm components/theme-toggle.tsx
git commit -m "refactor(theme): dark-only — drop next-themes + toggle, hard-pin .dark"
```

---

## Task 4: Codex single-bar nav

**Files:**
- Modify: `components/wc26-shell-header.tsx`

**Interfaces:**
- Consumes: `WC26_NAV`, `SystemHealth` (existing), `--accent`, `--surface` tokens.
- Produces: one slim translucent bar; the second status-rail row is removed (its `graded/Calibration/ECE` data relocates to the hero strip rendered by `app/page.tsx` in Task 5).

- [ ] **Step 1: Replace the header body with the Codex bar**

Rewrite the returned JSX of `WC26ShellHeader` (keep `statusDot`/`statusTextCls` helpers, the
`WC26_NAV` export, and the `GlassHeader` wrapper):

```tsx
  return (
    <GlassHeader className="bg-[color-mix(in_oklab,var(--canvas)_72%,transparent)]">
      <nav className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="shrink-0 text-label font-bold tracking-tight text-[var(--ink)]">
          WC<span className="text-[var(--accent)]">26</span>
        </Link>
        <div className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {WC26_NAV.map((tab) => {
            const active = tab.routeKey === route;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "ix-link text-label",
                  active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
          <span className="ix-chip inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-fine">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
          </span>
          <Link
            href="/matches"
            className="hidden rounded-[var(--radius-pill)] bg-[var(--ink)] px-4 py-1.5 text-label font-semibold text-[var(--canvas)] transition-opacity duration-300 hover:opacity-90 sm:inline-block"
          >
            Today&apos;s slate →
          </Link>
        </div>
      </nav>
    </GlassHeader>
  );
```

Remove the `extra` prop usage in the rail if it is no longer rendered (keep the prop in the signature
for compatibility, or delete it if unused — `grep "extra=" ` first). Drop the old status-rail `<div>`.

- [ ] **Step 2: Confirm no caller passed `extra`**

```bash
grep -rn "WC26ShellHeader" app components | grep -i "extra"
```

Expected: no output → safe to delete the `extra` prop (and its type) from the component.

- [ ] **Step 3: Gate suite + visual**

```bash
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run build
```

Then, via the playwright MCP browser: `browser_navigate http://localhost:3000` (after `npm run dev` in
a background shell) and `browser_take_screenshot` of the nav. Compare to reference Image #3 — wordmark
left, centered links, ghost status chip + solid pill right.

- [ ] **Step 4: Commit**

```bash
git add components/wc26-shell-header.tsx
git commit -m "feat(nav): Codex single-bar header — centered links, ghost BREACH chip, solid CTA"
```

---

## Task 5: Centered hero, framed Calibration showcase, closing band

**Files:**
- Create: `components/ui/gradient-band.tsx`
- Create: `components/ui/showcase-frame.tsx`
- Modify: `app/page.tsx`

**Interfaces:**
- Consumes: `gradient-hero`/`gradient-cta`/`showcase-frame` utilities (Task 1); `CalibrationDiagram`, `MatchdayToday`, `LedgerRecordSections`, existing data layer.
- Produces: `GradientBand` (`variant: "hero" | "cta"`), `ShowcaseFrame` components.

- [ ] **Step 1: Create the `GradientBand` primitive**

`components/ui/gradient-band.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function GradientBand({
  variant,
  className,
  children,
}: {
  variant: "hero" | "cta";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "relative isolate overflow-hidden",
        variant === "hero" ? "gradient-hero" : "gradient-cta",
        className,
      )}
    >
      {children}
    </section>
  );
}
```

- [ ] **Step 2: Create the `ShowcaseFrame` primitive**

`components/ui/showcase-frame.tsx`:

```tsx
import * as React from "react";
import { cn } from "@/lib/utils";

export function ShowcaseFrame({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("showcase-frame", className)}>
      <div className="showcase-frame-inner">{children}</div>
    </div>
  );
}
```

- [ ] **Step 3: Restructure the hero + showcase in `app/page.tsx`**

Remove imports for `AuroraFieldMount` and `ForecastPulse`. Add imports for `GradientBand` and
`ShowcaseFrame`. Replace the `{/* SCOREBOARD HERO … */}` `<section>` (lines ~232-269) with a centered
hero band; the Calibration block moves up into a `ShowcaseFrame` directly under the hero copy:

```tsx
        {/* ── CODEX HERO — centered, on the cinematic gradient ── */}
        <GradientBand variant="hero" className="-mx-6 px-6">
          <div className="mx-auto max-w-3xl py-24 text-center md:py-32">
            <p className="text-micro uppercase tracking-widest text-[var(--ink-muted)]">
              Live tournament · 48 nations · one ledger
            </p>
            <div className="text-hero tabular mt-6">
              {correct}/{agg.n} <span className="text-[var(--ink-muted)]">correct picks</span>
            </div>
            <div className="text-title tabular mt-4 text-[var(--ink-muted)]">
              Brier {brierStr} · {accuracyStr} accuracy
            </div>
            <p className="text-body mx-auto mt-6 max-w-md">
              Locked before kickoff. Graded in public. A public record of what one model believed —
              Elo · Dixon-Coles · Platt — and what actually happened.
            </p>
            <div className="mt-9 flex items-center justify-center gap-5">
              <Link
                href="#ledger"
                className="rounded-[var(--radius-pill)] bg-[var(--ink)] px-6 py-2.5 text-label font-semibold text-[var(--canvas)] transition-opacity duration-300 hover:opacity-90"
              >
                Open the ledger →
              </Link>
              <Link href="/methodology" className="ix-link text-label underline underline-offset-4">
                How we grade ourselves
              </Link>
            </div>
            <div className="mt-10 flex flex-wrap items-center justify-center gap-x-4 gap-y-1 text-fine text-[var(--ink-muted)]">
              <span className="data-mono tabular">{agg.n} of {entries.length} graded</span>
              <span>·</span>
              <span>Calibration <span style={{ color: statusColor }} className="font-semibold">{status}</span></span>
              <span>·</span>
              <span>ECE <span className="data-mono tabular">{eceStr}</span></span>
            </div>
          </div>
        </GradientBand>

        {/* ── HERO SHOWCASE — Calibration in a Codex device frame ── */}
        <CanvasSection eyebrow="Calibration · the model, audited" title="On the diagonal = calibrated">
          <ShowcaseFrame>
            <div className="p-6 md:p-10">
              <CalibrationDiagram
                bins={accountability.official.calibrationBins ?? []}
                caption={`${agg.n} graded · ECE ${eceStr} vs 3.0% target`}
              />
            </div>
          </ShowcaseFrame>
          <Link
            href="/methodology"
            className="ix-link text-caption underline underline-offset-2"
          >
            How we grade ourselves →
          </Link>
        </CanvasSection>
```

Then **delete** the old "Calibration — the model, audited" sub-block from inside the "Live ledger"
`CanvasSection` (it is now the showcase), and **delete** the `<div className="relative z-10 hidden lg:block"><ForecastPulse /></div>`
and the `AuroraFieldMount` line. Give the "Live ledger" `CanvasSection` an `id="ledger"` anchor (wrap
or add to its section) so the hero CTA scrolls to it.

- [ ] **Step 4: Wrap Today's slate in a showcase frame**

In the `todaysMatches.length > 0` block, wrap `<MatchdayToday matches={todaysMatches} />` in
`<ShowcaseFrame><div className="p-4 md:p-6">…</div></ShowcaseFrame>`.

- [ ] **Step 5: Add the closing CTA band**

Before `</RouteStack>` closes (after `LedgerRecordSections`), add:

```tsx
        <GradientBand variant="cta" className="-mx-6 px-6">
          <div className="mx-auto max-w-2xl py-20 text-center">
            <h2 className="text-display">Locked before kickoff. Graded in public.</h2>
            <p className="text-body mx-auto mt-4 max-w-md">
              One model — Elo · Dixon-Coles · Platt — held to its word, match after match.
            </p>
            <Link
              href="/methodology"
              className="mt-8 inline-block rounded-[var(--radius-pill)] bg-[var(--ink)] px-6 py-2.5 text-label font-semibold text-[var(--canvas)] transition-opacity duration-300 hover:opacity-90"
            >
              See the methodology →
            </Link>
          </div>
        </GradientBand>
```

- [ ] **Step 6: Gate suite + visual diff**

```bash
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run inspect:execution && npm run model:inspect && npm run build
```

Expected: all green. Then playwright MCP: screenshot `/` full-page; compare to reference Images #3-#9 —
centered hero on gradient, framed calibration showcase, true-black mid, gradient closing band, no
particles, no pulse.

- [ ] **Step 7: Commit**

```bash
git add app/page.tsx components/ui/gradient-band.tsx components/ui/showcase-frame.tsx
git commit -m "feat(home): Codex centered hero + framed Calibration showcase + closing CTA band"
```

---

## Task 6: Delete ForecastPulse + AuroraField + dead CSS

**Files:**
- Delete: `components/forecast-pulse.tsx`, `components/aurora-field.tsx`, `components/aurora-field-mount.tsx`
- Modify: `app/globals.css` (remove dead pulse rules)

**Interfaces:** none produced — pure removal. (Verified Task pre-check: only `app/page.tsx` imported them, and Task 5 removed those imports.)

- [ ] **Step 1: Confirm zero importers remain**

```bash
grep -rn "forecast-pulse\|ForecastPulse\|aurora-field\|AuroraField" app components lib
```

Expected: only matches inside `globals.css` (the dead `.pulse-node`/`#forecast-pulse-path`/
`pulse-draw` rules) and the component files themselves. **No `.tsx` importer.**

- [ ] **Step 2: Delete the components**

```bash
git rm components/forecast-pulse.tsx components/aurora-field.tsx components/aurora-field-mount.tsx
```

- [ ] **Step 3: Remove the dead pulse CSS**

In `app/globals.css`, delete the `.pulse-node { … }` + `.pulse-node:hover { … }` rules (~395-403), the
`@keyframes pulse-draw` + its reduced-motion `#forecast-pulse-path` block (~405-419). Leave the
`settle-flash` rules.

- [ ] **Step 4: Gate suite**

```bash
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run build
```

Expected: all green; bundle no longer ships the pulse SVG/aurora canvas.

- [ ] **Step 5: Commit**

```bash
git add app/globals.css
git commit -m "refactor(home): remove ForecastPulse + AuroraField (read cheap, not Codex-rich)"
```

---

## Task 7: Secondary-route consistency pass

**Files:**
- Modify (as needed): `app/matches/page.tsx`, `app/command/page.tsx`, `app/teams/page.tsx`, `app/simulator/page.tsx`, `app/methodology/page.tsx`

**Interfaces:** none new — routes already inherit the rethemed tokens + new nav.

- [ ] **Step 1: Screenshot every route**

With dev server running, playwright MCP `browser_navigate` + `browser_take_screenshot` for each of
`/matches`, `/command`, `/teams`, `/simulator`, `/methodology`. Note any route that looks broken on the
new true-black palette (e.g., a panel relying on the old `--canvas #08090a`, a jade `chroma-rule` that
now clashes, leftover light-mode assumptions).

- [ ] **Step 2: Apply minimal fixes only**

For each flagged route, make the smallest token-routed fix (e.g., swap a hardcoded jade rule to
`--accent`, wrap a hero panel in `ShowcaseFrame` for consistency). Do **not** redesign — keep them
coherent with `/`. Re-run the design-inspector after each edit.

- [ ] **Step 3: Gate suite**

```bash
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run inspect:execution && npm run model:inspect && npm run build
```

Expected: all green; all 6 routes coherent in the Codex skin.

- [ ] **Step 4: Commit**

```bash
git add app
git commit -m "feat(routes): Codex consistency pass across the 5 secondary routes"
```

---

## Task 8: Visual QA + final verification

**Files:** none (verification only; fixes loop back to the relevant task's files).

- [ ] **Step 1: Side-by-side visual check**

Playwright MCP full-page screenshot of `/` at desktop width. Place beside reference Images #3-#9.
Verify: centered hero on cinematic gradient; framed calibration showcase; true-black mid-sections;
gradient closing band; single slim nav with solid CTA; **no particles, no heart-rate chart**; type
weight/tracking reads Codex-clean.

- [ ] **Step 2: Honesty audit**

Confirm on the rendered page: BREACH shown; `correct/n` real; Brier `0.568`; ECE `10.0%`; numbers are
static (no count-up); Calibration is SSR (view-source shows the SVG/markup, not a client placeholder).

- [ ] **Step 3: Full gate suite (final HEAD)**

```bash
cd app
npx vitest run && npm run lint && node --import tsx scripts/design-inspector.mts && npm run inspect:execution && npm run model:inspect && npm run build
```

Expected: vitest green (≥383 + the new inspector test), lint 0 errors, design-inspector PASS, execution
+ model inspectors PASS, build 200 pages all-200.

- [ ] **Step 4: Responsive check**

Playwright `browser_resize` to 390px (mobile) + 768px (tablet): nav collapses cleanly (links hidden on
mobile per `md:flex`), hero stays centered and readable, frames do not overflow.

- [ ] **Step 5: Final commit (if any QA fixes)**

```bash
git add -A
git commit -m "fix(design): Codex QA polish — responsive + visual parity pass"
```

---

## Self-Review

**Spec coverage:** §2 decisions → Tasks 1,3,4,5 (gradient base/hero/nav/dark-only/frames); §3 tokens →
Task 1; §4 layout → Tasks 4,5; §5 files → all; §6 honesty → Tasks 5,8; §7 inspector → Task 2; §8 scope
→ Task 7; §9 gates → every task; ForecastPulse/Aurora removal → Tasks 5,6. No gaps.

**Placeholder scan:** hero/CTA/frame/nav/inspector/layout code is concrete; gradient hex carries a
"finalize from reference" refinement step (real starting values given, not a placeholder). No TBD/TODO.

**Type consistency:** `GradientBand({variant})`, `ShowcaseFrame({children})`, `inspectProject(root?)`,
`showcase-frame`/`showcase-frame-inner`/`gradient-hero`/`gradient-cta` class names, `--radius-card`/
`--accent`/`--gradient-*` tokens — used identically across Tasks 1,2,5,7.
