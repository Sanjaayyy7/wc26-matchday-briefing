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

  it("honors PROMPT_FILE env override (cache keyed by path)", () => {
    const prev = process.env.PROMPT_FILE;
    process.env.PROMPT_FILE = "../wc-analyst-system-prompt-v2.md";
    try {
      const text = getSystemPrompt();
      expect(text).toContain("# DATA DISCIPLINE");
      expect(text).toContain("{MARKET_SNAPSHOT");
    } finally {
      if (prev === undefined) delete process.env.PROMPT_FILE;
      else process.env.PROMPT_FILE = prev;
    }
  });
});
