import { describe, it, expect } from "vitest";
import { getSystemPrompt } from "@/lib/prompt-loader";

describe("getSystemPrompt", () => {
  it("returns the full PL analyst system prompt with all six layers", () => {
    const text = getSystemPrompt();
    expect(text).toContain("# ROLE");
    expect(text).toContain("# AUDIENCE");
    expect(text).toContain("# CONTEXT FOR THIS SESSION");
    expect(text).toContain("# REASONING SCAFFOLD");
    expect(text).toContain("# OUTPUT CONTRACT");
    expect(text).toContain("# FOLLOW-UP PROTOCOL");
    expect(text).toContain("# GUARDRAILS");
  });

  it("caches the read (returns identical reference on repeat calls)", () => {
    expect(getSystemPrompt()).toBe(getSystemPrompt());
  });
});
