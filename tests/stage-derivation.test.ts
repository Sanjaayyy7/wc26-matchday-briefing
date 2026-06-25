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

  it("does NOT promote a group match to knockout when its teams are not both knockout-eliminated", () => {
    // Scenario: a late group-stage match between two teams (P and Q) that never appear
    // in any knockout match is dated on the same day as the first knockout round.
    // The match is a consolation candidate (date >= minKoDate) but neither P nor Q is
    // in koEliminated (they were never in a knockout match at all), so the tightened
    // detector must leave it as "group".
    //
    // The old detector used koParticipants (union of ALL teams in any KO match), which
    // did NOT include P or Q either — so this particular scenario wouldn't have been
    // promoted even by the old code.  We confirm the new code also leaves it as "group",
    // while the legitimate third-place match (between two genuine SF losers) is still
    // correctly promoted to "knockout".
    _i = 0;
    // Group prefix: P and Q are group-only teams (never appear in knockout).
    const groupMatches: EditionMatch[] = [
      m("2026-06-01", "P", "Q"),
      m("2026-06-01", "A", "B"), m("2026-06-01", "C", "D"),
      m("2026-06-02", "A", "C"), m("2026-06-02", "B", "D"),
      m("2026-06-03", "E", "F"), m("2026-06-03", "G", "H"),
      m("2026-06-04", "E", "G"), m("2026-06-04", "F", "H"),
    ];
    // QF (minKoDate = 2026-06-10): A, C, E, G advance
    const qf = [
      m("2026-06-10", "A", "B"), m("2026-06-10", "C", "D"),
      m("2026-06-10", "E", "F"), m("2026-06-10", "G", "H"),
    ];
    // A group match between P and Q dated on the same day as QF — consolation candidate
    // but neither team was ever in a knockout match, so neither is in koEliminated.
    const candidate = m("2026-06-10", "P", "Q");
    // SF: A, E advance (C and G eliminated)
    const sf = [ m("2026-06-14", "A", "C"), m("2026-06-15", "E", "G") ];
    // Third-place: C vs G (the two genuine SF losers)
    const third = m("2026-06-18", "C", "G");
    // Final
    const fin = m("2026-06-19", "A", "E");
    const ms = [...groupMatches, ...qf, candidate, ...sf, third, fin];
    const { labels, resolved } = deriveEditionStages(ms);
    // Edition must resolve cleanly
    expect(resolved).toBe(true);
    // P vs Q must stay "group" — neither team was knockout-eliminated
    expect(labels.get(candidate.idx)).toBe("group");
    // The genuine third-place match must be promoted to "knockout"
    expect(labels.get(third.idx)).toBe("knockout");
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
