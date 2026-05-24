import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parsePreview } from "@/lib/preview-parser";

const fx = (name: string) =>
  readFileSync(path.resolve(__dirname, "fixtures", name), "utf8");

describe("parsePreview - well-formed reply", () => {
  const result = parsePreview(fx("worked-example.txt"));

  it("flags ok=true", () => {
    expect(result.ok).toBe(true);
  });

  it("extracts the quick take sentence", () => {
    expect(result.quickTake).toMatch(/Arsenal should win/);
  });

  it("extracts the scoreline 2-0 home favored", () => {
    expect(result.scoreline).toEqual({ home: 2, away: 0, favored: "home" });
  });

  it("extracts probabilities summing to 100", () => {
    const p = result.probabilities!;
    expect(p.home).toBe(72);
    expect(p.draw).toBe(18);
    expect(p.away).toBe(10);
    expect(p.home + p.draw + p.away).toBe(100);
    expect(p.confidence.toLowerCase()).toContain("fairly confident");
  });

  it("extracts three Why bullets", () => {
    expect(result.why?.tactical).toMatch(/Burnley defend/);
    expect(result.why?.personnel).toMatch(/Saliba/);
    expect(result.why?.formContext).toMatch(/Emirates/);
  });

  it("extracts the flip factor", () => {
    expect(result.flipFactor).toMatch(/Burnley goal from a set piece/);
  });

  it("extracts uncertainty bullets", () => {
    expect(result.uncertainties?.[0]).toMatch(/lineups/);
  });
});

describe("parsePreview - degraded reply", () => {
  const result = parsePreview(fx("degraded.txt"));

  it("flags ok=false", () => {
    expect(result.ok).toBe(false);
  });

  it("still returns raw text for fallback rendering", () => {
    expect(result.raw.length).toBeGreaterThan(40);
  });
});

describe("parsePreview - partial stream", () => {
  it("returns ok=false but populated quickTake when only the first section has arrived", () => {
    const partial = "**Quick take:** Arsenal should win.";
    const r = parsePreview(partial);
    expect(r.quickTake).toMatch(/Arsenal should win/);
    expect(r.ok).toBe(false);
  });
});
