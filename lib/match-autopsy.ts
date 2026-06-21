// Pure per-match autopsy: how the locked model split related to the actual result.
// Used by the settled fixture-detail panel to tell the "how close were we" story.

export type Split = { home: number; draw: number; away: number };
export type Outcome = "home" | "draw" | "away";

export type Autopsy = {
  topLabel: Outcome; // outcome the model rated most likely
  topPct: number;
  realized: Outcome; // outcome that actually happened
  actualPct: number; // probability the model assigned to the realized outcome
  correct: boolean; // model's top pick matched the result
  drawUnderrated: boolean; // it was a draw and the model did NOT rate draw highest
};

export function buildAutopsy(split: Split, homeScore: number, awayScore: number): Autopsy {
  const realized: Outcome =
    homeScore > awayScore ? "home" : homeScore < awayScore ? "away" : "draw";

  const ranked: Array<[Outcome, number]> = [
    ["home", split.home],
    ["draw", split.draw],
    ["away", split.away],
  ];
  const [topLabel, topPct] = ranked.reduce((a, b) => (b[1] > a[1] ? b : a));

  return {
    topLabel,
    topPct,
    realized,
    actualPct: split[realized],
    correct: topLabel === realized,
    drawUnderrated: realized === "draw" && topLabel !== "draw",
  };
}
