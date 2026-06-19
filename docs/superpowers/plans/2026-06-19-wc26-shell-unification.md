# WC26 Shell Unification Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the dual-shell architecture (`AppChrome` on 11 content routes + `CommandShell` on `/command`) with one unified WC26 chrome — a shared nav + forecast-integrity status rail across every route — preserving all page content.

**Architecture:** Extract a pure presentational `WC26ShellHeader` (6-nav + status rail) usable in both server and client parents. Build a server `WCS26Shell` wrapper (prop-parity with `AppChrome`, self-computes `systemHealth`) for content pages. Refactor `CommandShell` to consume the shared header. Phased: P1 ships the shared pieces + `/` + `/matches`; P2 migrates the rest and deletes `AppChrome`.

**Tech Stack:** Next.js 16.2.6 (App Router, server + client components), React 19, Tailwind v4, lucide-react, vitest, `scripts/design-inspector.mts` (house design guardrail).

## Global Constraints

- **Next.js 16.2.6 breaking changes** — per `app/AGENTS.md`, read `node_modules/next/dist/docs/` before shell/layout edits.
- **No content regressions.** Page bodies + their `route`/`title`/`eyebrow`/`rail`/`fullBleed` usage preserved exactly; only the wrapper changes.
- **`globals.css` tokens unchanged.**
- **design-inspector must stay green:** scale tokens only (no arbitrary px), `tabular`/`data-mono` on numerics, `duration-300`/`var(--dur)` motion, no raw hex outside allowed files, no `glass-rail` in new chrome.
- **Intended removals (do NOT "fix"):** mobile bottom nav, `CinematicBackdrop`, `ThemeToggle`, `glass-rail` blur. All directive-aligned.
- **6-nav flatten:** Overview `/`, Command `/command`, Forecasts `/matches`, Record `/record`, Teams `/teams`, Simulate `/simulator`. Groups/Players/Sentiment are sub-links (no active highlight).
- **Run from `app/`.**

---

## PHASE 1 — Shared shell + `/` + `/matches`

### Task 1: Create `WC26ShellHeader` (shared nav + status rail)

**Files:**
- Create: `components/wc26-shell-header.tsx`

**Interfaces:**
- Produces:
  ```tsx
  export type NavItem = { label: string; href: string; routeKey: string };
  export const WC26_NAV: NavItem[];
  export function WC26ShellHeader(props: {
    route: string;
    systemHealth: import("@/lib/command-data").SystemHealth;
    extra?: React.ReactNode;
  }): React.JSX.Element;
  ```
  Consumed by Tasks 2 (WCS26Shell) and 4 (CommandShell).

- [ ] **Step 1: Write the component**

Create `components/wc26-shell-header.tsx`:

```tsx
import type { SystemHealth } from "@/lib/command-data";

export type NavItem = { label: string; href: string; routeKey: string };

export const WC26_NAV: NavItem[] = [
  { label: "Overview", href: "/", routeKey: "home" },
  { label: "Command", href: "/command", routeKey: "command" },
  { label: "Forecasts", href: "/matches", routeKey: "matches" },
  { label: "Record", href: "/record", routeKey: "record" },
  { label: "Teams", href: "/teams", routeKey: "teams" },
  { label: "Simulate", href: "/simulator", routeKey: "simulator" },
];

function statusDot(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "var(--up)";
  if (status === "WARNING") return "var(--warn)";
  return "var(--down)";
}
function statusTextCls(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "text-[var(--up)]";
  if (status === "WARNING") return "text-[var(--warn)]";
  return "text-[var(--down)]";
}

export function WC26ShellHeader({
  route,
  systemHealth,
  extra,
}: {
  route: string;
  systemHealth: SystemHealth;
  extra?: React.ReactNode;
}) {
  const dotColor = statusDot(systemHealth.status);
  const textCls = statusTextCls(systemHealth.status);

  return (
    <>
      {/* Nav */}
      <nav className="flex-shrink-0 border-b border-[var(--line)] bg-[var(--canvas)]">
        <div className="flex h-12 items-center px-6 gap-0">
          <a href="/" className="flex-shrink-0 text-label font-bold tracking-tight pr-5 border-r border-[var(--line)]">
            WC<span className="text-[var(--up)]">26</span>
          </a>
          <div className="flex flex-1">
            {WC26_NAV.map((tab) => {
              const active = tab.routeKey === route;
              return (
                <a
                  key={tab.href}
                  href={tab.href}
                  className={[
                    "flex h-12 items-center px-4 text-xs font-medium border-r border-[var(--hairline)] transition-colors duration-300",
                    active
                      ? "text-[var(--ink)] border-b-2 border-b-[var(--up)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                  ].join(" ")}
                >
                  {tab.label}
                </a>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-[var(--hairline)] text-slight">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
            <span className="text-[var(--ink-faint)]">· {systemHealth.graded} graded · v1.0.0-platt</span>
          </div>
        </div>
      </nav>

      {/* Status rail */}
      <div className="flex-shrink-0 flex h-8 items-center border-b border-[var(--hairline)] bg-[var(--canvas)] px-6 gap-0 text-fine">
        <div className="flex items-center gap-1.5 pr-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span className="data-mono tabular">{systemHealth.graded} of {systemHealth.total}</span>
          <span className="font-semibold text-[var(--ink-muted)]">graded</span>
        </div>
        <div className="flex items-center gap-1.5 px-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span>Calibration</span>
          <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
        </div>
        <div className="flex items-center gap-1.5 px-4 text-[var(--ink-faint)]">
          <span>ECE</span>
          <span className={`font-semibold data-mono tabular ${textCls}`}>{(systemHealth.ece * 100).toFixed(1)}%</span>
        </div>
        {extra}
      </div>
    </>
  );
}
```

