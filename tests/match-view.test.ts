import { describe, expect, it } from "vitest";
import { fixtureBySlug } from "@/lib/data";
import { buildMatchView, matchViewBySlug, matchViewToRow } from "@/lib/match-view";

describe("match-view display shaping", () => {
  it("projects USA-Paraguay as an official graded result", () => {
    const view = matchViewBySlug("united-states-vs-paraguay");
    expect(view?.status).toBe("official");
    if (view?.status !== "official") throw new Error("expected official view");
    expect(view.score).toBe("4-1");
    expect(view.verdict).toBe("hit");
    expect(view.official.grades.modelBrier).toBeCloseTo(0.6152, 4);
    expect(matchViewToRow(view).grade?.rps).toBeCloseTo(0.2626, 4);
  });

  it("projects played-before-lock matches as informational with no model grade", () => {
    for (const slug of [
      "mexico-vs-south-africa",
      "south-korea-vs-czech-republic",
      "canada-vs-bosnia-herzegovina",
    ]) {
      const view = matchViewBySlug(slug);
      expect(view?.status).toBe("informational");
      if (view?.status !== "informational") throw new Error(`expected ${slug}`);
      const row = matchViewToRow(view);
      expect(row.verdict).toBeUndefined();
      expect(row.grade).toBeUndefined();
      expect(row.note).toBe("Not graded");
    }
  });

  it("projects Qatar-Switzerland as a locked future match", () => {
    const view = matchViewBySlug("qatar-vs-switzerland");
    expect(view?.status).toBe("locked");
    if (view?.status !== "locked") throw new Error("expected locked view");
    expect(view.lock.split.home + view.lock.split.draw + view.lock.split.away).toBe(100);
  });

  it("falls back to upcoming when a fixture has no lock or result artifacts", () => {
    const fixture = fixtureBySlug("qatar-vs-switzerland");
    if (!fixture) throw new Error("missing fixture");
    const view = buildMatchView({ ...fixture, slug: "qatar-vs-switzerland-unlocked-copy" });
    expect(view.status).toBe("upcoming");
  });
});
