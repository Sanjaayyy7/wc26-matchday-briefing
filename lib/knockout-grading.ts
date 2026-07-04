// 90-minute grading guard for knockout matches.
//
// results.csv (martj42 convention) stores the AFTER-EXTRA-TIME score for
// matches that went past 90 minutes, but the ledger grades 90-minute markets
// (H/D/A, scoreline, btts, ou25). Any match that reached extra time was level
// after 90 by definition, and the exact 90' score matters for the side markets.
//
// data/knockout-results.json rows for ledger-graded rounds (round of 16
// onward) must therefore declare how the tie was decided:
//   after:        "90" | "et" | "pens"            — REQUIRED
//   homeScore90 / awayScore90 (must be level)     — REQUIRED when after !== "90"
// homeScore/awayScore keep the martj42 AET convention. Round-of-32 rows
// predate this schema and are never settled (no fixtures or ledger entries).

export type KnockoutResultRow = {
  match: number;
  homeId: string;
  awayId: string;
  homeScore: number;
  awayScore: number;
  winnerId: string;
  note?: string;
  after?: "90" | "et" | "pens";
  homeScore90?: number;
  awayScore90?: number;
};

export type GradableFixture = {
  slug: string;
  homeId: string;
  awayId: string;
  group?: string;
  homeScore?: number;
  awayScore?: number;
  homeScore90?: number;
  awayScore90?: number;
  decidedBy?: "et" | "pens";
};

/** Merge explicit 90-minute scores onto scored knockout fixtures, or throw
 *  when the metadata needed to grade the 90-minute market honestly is
 *  missing or inconsistent. Group fixtures and unplayed fixtures pass through. */
export function applyKnockoutScores90<T extends GradableFixture>(
  fixtures: T[],
  koRows: KnockoutResultRow[],
): T[] {
  return fixtures.map((f) => {
    if (f.group || f.homeScore === undefined || f.awayScore === undefined) return f;

    const row =
      koRows.find((r) => r.homeId === f.homeId && r.awayId === f.awayId) ??
      koRows.find((r) => r.homeId === f.awayId && r.awayId === f.homeId);
    if (!row || row.after === undefined) {
      throw new Error(
        `knockout fixture ${f.slug} has a score but no knockout-results.json row with an explicit "after" — refusing to grade the 90-min market`,
      );
    }

    const reversed = row.homeId !== f.homeId;
    const rowHome = reversed ? row.awayScore : row.homeScore;
    const rowAway = reversed ? row.homeScore : row.awayScore;
    if (rowHome !== f.homeScore || rowAway !== f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: fixture score ${f.homeScore}-${f.awayScore} disagrees with knockout-results ${rowHome}-${rowAway}`,
      );
    }
    if (row.after === "90" && f.homeScore === f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: after="90" but the score is level — a drawn knockout can't end at 90 minutes`,
      );
    }
    if (row.after !== "pens") {
      const scoreWinner =
        f.homeScore > f.awayScore ? f.homeId : f.awayScore > f.homeScore ? f.awayId : undefined;
      if (scoreWinner !== row.winnerId) {
        throw new Error(
          `knockout fixture ${f.slug}: winnerId ${row.winnerId} contradicts score ${f.homeScore}-${f.awayScore} for after="${row.after}"`,
        );
      }
    }

    if (row.after === "90") return f;

    if (row.homeScore90 === undefined || row.awayScore90 === undefined) {
      throw new Error(
        `knockout fixture ${f.slug}: after="${row.after}" requires homeScore90/awayScore90`,
      );
    }
    if (row.homeScore90 !== row.awayScore90) {
      throw new Error(
        `knockout fixture ${f.slug}: 90-min score ${row.homeScore90}-${row.awayScore90} must be level for a match that went past 90 minutes`,
      );
    }
    if (row.after === "pens" && f.homeScore !== f.awayScore) {
      throw new Error(
        `knockout fixture ${f.slug}: after="pens" but the AET score ${f.homeScore}-${f.awayScore} is not level`,
      );
    }

    return {
      ...f,
      homeScore90: reversed ? row.awayScore90 : row.homeScore90,
      awayScore90: reversed ? row.homeScore90 : row.awayScore90,
      decidedBy: row.after,
    };
  });
}