- [ ] **Step 2: Lint + build + inspector (component compiles, unused for now)**

Run: `npx eslint components/wc26-shell-header.tsx` → Expected: clean
Run: `node --import tsx scripts/design-inspector.mts` → Expected: `Design inspector passed.` (component must comply: numeric ECE line has `data-mono tabular`, motion is `duration-300`, no arbitrary px)

- [ ] **Step 3: Commit**

```bash
git add components/wc26-shell-header.tsx
git commit -m "feat(shell): add shared WC26ShellHeader (6-nav + status rail)"
```

---

### Task 2: Create `WCS26Shell` server wrapper

**Files:**
- Create: `components/wc26-shell.tsx`

**Interfaces:**
- Consumes: `WC26ShellHeader`, `WC26_NAV` (Task 1); `buildSystemHealth`, `SystemHealth` from `@/lib/command-data`.
- Produces:
  ```tsx
  export function WCS26Shell(props: {
    children: React.ReactNode;
    route: string;
    eyebrow?: string;
    title?: string;
    rail?: React.ReactNode;
    fullBleed?: boolean;
  }): React.JSX.Element;
  ```
  Consumed by every content page (Tasks 5, 7).

- [ ] **Step 1: Write the wrapper**

Create `components/wc26-shell.tsx`. The per-page hero block is ported verbatim from `app-chrome.tsx` lines 86–97.

```tsx
import { WC26ShellHeader } from "./wc26-shell-header";
import { buildSystemHealth } from "@/lib/command-data";
import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";
import predictionsData from "@/data/predictions.json";
import accountabilityData from "@/data/backtest/wc26-accountability.json";

const predictions = (predictionsData as { entries: LockedEntry[] }).entries;
const accountability = accountabilityData as AccountabilityOutput;

export function WCS26Shell({
  children,
  route,
  eyebrow = "World Cup 2026",
  title,
  rail,
  fullBleed = false,
}: {
  children: React.ReactNode;
  route: string;
  eyebrow?: string;
  title?: string;
  rail?: React.ReactNode;
  fullBleed?: boolean;
}) {
  const systemHealth = buildSystemHealth(accountability, predictions.length);

  return (
    <div className="relative min-h-screen flex flex-col">
      <WC26ShellHeader route={route} systemHealth={systemHealth} />

      {(title || rail) && (
        <div className="mx-auto w-full max-w-7xl px-6 pt-10">
          <div className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-label">{eyebrow}</p>
              {title && <h1 className="text-display mt-3 text-5xl md:text-7xl">{title}</h1>}
              {title && <div className="mt-5 h-px w-40 bg-[var(--line)]" />}
            </div>
            {rail && <div className="min-w-0">{rail}</div>}
          </div>
        </div>
      )}

      {fullBleed ? (
        <main className="flex-1">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-7xl px-6 py-10 md:py-14">{children}</main>
      )}
    </div>
  );
}
```

Note: the AppChrome hero used `chroma-rule` for the divider; that utility is a forbidden rainbow gradient. Replaced with a plain `bg-[var(--line)]` hairline to stay inspector- and directive-clean.

