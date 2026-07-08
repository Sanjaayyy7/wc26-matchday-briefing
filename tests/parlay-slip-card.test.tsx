// tests/parlay-slip-card.test.tsx
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ParlaySlipCard } from "../components/parlay-slip-card";
import type { ParlaySlipView } from "../lib/parlay-view";

const base = {
  slug: "spain-vs-belgium",
  matchup: "Spain vs Belgium",
  stage: "quarter-final",
  kickoffISO: "2026-07-10T19:00:00Z",
  lockedAt: "2026-07-08T17:00:00Z",
};

const gradedMiss: ParlaySlipView = {
  ...base,
  status: "miss",
  jointProb: 0.552,
  legs: [
    { ticker: "T1", side: "no", title: "Will over 5.5 goals be scored?", modelProb: 0.961, kalshiMid: 0.945, reasoning: "r1", hit: true },
    { ticker: "T2", side: "yes", title: "Spain wins?", modelProb: 0.62, kalshiMid: null, reasoning: "r2", hit: false },
  ],
};

describe("ParlaySlipCard", () => {
  it("graded slip renders per-leg ✓/✗, joint prob, and model vs Kalshi", () => {
    const html = renderToStaticMarkup(<ParlaySlipCard slip={gradedMiss} />);
    expect(html).toContain("Spain vs Belgium");
    expect(html).toContain("✓");
    expect(html).toContain("✗");
    expect(html).toContain("55.2%"); // joint
    expect(html).toContain("96.1%"); // model leg prob
    expect(html).toContain("94.5%"); // kalshi side mid
    expect(html).toContain("n/a"); // null kalshiMid leg
    expect(html).toContain("Miss"); // slip verdict, rendered as prominently as a hit
    expect(html).toContain("r1"); // reasoning present in the expandable section
  });

  it("open slip renders no ✓/✗ and an open status", () => {
    const open: ParlaySlipView = { ...gradedMiss, status: "open", legs: gradedMiss.legs.map((l) => ({ ...l, hit: null })) };
    const html = renderToStaticMarkup(<ParlaySlipCard slip={open} />);
    expect(html).not.toContain("✓");
    expect(html).not.toContain("✗");
    expect(html).toContain("Open");
  });

  it("no-slip record renders the machine-checkable reason", () => {
    const noSlip: ParlaySlipView = { ...base, status: "no-slip", reason: "no 2-leg combo ≥ floors", legs: [] };
    const html = renderToStaticMarkup(<ParlaySlipCard slip={noSlip} />);
    expect(html).toContain("No slip");
    expect(html).toContain("no 2-leg combo ≥ floors");
  });
});
