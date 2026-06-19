# WC26 Shell Unification

**Date:** 2026-06-19
**Scope:** Replace the dual-shell architecture (`AppChrome` on 11 content routes + `CommandShell` on `/command`) with one unified WC26 chrome: a shared nav + forecast-integrity status rail across every route. Surgical — swap the shell wrapper, preserve all page content, data, and business logic.

## Context

The app ships two shells built from the same `globals.css` tokens but with different chrome:

- **`AppChrome`** (`components/app-chrome.tsx`, server component) — used by **12 route files**: `/`, `/matches`, `/groups`, `/teams`, `/record`, `/simulator`, `/players`, `/sentiment`, plus dynamic `fixture/[slug]`, `team/[id]`, `players/[id]`, `sentiment/[slug]`. Provides: `glass-rail` blurred sticky header, "Matchday Briefing" branding, 7-item desktop nav, `ThemeToggle`, `CinematicBackdrop`, inline `MobileTabBar` (responsive `md:hidden` bottom bar), and optional per-page `title`/`eyebrow`/`rail`/`fullBleed` hero. Props: `{ children, route, eyebrow?, title?, rail?, fullBleed? }`.
- **`CommandShell`** (`components/command/command-shell.tsx`, client component) — used by `/command` only. Provides: solid-canvas nav (6 tabs) + status rail (Brier/ECE/BREACH), 3-column body, footer (Reliability Timeline + Learning Signals).

`MobileTabBar` is **not** a separate file — it is an inline function inside `app-chrome.tsx`.

## Decisions (locked with user)

| Decision | Choice |
|----------|--------|
| Nav count | **6 items** (flatten): Overview `/`, Command `/command`, Forecasts `/matches`, Record `/record`, Teams `/teams`, Simulate `/simulator`. Groups/Players/Sentiment are sub-links, not top-level. |
| Mobile nav | **Dropped.** Desktop-only, matching `CommandShell`. (Accepted regression.) |
| Status rail | **All routes.** Forecast-integrity rail (Brier/ECE/BREACH) atop every page. |
| Per-page heroes | **Kept.** Shell renders global nav+rail, then each page's own `title`/`eyebrow`/`rail`, then content. |
| Rollout | **Phased.** P1 = shared shell + `/` + `/matches`, verify. P2 = remaining 10 routes + delete `AppChrome`. |

## Intended changes (on purpose, not regressions to fix)

These follow from the decisions and from directive alignment — flag, don't prevent:

- **Mobile bottom nav removed** (and `pb-24 md:pb-0` mobile padding cleaned up). Mobile loses navigation.
- **`CinematicBackdrop` removed** on 11 pages → flatter, terminal-consistent. (Directive forbids cinematic motion.)
- **`ThemeToggle` removed** → natively-black only, no light mode. (Directive: no dark-mode toggle.)
- **`glass-rail` blurred header → solid-canvas header.** (Directive forbids glassmorphism/backdrop-blur.)

## Architecture

Three units, clear boundaries:

### 1. `components/wc26-shell-header.tsx` (new, presentational)

The unified chrome. Pure component (no client-only hooks, no server-only APIs) so it renders in both server (`WCS26Shell`) and client (`CommandShell`) parents.

```tsx
type SystemHealth = import("@/lib/command-data").SystemHealth;
type NavItem = { label: string; href: string; routeKey: string };
export const WC26_NAV: NavItem[]; // 6 items
export function WC26ShellHeader(props: {
  route: string;            // matched against NavItem.routeKey
  systemHealth: SystemHealth;
}): JSX.Element;
```

- Renders: brand ("WC26"), 6-item nav (active state from `route`), status dot + NOMINAL/WARNING/BREACH, and the status-rail metrics (graded count, Calibration status, ECE %). Solid `var(--canvas)` background, `border-b var(--line)` — no `glass-rail`.
- `WC26_NAV` items carry an explicit `routeKey` (`home`/`command`/`matches`/`record`/`teams`/`simulator`). Active state is `item.routeKey === props.route` — **not** href-tail parsing (avoids substring collisions). Routes not in the nav (`groups`/`players`/`sentiment`) pass a `route` matching no `routeKey`, so they render with no active highlight — expected.

### 2. `components/wc26-shell.tsx` → `WCS26Shell` (new, server component)

Drop-in replacement for `AppChrome` on content routes. Same prop surface so page swaps are 1-line.

```tsx
export function WCS26Shell(props: {
  children: React.ReactNode;
  route: string;
  eyebrow?: string;   // default "World Cup 2026"
  title?: string;
  rail?: React.ReactNode;
  fullBleed?: boolean;
}): JSX.Element;
```

- Computes `systemHealth` **once per page render, server-side**: imports `predictions.json` + `wc26-accountability.json`, calls `buildSystemHealth(accountability, predictions.length)` — same source as `/command`. Child pages do **not** wire health; they pass nothing health-related.
- Layout: `<WC26ShellHeader route systemHealth />` → optional per-page hero block (the existing `title`/`eyebrow`/`rail` markup ported verbatim from `AppChrome` lines 86–97) → `<main className="mx-auto max-w-7xl px-6 py-10 md:py-14">{children}</main>` (or bare `<main>{children}</main>` when `fullBleed`).
- No `CinematicBackdrop`, no `ThemeToggle`, no `MobileTabBar`.

### 3. `components/command/command-shell.tsx` (refactor)

