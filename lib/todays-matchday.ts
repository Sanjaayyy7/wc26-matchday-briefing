/**
 * Pre-kickoff read for today's locked slate. Pure: turns a locked H/D/A split
 * into a favourite + confidence + a qualitative tag. No result is implied — the
 * games are unplayed, shown LOCKED until full-time settlement.
 */

export type Split = { home: number; draw: number; away: number };
export type Favorite = "home" | "draw" | "away";
export type MatchdayTag = "STRONG" | "EDGE" | "TIGHT";

export type MatchdayRead = {
  favorite: Favorite;
  /** Confidence = the model's probability on the favoured outcome (percent). */
  conf: number;
  tag: MatchdayTag;
};

export function matchdayRead(split: Split): MatchdayRead {
  let favorite: Favorite = "home";
  let conf = split.home;
  if (split.draw > conf) {
    favorite = "draw";
    conf = split.draw;
  }
  if (split.away > conf) {
    favorite = "away";
    conf = split.away;
  }
  const tag: MatchdayTag = conf >= 70 ? "STRONG" : conf >= 45 ? "EDGE" : "TIGHT";
  return { favorite, conf, tag };
}

/** Plain-English read for the tag, used in the analysis line. */
export function tagPhrase(tag: MatchdayTag): string {
  if (tag === "STRONG") return "strong favourite";
  if (tag === "EDGE") return "slight edge";
  return "too close to call";
}