- [ ] **Step 2: Lint + build + inspector**

Run: `npx eslint components/wc26-shell.tsx` → clean
Run: `npm run build` → succeeds (component compiles; not yet used)
Run: `node --import tsx scripts/design-inspector.mts` → `Design inspector passed.`

- [ ] **Step 3: Commit**

```bash
git add components/wc26-shell.tsx
git commit -m "feat(shell): add WCS26Shell server wrapper (AppChrome prop-parity)"
```

---

### Task 3: Teach design-inspector to accept either shell (transition)

**Files:**
- Modify: `scripts/design-inspector.mts:146-156`

**Interfaces:** none (build tooling).

- [ ] **Step 1: Replace the required-shell loop**

In `scripts/design-inspector.mts`, replace:

```ts
      for (const required of ["<AppChrome", "<RouteStack"]) {
        if (!text.includes(required)) {
          violations.push({
            file: rel,
            line: 1,
            rule: "page-shell",
            message: `Page shell is missing ${required}.`,
          });
        }
      }
```

with:

```ts
      if (!text.includes("<RouteStack")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "page-shell",
          message: "Page shell is missing <RouteStack.",
        });
      }
      // Transition: accept either the legacy AppChrome or the unified WCS26Shell.
      if (!text.includes("<AppChrome") && !text.includes("<WCS26Shell")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "page-shell",
          message: "Page must use AppChrome or WCS26Shell as its shell.",
        });
      }
```

- [ ] **Step 2: Verify inspector still green on current (all-AppChrome) pages**

Run: `node --import tsx scripts/design-inspector.mts` → Expected: `Design inspector passed.` (every page still has `<AppChrome` + `<RouteStack`)

- [ ] **Step 3: Commit**

```bash
git add scripts/design-inspector.mts
git commit -m "chore(inspector): accept AppChrome or WCS26Shell during shell migration"
```

---

### Task 4: Refactor `CommandShell` to use the shared header

**Files:**
- Modify: `components/command/command-shell.tsx`

**Interfaces:**
- Consumes: `WC26ShellHeader` (Task 1). `CommandShell` already receives `systemHealth`, `nextClosing`, `matchdayLabel` props.

- [ ] **Step 1: Import the shared header**

Add near the other imports in `components/command/command-shell.tsx`:

```tsx
import { WC26ShellHeader } from "@/components/wc26-shell-header";
```

- [ ] **Step 2: Replace the inline nav + status rail with the shared header**

Delete the `NAV_TABS` const, the `statusDot`/`statusText` helpers (now in the shared header — keep `metricColor` if still used by the right rail), and the inline `<nav>…</nav>` + the `{/* Status rail — 3 items */}` `<div>…</div>` blocks. Replace both blocks (the `<nav>` and the status-rail `<div>`) with:

```tsx
      <WC26ShellHeader
        route="command"
        systemHealth={systemHealth}
        extra={
          <>
            <div className="flex items-center gap-1.5 px-4 border-l border-[var(--hairline)] text-[var(--ink-faint)]">
              <span>Next:</span>
              <span className="font-semibold text-[var(--warn)]">{nextClosing}</span>
            </div>
            <div className="ml-auto text-[var(--ink-faint)]">{matchdayLabel}</div>
          </>
        }
      />
```

Keep everything below (the 3-column grid, ForecastRecord, MatchDetail, ModelEvolution, System Health right rail, ChampionProjectionPanel, ReliabilityTimeline, LearningSignals) exactly as-is.

- [ ] **Step 3: Lint + build + inspector**

Run: `npx eslint components/command/command-shell.tsx` → clean (remove any now-unused imports flagged)
Run: `npm run build` → succeeds
Run: `node --import tsx scripts/design-inspector.mts` → passed

- [ ] **Step 4: Visual check `/command`**

Start dev (if not running) and screenshot `http://localhost:3000/command`. Confirm nav + status rail render identically (6 tabs, status dot, graded/Calibration/ECE, Next/matchday tail), 3-column body + footer unchanged, no console errors.

- [ ] **Step 5: Commit**

```bash
git add components/command/command-shell.tsx
git commit -m "refactor(command): use shared WC26ShellHeader for nav + status rail"
```

---

### Task 5: Migrate `/` and `/matches` to `WCS26Shell`

**Files:**
- Modify: `app/page.tsx` (import + `<AppChrome route="home">` → `<WCS26Shell route="home">`)
- Modify: `app/matches/page.tsx` (import + `<AppChrome …>` → `<WCS26Shell …>`)

