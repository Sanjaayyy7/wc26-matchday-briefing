import { describe, it, expect } from "vitest";
import { brierBar } from "../lib/brier-bar";

describe("brierBar", () => {
  it("green (--up) below 0.50", () => {
    expect(brierBar(0.3)).toEqual({ widthPct: 30, colorVar: "var(--up)" });
  });
  it("amber (--warn) in 0.50–0.75 inclusive", () => {
    expect(brierBar(0.5).colorVar).toBe("var(--warn)");
    expect(brierBar(0.721)).toEqual({ widthPct: 72.1, colorVar: "var(--warn)" });
    expect(brierBar(0.75).colorVar).toBe("var(--warn)");
  });
  it("red (--down) above 0.75", () => {
    expect(brierBar(0.9)).toEqual({ widthPct: 90, colorVar: "var(--down)" });
  });
  it("caps width at 100%", () => {
    expect(brierBar(1.5)).toEqual({ widthPct: 100, colorVar: "var(--down)" });
  });
});
