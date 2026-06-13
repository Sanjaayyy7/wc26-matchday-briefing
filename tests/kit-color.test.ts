import { describe, it, expect } from "vitest";
import { kitAccent, stageVar, verdictVar } from "@/lib/kit-color";

describe("kitAccent", () => {
  it("returns the kit hex when contrast clears 3:1 against both canvases", () => {
    // #0a84ff (round-of-32 blue): contrast vs light canvas (#f5f5f7) ~3.35:1,
    // contrast vs dark canvas (#0b0b0c) ~5.37:1 — both clear 3:1.
    expect(kitAccent("#0a84ff", "up")).toBe("#0a84ff");
  });

  it("falls back to var(--down) when the kit is near-black (fails the dark canvas)", () => {
    // #000000 vs dark canvas (#0b0b0c): ratio ~1.07:1 — fails 3:1.
    expect(kitAccent("#000000", "down")).toBe("var(--down)");
  });

  it("falls back to var(--up) when the kit is near-white (fails the light canvas)", () => {
    // #ffffff vs light canvas (#f5f5f7): ratio ~1.09:1 — fails 3:1.
    expect(kitAccent("#ffffff", "up")).toBe("var(--up)");
  });

  it("falls back for a real near-white kit color", () => {
    // #f0f0f0 vs light canvas (#f5f5f7): ratio ~1.05:1 — fails 3:1.
    expect(kitAccent("#f0f0f0", "down")).toBe("var(--down)");
  });

  it("returns the correct fallback var name for each fallback argument", () => {
    expect(kitAccent("#ffffff", "up")).toBe("var(--up)");
    expect(kitAccent("#ffffff", "down")).toBe("var(--down)");
  });
});

describe("stageVar", () => {
  it("maps each data.ts stage value to its CSS var reference", () => {
    expect(stageVar("group")).toBe("var(--stage-group)");
    expect(stageVar("round-of-32")).toBe("var(--stage-r32)");
    expect(stageVar("round-of-16")).toBe("var(--stage-r16)");
    expect(stageVar("quarter-final")).toBe("var(--stage-qf)");
    expect(stageVar("semi-final")).toBe("var(--stage-sf)");
    expect(stageVar("final")).toBe("var(--stage-final)");
  });

  it("falls back gracefully for an unknown stage", () => {
    // @ts-expect-error - testing unknown/undefined input handling
    expect(stageVar("not-a-stage")).toBe("var(--stage-group)");
    expect(stageVar(undefined)).toBe("var(--stage-group)");
  });
});

describe("verdictVar", () => {
  it("maps each verdict to its CSS var reference", () => {
    expect(verdictVar("hit")).toBe("var(--verdict-hit)");
    expect(verdictVar("close")).toBe("var(--verdict-close)");
    expect(verdictVar("miss")).toBe("var(--verdict-miss)");
  });
});