**Interfaces:**
- Consumes: `WCS26Shell` (Task 2).

- [ ] **Step 1: Swap `app/page.tsx`**

Change the import:

```tsx
import { AppChrome } from "@/components/app-chrome";
```
→
```tsx
import { WCS26Shell } from "@/components/wc26-shell";
```

Change the opening/closing tags: `<AppChrome route="home">` → `<WCS26Shell route="home">` and the matching `</AppChrome>` → `</WCS26Shell>`.

- [ ] **Step 2: Swap `app/matches/page.tsx`**

Change the import line 1:

```tsx
import { AppChrome } from "@/components/app-chrome";
```
→
```tsx
import { WCS26Shell } from "@/components/wc26-shell";
```

Change `<AppChrome` (line 15) → `<WCS26Shell` and the closing `</AppChrome>` → `</WCS26Shell>`. All props (`route`, `title`, `rail`) stay identical.

- [ ] **Step 3: Lint + build + inspector**

Run: `npx eslint app/page.tsx app/matches/page.tsx` → clean
Run: `npm run build` → succeeds
Run: `node --import tsx scripts/design-inspector.mts` → passed (these 2 now have `<WCS26Shell`; others still `<AppChrome`; dual-accept covers both)

- [ ] **Step 4: Visual check**

Screenshot `/` and `/matches`. Confirm: unified WC26 header + status rail on top, per-page hero intact ("Fixture Board" + SignalLine on matches), body content unchanged, no `glass-rail`/cinematic backdrop, no mobile bar, no console errors.

- [ ] **Step 5: Commit**

```bash
git add app/page.tsx app/matches/page.tsx
git commit -m "feat(shell): migrate / and /matches to WCS26Shell"
```

---

### Task 6: P1 verification gate

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `npm run lint` (note: pre-existing `scripts/*.mts` errors in promotion-policy/tournament-audit are out of scope) — confirm no NEW errors in touched files via `npx eslint components/wc26-shell-header.tsx components/wc26-shell.tsx components/command/command-shell.tsx app/page.tsx app/matches/page.tsx`
Run: `npm run build` → succeeds
Run: `npx vitest run` → 241 passed
Run: `node --import tsx scripts/design-inspector.mts` → passed

- [ ] **Step 2: STOP — checkpoint for review before P2**

P1 ships 3 routes on the new shell with 8 routes still on AppChrome (intentional, dual-accepted). Confirm visually before mass migration.

---

## PHASE 2 — Migrate remaining routes + delete AppChrome

### Task 7: Migrate the 10 remaining routes

**Files (each: swap import + `<AppChrome…>`/`</AppChrome>` → `<WCS26Shell…>`/`</WCS26Shell>`, props unchanged):**
- `app/groups/page.tsx` (route="groups")
- `app/teams/page.tsx` (route="teams")
- `app/record/page.tsx` (route="record")
- `app/simulator/page.tsx` (route="simulator")
- `app/players/page.tsx` (route="players")
- `app/players/[id]/page.tsx` (route="players")
- `app/sentiment/page.tsx` (route="sentiment")
- `app/sentiment/[slug]/page.tsx`
- `app/fixture/[slug]/page.tsx` (route="matches")
- `app/team/[id]/page.tsx` (route="teams")

- [ ] **Step 1: Swap each file**

For each file above: replace `import { AppChrome } from "@/components/app-chrome";` with `import { WCS26Shell } from "@/components/wc26-shell";`, and rename the `<AppChrome …>` opening tag and `</AppChrome>` closing tag to `<WCS26Shell …>` / `</WCS26Shell>`. Keep every prop (`route`, `title`, `rail`, `eyebrow`, `fullBleed`) exactly as written.

- [ ] **Step 2: Confirm no AppChrome references remain in pages**

Run: `grep -rn "AppChrome" app/` → Expected: no matches.

- [ ] **Step 3: Lint + build + inspector**

Run: `npm run build` → succeeds
Run: `node --import tsx scripts/design-inspector.mts` → passed
Run: `npx vitest run` → 241 passed

- [ ] **Step 4: Commit**

```bash
git add app/groups app/teams app/record app/simulator app/players app/sentiment app/fixture app/team
git commit -m "feat(shell): migrate remaining 10 routes to WCS26Shell"
```

---

### Task 8: Delete AppChrome + ThemeToggle, tighten inspector

