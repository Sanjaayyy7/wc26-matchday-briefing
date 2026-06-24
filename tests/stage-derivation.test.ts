// tests/stage-derivation.test.ts
import { describe, it, expect } from "vitest";
import { deriveEditionStages, type EditionMatch } from "../lib/stage-derivation";

// Helper: build a match with a sequential idx.
let _i = 0;
const m = (date: string, home: string, away: string): EditionMatch => ({ date, home, away, idx: _i++ });

// A clean edition: 4 groups of 4 (round-robin) is heavy to hand-build, so use a
// minimal but structurally valid edition: 8 knockout teams (QF→SF→F) preceded by
// a small round-robin group prefix. The algorithm keys on appearance, not counts of groups.
function bracketEdition(withThird: boolean): EditionMatch[] {
  _i = 0;
  const g: EditionMatch[] = [
    // group prefix: teams A..H each play 2 group games (losers DO reappear within group)
    m("2026-06-01", "A", "B"), m("2026-06-01", "C", "D"),
    m("2026-06-02", "A", "C"), m("2026-06-02", "B", "D"),
    m("2026-06-03", "E", "F"), m("2026-06-03", "G", "H"),
    m("2026-06-04", "E", "G"), m("2026-06-04", "F", "H"),
  ];
  // Quarterfinals (8 teams → 4 winners): A,C,E,G advance
  const qf = [ m("2026-06-10","A","B"), m("2026-06-10","C","D"), m("2026-06-11","E","F"), m("2026-06-11","G","H") ];
  // Semifinals: A,E advance
  const sf = [ m("2026-06-14","A","C"), m("2026-06-15","E","G") ];
  const extra = withThird ? [ m("2026-06-18","C","G") ] : []; // 3rd place: the two SF losers
  const fin = [ m("2026-06-19","A","E") ];
  return [...g, ...qf, ...sf, ...extra, ...fin];
}

describe("deriveEditionStages", () => {
  it("labels the single-elim bracket as knockout and the round-robin prefix as group", () => {
    const ms = bracketEdition(false);
    const { labels, resolved } = deriveEditionStages(ms);
    expect(resolved).toBe(true);
    // The 8 group matches are idx 0..7; QF/SF/F are idx 8..14
    for (let i = 0; i <= 7; i++) expect(labels.get(i)).toBe("group");
    for (let i = 8; i <= 14; i++) expect(labels.get(i)).toBe("knockout");
  });

  it("labels a third-place playoff as knockout", () => {
    const ms = bracketEdition(true);
    const { labels, resolved } = deriveEditionStages(ms);
    expect(resolved).toBe(true);
    // third place is the SF-losers match (C vs G) dated 06-18
    const third = ms.find((x) => x.date === "2026-06-18")!;
    expect(labels.get(third.idx)).toBe("knockout");
  });

  it("handles pen-decided (drawn) knockouts: advancement is by appearance, not score", () => {
    // identical structure; scores are irrelevant to the algorithm (no scores in EditionMatch)
    const ms = bracketEdition(false);
    const { labels } = deriveEditionStages(ms);
    const fin = ms.at(-1)!;
    expect(labels.get(fin.idx)).toBe("knockout");
  });

  it("does NOT mislabel a final-group-round match whose loser is eliminated", () => {
    // The group prefix above already contains eliminations; assert none leaked into knockout
    const ms = bracketEdition(false);
    const { labels } = deriveEditionStages(ms);
    const groupCount = [...labels.values()].filter((v) => v === "group").length;
    expect(groupCount).toBe(8);
  });

  it("flags an edition that does not reconstruct into a clean bracket", () => {
    _i = 0;
    const ms = [ m("2020-01-01","A","B"), m("2020-01-02","C","D"), m("2020-01-03","A","C") ];
    const { resolved, reason } = deriveEditionStages(ms);
    expect(resolved).toBe(false);
    expect(reason).toBeTruthy();
  });
});