`CommandShell` **already receives `systemHealth` as a prop** (computed by `/command/page.tsx`). Replace its inline nav (`NAV_TABS`) + status rail markup with `<WC26ShellHeader route="command" systemHealth={systemHealth} />`, passing the prop straight through. Keep the 3-column client body + footer (Reliability Timeline + Learning Signals) unchanged. `CommandShell` stays a client component; the shared header is pure so it composes fine. (`/command` keeps its command-specific status-rail extras — `nextClosing`, `matchdayLabel` — below or beside the shared header as today; only the nav + core integrity metrics move into the shared component.)

### 4. `scripts/design-inspector.mts` (update — ships in P1, same commit as shell creation)

The `page-shell` rule (line 147) currently requires every non-exempt `page.tsx` to contain `["<AppChrome", "<RouteStack"]`. A phased rollout means migrated and un-migrated pages coexist, so during transition the rule must accept **either** shell:

- **P1 edit:** change the required-shell check so a page passes if it contains `<RouteStack` **and** (`<AppChrome` **or** `<WCS26Shell`). Keep `<RouteStack`, `<CanvasSection`, and all other page rules intact. This lets the 2 migrated pages and the 10 un-migrated pages both pass.
- **P2 edit (after all 12 migrated + `app-chrome.tsx` deleted):** tighten to require `<WCS26Shell` only, and **remove the dead `mobile-nav` rule** (lines 225–232) — it keys on `components/app-chrome.tsx`, which no longer exists, and mobile nav is intentionally dropped.
- **Untouched:** the `SiteHeader` ban (still valid), `cinematic.tsx` `layout-primitives` + `no-box-primitives` rules (we do not touch `cinematic.tsx`).

### Deletion

After P2, delete `components/app-chrome.tsx` — this removes `AppChrome` **and** the inline `MobileTabBar` **and** the inline `CinematicBackdrop` (all three live in that one file).

- **Do NOT touch `components/cinematic.tsx`.** It exports the layout primitives (`RouteStack`, `CanvasSection`, `DataPlane`, `SignalLine`) used by every page and **required** by the inspector's `layout-primitives` rule. `CinematicBackdrop` is *not* exported from it.
- **`ThemeToggle` orphan check** before deletion: run `grep -rn "ThemeToggle" --include="*.tsx" --include="*.ts" .`. Expected after migration: only its own definition file (`components/theme-toggle.tsx`) and `app-chrome.tsx`. If so, delete `theme-toggle.tsx` too. If any other consumer exists, leave it.

## File Changes

| File | Change | Phase |
|------|--------|-------|
| `components/wc26-shell-header.tsx` | **new** — shared nav + status rail | P1 |
| `components/wc26-shell.tsx` | **new** — server shell wrapper | P1 |
| `components/command/command-shell.tsx` | use shared header | P1 |
| `scripts/design-inspector.mts` | page-shell rule accepts AppChrome **or** WCS26Shell | P1 |
| `app/page.tsx` | `AppChrome` → `WCS26Shell` (route="home") | P1 |
| `app/matches/page.tsx` | `AppChrome` → `WCS26Shell` (route="matches") | P1 |
| `app/groups/page.tsx` | swap (route="groups") | P2 |
| `app/teams/page.tsx` | swap (route="teams") | P2 |
| `app/record/page.tsx` | swap (route="record") | P2 |
| `app/simulator/page.tsx` | swap (route="simulator") | P2 |
| `app/players/page.tsx` | swap (route="players") | P2 |
| `app/players/[id]/page.tsx` | swap | P2 |
| `app/sentiment/page.tsx` | swap (route="sentiment") | P2 |
| `app/sentiment/[slug]/page.tsx` | swap | P2 |
| `app/fixture/[slug]/page.tsx` | swap | P2 |
| `app/team/[id]/page.tsx` | swap | P2 |
| `scripts/design-inspector.mts` | tighten to WCS26Shell-only; drop `mobile-nav` rule | P2 |
| `components/theme-toggle.tsx` | **delete** if orphaned (grep first) | P2 |
| `components/app-chrome.tsx` | **delete** | P2 |

## Constraints

- **Next.js 16.2.6 breaking changes** — per `app/AGENTS.md`, read `node_modules/next/dist/docs/` before shell/layout edits.
- **No content regressions.** Page bodies, data wiring, and `title`/`eyebrow`/`rail`/`fullBleed` usage preserved exactly. Only the wrapper changes.
- **`globals.css` tokens unchanged.** Pure layout/chrome unification.
- **Design-inspector must stay green** — the house guardrail (`scripts/design-inspector.mts`). New chrome must use scale tokens, `tabular`/`data-mono` for numerics, `duration-300`/`var(--dur)` motion, no arbitrary px, no raw hex outside allowed files.
- Each page swap must keep the page's existing `route` string value where the nav maps it; pages outside the 6-nav simply have no active item.

## Verification

Per phase:
1. `npm run lint` (touched files clean), `npm run build`, `npx vitest run` (241 baseline), `node --import tsx scripts/design-inspector.mts` (passes).
2. Live screenshots on `localhost:3000` for migrated routes: confirm unified header + status rail, per-page hero intact, content unchanged, no `glass-rail`/cinematic, no console errors.
3. After P2: grep confirms zero `AppChrome` / `MobileTabBar` references remain; `app-chrome.tsx` deleted; `ThemeToggle` removed if orphaned.

## Success Criteria

- Every route renders the identical WC26 header (6-nav + status rail) with correct active state.
- `/command` 3-column body + footer unchanged and functional.
- All 11 content pages keep their bodies and per-page heroes; only chrome changed.
- `AppChrome`, `MobileTabBar`, `CinematicBackdrop` fully removed.
- build + 241 tests + design-inspector green; no console errors.
