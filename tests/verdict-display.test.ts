import { describe, it, expect } from "vitest";
import { verdictDisplay } from "@/lib/verdict-display";

describe("verdictDisplay", () => {
  it("maps hit to a positive label and check icon", () => {
    expect(verdictDisplay("hit")).toEqual({ label: "Hit", icon: "✓" });
  });

  it("maps close to a tilde icon", () => {
    expect(verdictDisplay("close")).toEqual({ label: "Close", icon: "~" });
  });

  it("maps miss to a cross icon", () => {
    expect(verdictDisplay("miss")).toEqual({ label: "Miss", icon: "✗" });
  });
});