**Files:**
- Delete: `components/app-chrome.tsx`
- Delete (conditional): `components/theme-toggle.tsx`
- Modify: `scripts/design-inspector.mts`

- [ ] **Step 1: ThemeToggle orphan check**

Run: `grep -rn "ThemeToggle" --include="*.tsx" --include="*.ts" .`
Expected after migration: matches only in `components/theme-toggle.tsx` (definition) and `components/app-chrome.tsx`. If so, both get deleted next. If any other consumer exists, keep `theme-toggle.tsx` and skip its deletion.

- [ ] **Step 2: Delete the legacy shell (and ThemeToggle if orphaned)**

```bash
git rm components/app-chrome.tsx
git rm components/theme-toggle.tsx   # only if Step 1 showed no other consumer
```

- [ ] **Step 3: Tighten the inspector to WCS26Shell-only and drop the dead mobile-nav rule**

In `scripts/design-inspector.mts`, change the transition shell check from Task 3 back to a single required shell:

```ts
      if (!text.includes("<RouteStack")) {
        violations.push({ file: rel, line: 1, rule: "page-shell", message: "Page shell is missing <RouteStack." });
      }
      if (!text.includes("<WCS26Shell")) {
        violations.push({ file: rel, line: 1, rule: "page-shell", message: "Page must use WCS26Shell as its shell." });
      }
```

Then delete the now-dead `mobile-nav` rule block (keyed on `components/app-chrome.tsx`):

```ts
    if (rel === "components/app-chrome.tsx" && !text.includes("function MobileTabBar")) {
      violations.push({
        file: rel,
        line: 1,
        rule: "mobile-nav",
        message: "AppChrome must include the mobile bottom tab bar.",
      });
    }
```

- [ ] **Step 4: Verify**

Run: `grep -rn "AppChrome\|MobileTabBar" app/ components/ scripts/` → Expected: no matches
Run: `npm run build` → succeeds
Run: `node --import tsx scripts/design-inspector.mts` → passed
Run: `npx vitest run` → 241 passed

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "refactor(shell): delete AppChrome + ThemeToggle; require WCS26Shell in inspector"
```

---

### Task 9: P2 final verification

**Files:** none.

- [ ] **Step 1: Full gate**

Run: `npm run build && npx vitest run && node --import tsx scripts/design-inspector.mts`
Expected: build ok, 241 passed, inspector passed.

- [ ] **Step 2: Live screenshots across routes**

With dev running, screenshot `/`, `/matches`, `/groups`, `/teams`, `/record`, `/simulator`, `/players`, `/sentiment`, `/command`, plus one dynamic route (e.g. a `/fixture/[slug]`). Confirm: identical WC26 header + status rail everywhere, correct active nav state on the 6 mapped routes, per-page heroes intact, `/command` 3-col unchanged, no console errors.

- [ ] **Step 3: Final commit (screenshots/docs if any)**

```bash
git add -A
git commit -m "chore(shell): unification verification across all routes"
```

---

## Self-Review

**Spec coverage:**
- WC26ShellHeader (pure, routeKey nav, status rail) → Task 1 ✓
- WCS26Shell (server, prop-parity, self-computes health, per-page hero) → Task 2 ✓
- Inspector dual-accept (P1) → Task 3; tighten + drop mobile-nav (P2) → Task 8 ✓
- CommandShell refactor (shared header, keep extras via `extra`) → Task 4 ✓
- Migrate / + /matches (P1) → Task 5; remaining 10 (P2) → Task 7 ✓
- Delete app-chrome.tsx + ThemeToggle orphan check → Task 8 ✓
- cinematic.tsx untouched (primitives required) → not modified by any task ✓
- Intended removals (mobile/cinematic/theme/glass) → consequence of Tasks 4,5,7,8 ✓
- Verification (build/tests/inspector/screenshots) → Tasks 6, 9 ✓

**Placeholder scan:** No TBD/TODO/"handle edge cases". Full code for new components; exact diffs for edits. ✓

**Type consistency:** `WC26ShellHeader` props (`route`, `systemHealth`, `extra?`) consistent across Tasks 1/2/4. `WC26_NAV` `NavItem` shape with `routeKey` consistent. `WCS26Shell` prop surface matches `AppChrome` exactly (Tasks 2/5/7). `buildSystemHealth(accountability, predictions.length)` matches the real signature in `lib/command-data.ts:322`. ✓
