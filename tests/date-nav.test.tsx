import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { nextTabIndex } from "@/components/date-nav";

// ── Pure keyboard-logic tests (no DOM) ─────────────────────────────────────

describe("nextTabIndex", () => {
  it("ArrowRight moves right by 1", () => {
    expect(nextTabIndex("ArrowRight", 0, 3)).toBe(1);
    expect(nextTabIndex("ArrowRight", 1, 3)).toBe(2);
  });

  it("ArrowRight clamps at the last index", () => {
    expect(nextTabIndex("ArrowRight", 2, 3)).toBe(2);
  });

  it("ArrowLeft moves left by 1", () => {
    expect(nextTabIndex("ArrowLeft", 2, 3)).toBe(1);
    expect(nextTabIndex("ArrowLeft", 1, 3)).toBe(0);
  });

  it("ArrowLeft clamps at 0", () => {
    expect(nextTabIndex("ArrowLeft", 0, 3)).toBe(0);
  });

  it("Home moves to first index", () => {
    expect(nextTabIndex("Home", 2, 3)).toBe(0);
  });

  it("End moves to last index", () => {
    expect(nextTabIndex("End", 0, 3)).toBe(2);
  });

  it("other keys return current index unchanged", () => {
    expect(nextTabIndex("Tab", 1, 3)).toBe(1);
    expect(nextTabIndex("Enter", 0, 3)).toBe(0);
  });
});

// ── Static rendering tests ─────────────────────────────────────────────────

import { DateNav } from "@/components/date-nav";

const GROUPS = [
  { dateISO: "2026-06-23", label: "Yesterday", views: [] as never[] },
  { dateISO: "2026-06-24", label: "Today", views: [] as never[] },
  { dateISO: "2026-06-25", label: "Tomorrow", views: [] as never[] },
];

describe("DateNav static rendering", () => {
  it("renders a tablist role", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={1} onSelect={() => {}} />,
    );
    expect(html).toContain('role="tablist"');
  });

  it("renders one tab per group", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={1} onSelect={() => {}} />,
    );
    const tabCount = (html.match(/role="tab"/g) ?? []).length;
    expect(tabCount).toBe(GROUPS.length);
  });

  it("marks the selected tab with aria-selected=true", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={1} onSelect={() => {}} />,
    );
    expect(html).toContain('aria-selected="true"');
  });

  it("non-selected tabs have aria-selected=false", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={1} onSelect={() => {}} />,
    );
    const falseCount = (html.match(/aria-selected="false"/g) ?? []).length;
    expect(falseCount).toBe(GROUPS.length - 1);
  });

  it("renders each group label", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={0} onSelect={() => {}} />,
    );
    for (const g of GROUPS) {
      expect(html).toContain(g.label);
    }
  });

  it("selected tab has tabIndex=0, others have tabIndex=-1", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={2} onSelect={() => {}} />,
    );
    // One tabIndex="0" for selected
    const zero = (html.match(/tabindex="0"/gi) ?? []).length;
    expect(zero).toBe(1);
    // Two tabIndex="-1" for the others
    const neg = (html.match(/tabindex="-1"/gi) ?? []).length;
    expect(neg).toBe(GROUPS.length - 1);
  });

  it("renders a Today jump button", () => {
    const html = renderToStaticMarkup(
      <DateNav groups={GROUPS} selected={0} onSelect={() => {}} />,
    );
    expect(html.toLowerCase()).toContain("today");
  });
});
