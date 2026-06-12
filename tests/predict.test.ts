import { describe, it, expect } from "vitest";
import { predictFixture, resolveTeamName, roundTo100 } from "@/lib/predict";
import { buildPreviewMarkdown, buildFollowUpMarkdown } from "@/lib/briefing-template";
import { parsePreview } from "@/lib/preview-parser";
import { parseFollowUp } from "@/lib/followup-parser";

describe("resolveTeamName", () => {
  it("maps app names to dataset names", () => {
    expect(resolveTeamName("Türkiye")).toBe("Turkey");
    expect(resolveTeamName("Bosnia & Herzegovina")).toBe("Bosnia and Herzegovina");
    expect(resolveTeamName("Brazil")).toBe("Brazil");
  });
  it("throws on unknown teams instead of silently predicting garbage", () => {
    expect(() => resolveTeamName("Narnia")).toThrow();
  });
});

describe("roundTo100", () => {
  it("largest-remainder rounding always sums to exactly 100", () => {
    const r = roundTo100([0.575, 0.245, 0.18]);
    expect(r[0] + r[1] + r[2]).toBe(100);
    const r2 = roundTo100([1 / 3, 1 / 3, 1 / 3]);
    expect(r2[0] + r2[1] + r2[2]).toBe(100);
  });
});

describe("predictFixture", () => {
  const p = predictFixture({ home: "Brazil", away: "Morocco", neutral: true, stage: "group" });

  it("probabilities sum to exactly 100", () => {
    expect(p.split.home + p.split.draw + p.split.away).toBe(100);
  });
  it("Brazil favored over Morocco on current ratings", () => {
    expect(p.split.home).toBeGreaterThan(p.split.away);
  });
  it("exposes elo, form, lambdas, grid summary", () => {
    expect(p.elo.home).toBeGreaterThan(1500);
    expect(p.form.home.results.length).toBeGreaterThan(0);
    expect(p.summary.btts).toBeGreaterThan(0);
    expect(p.summary.btts).toBeLessThan(1);
  });
  it("group stage has no advancement; knockout does", () => {
    expect(p.advancement).toBeUndefined();
    const ko = predictFixture({ home: "Brazil", away: "Morocco", neutral: true, stage: "round-of-16" });
    expect(ko.advancement).toBeDefined();
    expect(ko.advancement!.prob).toBeGreaterThan(ko.split.home / 100);
  });
  it("confidence band follows the v2 mapping", () => {
    const top = Math.max(p.split.home, p.split.draw, p.split.away);
    if (top < 40) expect(p.band).toContain("coin-flip");
    else if (top <= 55) expect(p.band).toBe("lean");
    else if (top <= 70) expect(p.band).toBe("fairly confident");
    else expect(p.band).toBe("strong");
  });
});

describe("buildPreviewMarkdown — Output Contract compatibility", () => {
  const p = predictFixture({ home: "Brazil", away: "Morocco", neutral: true, stage: "group" });
  const md = buildPreviewMarkdown(p, { homeName: "Brazil", awayName: "Morocco" });
  const parsed = parsePreview(md);

  it("parses ok under the app parser", () => {
    expect(parsed.ok).toBe(true);
  });
  it("probabilities survive the round trip and sum to 100", () => {
    const q = parsed.probabilities!;
    expect(q.home + q.draw + q.away).toBe(100);
    expect(q.home).toBe(p.split.home);
  });
  it("scoreline matches the model's most likely score", () => {
    expect(parsed.scoreline!.home).toBe(p.summary.mostLikely.home);
    expect(parsed.scoreline!.away).toBe(p.summary.mostLikely.away);
  });
  it("extracts all three Why bullets and uncertainties", () => {
    expect(parsed.why).not.toBeNull();
    expect(parsed.uncertainties!.length).toBeGreaterThan(0);
  });
  it("knockout variant appends Who goes through without breaking parsing", () => {
    const ko = predictFixture({ home: "Brazil", away: "Morocco", neutral: true, stage: "round-of-16" });
    const koMd = buildPreviewMarkdown(ko, { homeName: "Brazil", awayName: "Morocco" });
    expect(koMd).toContain("**Who goes through:**");
    expect(parsePreview(koMd).ok).toBe(true);
  });
});

describe("buildFollowUpMarkdown", () => {
  const p = predictFixture({ home: "Brazil", away: "Morocco", neutral: true, stage: "group" });

  it("BTTS answer parses under the follow-up parser with a percentage", () => {
    const md = buildFollowUpMarkdown("Both teams to score — what's the chance?", p, {
      homeName: "Brazil",
      awayName: "Morocco",
    });
    const f = parseFollowUp(md);
    expect(f.ok).toBe(true);
    expect(f.number).toMatch(/\d+%/);
  });
  it("over 2.5 question gets the over/under number", () => {
    const md = buildFollowUpMarkdown("over 2.5 goals?", p, {
      homeName: "Brazil",
      awayName: "Morocco",
    });
    expect(md).toMatch(new RegExp(`${Math.round(p.summary.over25 * 100)}%`));
  });
  it("unknown question gets an honest can't-compute answer that still parses", () => {
    const md = buildFollowUpMarkdown("who scores first?", p, {
      homeName: "Brazil",
      awayName: "Morocco",
    });
    const f = parseFollowUp(md);
    expect(f.ok).toBe(true);
    expect(md.toLowerCase()).toContain("model");
  });
});
