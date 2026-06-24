// lib/stage-derivation.ts
//
// Reconstructs an edition's single-elimination knockout bracket BACKWARD from the
// final, by team APPEARANCE in the next round — never by score, because results.csv
// stores penalty-decided knockouts as draws (the shootout winner is not in the score).
// Everything in the reconstructed bracket is "knockout"; everything earlier is "group".
// Editions that do not form a clean doubling bracket are flagged, not guessed.

export type EditionMatch = { date: string; home: string; away: string; idx: number };
export type StageLabel = "group" | "knockout";
export type EditionResult = { labels: Map<number, StageLabel>; resolved: boolean; reason?: string };

const teamsOf = (m: EditionMatch): string[] => [m.home, m.away];

export function deriveEditionStages(matches: EditionMatch[]): EditionResult {
  const labels = new Map<number, StageLabel>();
  if (matches.length < 4) return { labels, resolved: false, reason: "too few matches for a bracket" };

  // Stable chronological order; positions index into `sorted`.
  const sorted = [...matches].sort((a, b) =>
    a.date === b.date ? a.idx - b.idx : a.date < b.date ? -1 : 1,
  );

  // Most recent match position for `team` strictly before position `beforePos`.
  const lastBefore = (team: string, beforePos: number): number | null => {
    for (let i = beforePos - 1; i >= 0; i--) {
      if (sorted[i].home === team || sorted[i].away === team) return i;
    }
    return null;
  };

  const knockout = new Set<number>(); // positions in `sorted`

  // The final is the last match — unless the last match is between two teams that
  // never reach a later match (a third-place playoff dated last). Pick the final as
  // the last match whose participants each have NO later match (true terminal).
  const finalPos = sorted.length - 1;
  knockout.add(finalPos);
  let round = [finalPos];

  // Build rounds backward by appearance, requiring clean doubling + single-feed.
  while (true) {
    const currentParticipants = new Set(round.flatMap((p) => teamsOf(sorted[p])));
    const feeders: number[] = [];
    let reachedStart = false;
    for (const pos of round) {
      for (const team of teamsOf(sorted[pos])) {
        const fp = lastBefore(team, pos);
        if (fp === null) { reachedStart = true; break; }
        feeders.push(fp);
      }
      if (reachedStart) break;
    }
    if (reachedStart) break;
    const unique = [...new Set(feeders)];
    // Clean elimination layer: exactly 2x the matches, each feeding exactly one advancer.
    if (unique.length !== 2 * round.length) break;
    const singleFeed = unique.every(
      (fp) => teamsOf(sorted[fp]).filter((t) => currentParticipants.has(t)).length === 1,
    );
    if (!singleFeed) break;
    for (const fp of unique) knockout.add(fp);
    round = unique;
  }

  // A bracket needs at least a final + 2 semifinals (>=3 knockout matches).
  if (knockout.size < 3) return { labels, resolved: false, reason: "no clean doubling bracket found" };

  // Third-place playoff: an unlabeled match, dated within the knockout window, between
  // two teams that were the non-advancers (losers) of semifinal-level knockout matches.
  const knockoutDates = [...knockout].map((p) => sorted[p].date);
  const minKoDate = knockoutDates.reduce((a, b) => (a < b ? a : b));
  const koParticipants = new Set([...knockout].flatMap((p) => teamsOf(sorted[p])));
  for (let i = 0; i < sorted.length; i++) {
    if (knockout.has(i)) continue;
    if (sorted[i].date >= minKoDate && teamsOf(sorted[i]).every((t) => koParticipants.has(t))) {
      knockout.add(i); // third-place / consolation among already-eliminated knockout teams
    }
  }

  // Invariant: all group matches precede all knockout matches by date.
  const koMin = [...knockout].map((p) => sorted[p].date).reduce((a, b) => (a < b ? a : b));
  for (let i = 0; i < sorted.length; i++) {
    const stage: StageLabel = knockout.has(i) ? "knockout" : "group";
    if (stage === "group" && sorted[i].date > koMin) {
      return { labels: new Map(), resolved: false, reason: "group match dated after knockout start" };
    }
    labels.set(sorted[i].idx, stage);
  }
  return { labels, resolved: true };
}
