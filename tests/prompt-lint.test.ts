import { describe, it, expect } from "vitest";
import { readFileSync, existsSync } from "node:fs";
import path from "node:path";
import { parsePreview } from "@/lib/preview-parser";
import { parseFollowUp } from "@/lib/followup-parser";

// Structural eval (audit-ledger L-04, L-05, L-13, L-15): the v2 prompt suite
// must stay byte-compatible with the app's Output Contract parsers.

// The v2 prompt assets live at the workspace root in local dev (README/), but
// are not part of the deployed app repo. Resolve from either location and skip
// the suite gracefully when absent (e.g. CI) instead of crashing the run.
const PROMPT_FILE = "wc-analyst-system-prompt-v2.md";
const EXAMPLE_FILE = "wc-analyst-worked-example-v2.md";
const promptDir = [path.resolve(__dirname, "..", ".."), path.resolve(__dirname, "..")].find((dir) =>
  existsSync(path.join(dir, PROMPT_FILE)),
);
const present = promptDir !== undefined;
const v2Prompt = present ? readFileSync(path.join(promptDir!, PROMPT_FILE), "utf8") : "";
const v2Example = present ? readFileSync(path.join(promptDir!, EXAMPLE_FILE), "utf8") : "";
const d = present ? describe : describe.skip;

/** Pull a blockquoted model reply out of the worked-example markdown. */
function extractReply(source: string, afterHeading: string): string {
  const start = source.indexOf(afterHeading);
  if (start === -1) throw new Error(`heading not found: ${afterHeading}`);
  const tail = source.slice(start + afterHeading.length);
  const lines: string[] = [];
  let inQuote = false;
  for (const line of tail.split("\n")) {
    if (line.startsWith(">")) {
      inQuote = true;
      lines.push(line.replace(/^>\s?/, ""));
    } else if (inQuote && line.trim() === "") {
      break;
    }
  }
  return lines.join("\n");
}

d("v2 system prompt - parser contract tokens", () => {
  const headings = [
    "**Quick take",
    "**Most likely scoreline:**",
    "**Win probability split:**",
    "**Why",
    "**What would flip it:**",
    "**Things I'm not sure about:**",
    "**Who goes through:**",
    "**Short answer:**",
    "**The mechanism:**",
    "**The number:**",
    "**Caveat for a teenager quoting his mates:**",
  ];
  for (const h of headings) {
    it(`contains contract heading ${h}`, () => {
      expect(v2Prompt).toContain(h);
    });
  }

  const placeholders = [
    "{HOME_TEAM}",
    "{AWAY_TEAM}",
    "{STAGE}",
    "{VENUE}",
    "{VENUE_TZ}",
    "{KICKOFF_LOCAL}",
    "{NOW_LOCAL}",
    "{TODAY}",
    "{VERIFIED_FACTS",
    "{MARKET_SNAPSHOT",
    "{LENGTH",
    "{PRIVATE_NOTES",
  ];
  for (const p of placeholders) {
    it(`contains placeholder ${p}`, () => {
      expect(v2Prompt).toContain(p);
    });
  }

  it("keeps the probability split shape the parser regex expects", () => {
    expect(v2Prompt).toContain("Home XX% / Draw XX% / Away XX%");
  });

  it("self-checks probability sums (L-05)", () => {
    expect(v2Prompt).toMatch(/sum to (between )?98.{1,4}102/i);
  });
});

d("v2 worked example - turn 1 parses under the app parser", () => {
  const turn1 = extractReply(v2Example, "## Turn 1 — Model reply");
  const result = parsePreview(turn1);

  it("flags ok=true", () => {
    expect(result.ok).toBe(true);
  });

  it("extracts the 90-minute scoreline", () => {
    expect(result.scoreline).toEqual({ home: 2, away: 1, favored: "home" });
  });

  it("probabilities sum within 98-102 (L-05)", () => {
    const p = result.probabilities!;
    const sum = p.home + p.draw + p.away;
    expect(sum).toBeGreaterThanOrEqual(98);
    expect(sum).toBeLessThanOrEqual(102);
  });

  it("confidence word matches the banded mapping (L-08): top outcome 40-55 => lean", () => {
    const p = result.probabilities!;
    const top = Math.max(p.home, p.draw, p.away);
    expect(top).toBeGreaterThanOrEqual(40);
    expect(top).toBeLessThanOrEqual(55);
    expect(p.confidence.toLowerCase()).toContain("lean");
  });

  it("extracts all three Why bullets", () => {
    expect(result.why?.tactical).toBeTruthy();
    expect(result.why?.personnel).toBeTruthy();
    expect(result.why?.formContext).toBeTruthy();
  });

  it("extracts uncertainties", () => {
    expect(result.uncertainties?.length).toBeGreaterThan(0);
  });
});

d("v2 worked example - knockout append stays parser-safe (L-04/L-22)", () => {
  const turn1 = extractReply(v2Example, "## Turn 1 — Model reply");
  const withAdvancement =
    turn1 +
    "\n\n**Who goes through:** Brazil advance, 63% (extra time and penalties folded in).";
  const result = parsePreview(withAdvancement);

  it("still parses ok=true with the appended section", () => {
    expect(result.ok).toBe(true);
  });

  it("uncertainties do not swallow the appended section", () => {
    const last = result.uncertainties?.at(-1) ?? "";
    expect(last).not.toMatch(/Who goes through/i);
    expect(last).not.toMatch(/advance/i);
  });
});

d("v2 worked example - turn 2 parses under the follow-up parser", () => {
  const turn2 = extractReply(v2Example, "## Turn 2 — Model reply");
  const result = parseFollowUp(turn2);

  it("flags ok=true", () => {
    expect(result.ok).toBe(true);
  });

  it("extracts a percentage in The number", () => {
    expect(result.number).toMatch(/\d+%/);
  });

  it("caveat present", () => {
    expect(result.caveat).toBeTruthy();
  });
});
