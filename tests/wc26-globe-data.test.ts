import { describe, it, expect } from "vitest";
import { buildGlobeNations } from "@/lib/wc26-globe-data";

const NOW = new Date("2026-06-21T12:00:00Z");

describe("buildGlobeNations", () => {
  const nations = buildGlobeNations(NOW);

  it("returns all 48 tournament nations with coordinates", () => {
    expect(nations).toHaveLength(48);
    for (const n of nations) {
      expect(typeof n.lat).toBe("number");
      expect(typeof n.lon).toBe("number");
      expect(n.lat).toBeGreaterThanOrEqual(-90);
      expect(n.lat).toBeLessThanOrEqual(90);
      expect(n.short.length).toBeGreaterThan(0);
    }
  });

  it("flags exactly the three host nations", () => {
    const hosts = nations.filter((n) => n.host).map((n) => n.id).sort();
    expect(hosts).toEqual(["can", "mex", "usa"]);
  });

  it("weights hosts highest and seeds above the field", () => {
    const usa = nations.find((n) => n.id === "usa")!;
    const bra = nations.find((n) => n.id === "bra")!;
    const cpv = nations.find((n) => n.id === "cpv")!;
    expect(usa.weight).toBe(3);
    expect(bra.weight).toBe(2);
    expect(cpv.weight).toBe(1);
  });

  it("uses only known verdict states", () => {
    const allowed = new Set(["nailed", "hit", "close", "miss", "locked"]);
    for (const n of nations) expect(allowed.has(n.verdict)).toBe(true);
  });

  it("marks at most two leading-edge nations (one fixture)", () => {
    expect(nations.filter((n) => n.leadingEdge).length).toBeLessThanOrEqual(2);
  });

  it("derives a settled scoreline for a graded nation", () => {
    const usa = nations.find((n) => n.id === "usa");
    expect(usa).toBeDefined();
    expect(usa!.record).toContain("USA");
    expect(usa!.slug).toBeTruthy();
  });
});
