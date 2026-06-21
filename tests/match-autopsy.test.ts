// tests/match-autopsy.test.ts
import { describe, it, expect } from "vitest";
import { buildAutopsy } from "../lib/match-autopsy";

describe("buildAutopsy", () => {
  it("Spain 94/5/1 ending 0-0: top pick home, realized draw (the #2 at 5%), miss + draw underrated", () => {
    const a = buildAutopsy({ home: 94, draw: 5, away: 1 }, 0, 0);
    expect(a.topLabel).toBe("home");
    expect(a.topPct).toBe(94);
    expect(a.realized).toBe("draw");
    expect(a.actualPct).toBe(5);
    expect(a.correct).toBe(false);
    expect(a.drawUnderrated).toBe(true);
  });

  it("home win the model favored: correct, not draw-underrated", () => {
    const a = buildAutopsy({ home: 60, draw: 25, away: 15 }, 2, 0);
    expect(a.realized).toBe("home");
    expect(a.topLabel).toBe("home");
    expect(a.correct).toBe(true);
    expect(a.drawUnderrated).toBe(false);
  });

  it("away win the model favored: correct", () => {
    const a = buildAutopsy({ home: 20, draw: 30, away: 50 }, 0, 1);
    expect(a.realized).toBe("away");
    expect(a.topLabel).toBe("away");
    expect(a.actualPct).toBe(50);
    expect(a.correct).toBe(true);
  });

  it("draw the model rated highest: correct, not underrated", () => {
    const a = buildAutopsy({ home: 30, draw: 40, away: 30 }, 1, 1);
    expect(a.realized).toBe("draw");
    expect(a.topLabel).toBe("draw");
    expect(a.correct).toBe(true);
    expect(a.drawUnderrated).toBe(false);
  });
});
