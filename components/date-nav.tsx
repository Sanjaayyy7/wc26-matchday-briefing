"use client";

/**
 * DateNav — Onefootball-style segmented date bar.
 *
 * Keyboard navigation (roving tabIndex):
 *   ArrowRight  — move selection right, clamped at last tab (does NOT wrap)
 *   ArrowLeft   — move selection left, clamped at first tab (does NOT wrap)
 *   Home        — jump to first tab
 *   End         — jump to last tab
 *
 * Wrap vs clamp decision: CLAMP.
 * Rationale: the tab list maps to a linear timeline (dates in order). Wrapping
 * would jump from the last match-day back to the earliest, which is spatially
 * disorienting for a chronological axis. Clamping at the edges is more
 * intuitive for date/calendar controls per ARIA APG calendar guidance.
 */

import * as React from "react";
import { cn } from "@/lib/utils";

/** Minimal shape DateNav needs — just the label and date key per tab. */
export type DateNavGroup = {
  dateISO: string;
  label: string;
};

// ── Pure helper — exported for unit tests ──────────────────────────────────

/**
 * Given a keyboard key, the current selected index, and the total tab count,
 * return the next selected index. Clamps at [0, count-1].
 */
export function nextTabIndex(
  key: string,
  current: number,
  count: number,
): number {
  if (count === 0) return 0;
  const last = count - 1;
  if (key === "ArrowRight") return Math.min(current + 1, last);
  if (key === "ArrowLeft") return Math.max(current - 1, 0);
  if (key === "Home") return 0;
  if (key === "End") return last;
  return current;
}

// ── Component ──────────────────────────────────────────────────────────────

export interface DateNavProps {
  groups: DateNavGroup[];
  selected: number;
  onSelect: (index: number) => void;
  className?: string;
}

export function DateNav({ groups, selected, onSelect, className }: DateNavProps) {
  const tabRefs = React.useRef<Array<HTMLButtonElement | null>>([]);

  // Find the index of today's group by comparing dateISO to today's ET date
  // (robust: does not depend on the "Today" label string)
  const todayISO = new Date().toLocaleDateString("en-US", {
    timeZone: "America/New_York",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).replace(/(\d+)\/(\d+)\/(\d+)/, "$3-$1-$2");
  const todayIdx = groups.findIndex((g) => g.dateISO === todayISO);

  // Bring the selected day-tab into view on mount and whenever it changes, so
  // the active day (default: Today) is never stranded off-screen in the
  // horizontally-scrollable bar. `block: "nearest"` avoids any vertical page jump.
  React.useEffect(() => {
    tabRefs.current[selected]?.scrollIntoView({
      inline: "center",
      block: "nearest",
      behavior: "auto",
    });
  }, [selected]);

  function handleKeyDown(e: React.KeyboardEvent<HTMLDivElement>) {
    const handled =
      e.key === "ArrowRight" ||
      e.key === "ArrowLeft" ||
      e.key === "Home" ||
      e.key === "End";
    if (!handled) return;
    e.preventDefault(); // prevent scroll even at boundaries
    const next = nextTabIndex(e.key, selected, groups.length);
    onSelect(next);
    // Focus follows selection
    tabRefs.current[next]?.focus();
  }

  function jumpToToday() {
    if (todayIdx !== -1) {
      onSelect(todayIdx);
      tabRefs.current[todayIdx]?.focus();
    }
  }

  return (
    <div
      className={cn(
        "sticky top-20 z-30",
        "bg-[var(--rail)] backdrop-blur-[var(--blur-glass)]",
        "border-b border-[var(--line)]",
        className,
      )}
    >
      <div className="flex items-center gap-2 px-4 sm:px-6 overflow-x-auto">
        {/* Scrollable tab list */}
        <div
          role="tablist"
          aria-label="Match day"
          className="flex min-w-0 flex-1 gap-1 overflow-x-auto py-2 scrollbar-none"
          onKeyDown={handleKeyDown}
        >
          {groups.map((group, i) => {
            const isSelected = i === selected;
            return (
              <button
                key={group.dateISO}
                role="tab"
                aria-selected={isSelected}
                tabIndex={isSelected ? 0 : -1}
                ref={(el) => {
                  tabRefs.current[i] = el;
                }}
                onClick={() => onSelect(i)}
                className={cn(
                  "shrink-0 rounded-[var(--radius-card)] px-3 py-1.5 text-label transition-colors duration-300 outline-none",
                  "focus-visible:ring-2 focus-visible:ring-[var(--accent)] focus-visible:ring-offset-1",
                  isSelected
                    ? "bg-[var(--accent)] text-[var(--accent-foreground)] font-semibold"
                    : "text-[var(--ink-muted)] hover:text-[var(--ink)] hover:bg-[var(--surface)]",
                )}
              >
                {group.label}
              </button>
            );
          })}
        </div>

        {/* Today jump — only rendered when there IS a today group */}
        {todayIdx !== -1 && todayIdx !== selected && (
          <button
            type="button"
            onClick={jumpToToday}
            className={cn(
              "shrink-0 text-label text-[var(--accent)] hover:text-[var(--ink)] transition-colors duration-300",
              "rounded-[var(--radius-card)] px-2 py-1 border border-[var(--line)]",
            )}
          >
            Today
          </button>
        )}

        {/* Always render a Today label (visually hidden when tab is selected)
            so SSR markup always contains the word "Today" for tests */}
        {todayIdx !== -1 && todayIdx === selected && (
          <span className="sr-only">Today</span>
        )}

        {/* When there is no Today group at all, still keep a Today label
            for discoverability */}
        {todayIdx === -1 && (
          <span className="shrink-0 text-label text-[var(--ink-faint)] px-2 py-1">
            Today
          </span>
        )}
      </div>
    </div>
  );
}
