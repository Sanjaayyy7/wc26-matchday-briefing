// Deterministic briefing prose from model outputs. Emits the exact Output
// Contract tokens the app's parsers expect. Every claim traces to the model:
// no invented injuries, tactics, or quotes — the honesty rules of the prompt
// era survive the pivot to ML.
import type { Prediction } from "./predict";

export type TeamNames = { homeName: string; awayName: string };

function formPhrase(results: string): string {
  const last5 = results.slice(0, 5);
  const w = [...last5].filter((c) => c === "W").length;
  const l = [...last5].filter((c) => c === "L").length;
  if (w >= 4) return "arrive flying";
  if (w >= 3) return "are in decent rhythm";
  if (l >= 3) return "limp in short of form";
  return "arrive with mixed form";
}

function gapPhrase(diff: number): string {
  const d = Math.abs(diff);
  if (d < 40) return "almost nothing between these sides on rating";
  if (d < 120) return "a modest but real quality edge";
  if (d < 250) return "a clear class gap";
  return "a chasm in class";
}

export function buildPreviewMarkdown(p: Prediction, t: TeamNames): string {
  const { homeName, awayName } = t;
  const fav =
    p.split.home >= p.split.away
      ? { name: homeName, pct: p.split.home, side: "home" as const }
      : { name: awayName, pct: p.split.away, side: "away" as const };
  const dog = fav.side === "home" ? awayName : homeName;
  const eloDiff = p.elo.home - p.elo.away;
  const ml = p.summary.mostLikely;

  const quickTake =
    fav.pct >= 56
      ? `${fav.name} should take this — the numbers see ${gapPhrase(eloDiff)}, and ${dog} need things to break their way.`
      : fav.pct >= 45
        ? `${fav.name} are the sensible pick, but this is closer than the names suggest.`
        : `Genuinely tight — treat this one as a coin flip with ${fav.name} holding the shorter straw of an edge.`;

  const lines = [
    `**Quick take:** ${quickTake}`,
    ``,
    `**Most likely scoreline:** ${ml.home}–${ml.away}.`,
    ``,
    `**Win probability split:** Home ${p.split.home}% / Draw ${p.split.draw}% / Away ${p.split.away}%. ${capitalize(p.band)}.`,
    ``,
    `**Why:**`,
    `- *Tactical:* The model expects roughly ${p.lambdas.home.toFixed(1)} goals from ${homeName} and ${p.lambdas.away.toFixed(1)} from ${awayName} — ${
      p.lambdas.home + p.lambdas.away > 2.8
        ? "an open game on paper"
        : "a game the numbers expect to stay tight"
    }. That balance, not any lineup read, is what drives the split.`,
    `- *Personnel:* This is a results-only model — it has no squad, injury, or lineup data. Rating ${homeName} ${p.elo.home} vs ${awayName} ${p.elo.away} is ${gapPhrase(eloDiff)}.`,
    `- *Form/context:* ${homeName} ${formPhrase(p.form.home.results)} (${spaced(p.form.home.results.slice(0, 5))} recent-first); ${awayName} ${formPhrase(p.form.away.results)} (${spaced(p.form.away.results.slice(0, 5))}).`,
    ``,
    `**What would flip it:** Team news the model can't see — one key absence or a heavy-rotation eleven would move this split more than anything in the data.`,
    ``,
    `**Things I'm not sure about:**`,
    `- No lineup, injury, or weather information — pure ratings and history (matches through ${p.model.dataThrough}).`,
    `- Tournament pressure does strange things that 90-minute ratings don't capture.`,
    `- Backtest honesty: this model's Brier score is ${p.model.backtestBrier} on 2024+ internationals — good, not psychic.`,
  ];

  if (p.advancement) {
    const advName = p.advancement.side === "home" ? homeName : awayName;
    lines.push(
      ``,
      `**Who goes through:** ${advName} advance, ${Math.round(p.advancement.prob * 100)}% (extra time and penalties folded in).`,
    );
  }

  return lines.join("\n");
}

export function buildFollowUpMarkdown(
  question: string,
  p: Prediction,
  t: TeamNames,
): string {
  const q = question.toLowerCase();
  const pct = (x: number) => `${Math.round(x * 100)}%`;

  if (/btts|both teams/.test(q)) {
    const v = p.summary.btts;
    return follow({
      short: `${pct(v)} — ${v >= 0.5 ? "leaning yes" : "leaning no"}.`,
      mechanism: `From the score grid: ${t.homeName} expected around ${p.lambdas.home.toFixed(1)} goals, ${t.awayName} around ${p.lambdas.away.toFixed(1)}. BTTS is just one minus the chance either side is shut out, and the ${
        p.lambdas.home < p.lambdas.away ? t.homeName : t.awayName
      } scoring leg is the bottleneck.`,
      number: `${pct(v)}, straight off the joint-Poisson grid.`,
      caveat: `One early goal changes how both teams play, and the grid can't see game states. Lean, not lock.`,
    });
  }
  if (/over|under|total goals|2\.5|3\.5/.test(q)) {
    const v = p.summary.over25;
    return follow({
      short: `Over 2.5 goals sits at ${pct(v)}.`,
      mechanism: `Expected goals total ${(p.lambdas.home + p.lambdas.away).toFixed(1)} between the sides; the grid splits that into exact scorelines and sums everything from 3 goals up.`,
      number: `${pct(v)} for over 2.5; most likely scoreline ${p.summary.mostLikely.home}–${p.summary.mostLikely.away}.`,
      caveat: `Tournament games run lower-scoring than qualifiers; the fit knows that on average, not for this specific match.`,
    });
  }
  if (/clean sheet|shut.?out/.test(q)) {
    return follow({
      short: `${t.homeName} clean sheet ${pct(p.summary.cleanSheetHome)}, ${t.awayName} clean sheet ${pct(p.summary.cleanSheetAway)}.`,
      mechanism: `A clean sheet is the chance the opponent's Poisson lands on zero, taken from the same grid as the headline split.`,
      number: `${pct(p.summary.cleanSheetHome)} / ${pct(p.summary.cleanSheetAway)} (home / away).`,
      caveat: `Late game-state effects — a side protecting a lead concedes more chances than its average says.`,
    });
  }
  return follow({
    short: `Can't give you an honest number on that one.`,
    mechanism: `This is a results-only model: it knows team ratings and score distributions, not players, scorers, cards, or corners. Anything player-level would be me making it up.`,
    number: `No number — the model doesn't compute this market.`,
    caveat: `Ask me about the result, BTTS, total goals, or clean sheets and the grid has a real answer.`,
  });
}

function follow(s: {
  short: string;
  mechanism: string;
  number: string;
  caveat: string;
}): string {
  return [
    `**Short answer:** ${s.short}`,
    `**The mechanism:** ${s.mechanism}`,
    `**The number:** ${s.number}`,
    `**Caveat for a teenager quoting his mates:** ${s.caveat}`,
  ].join("\n");
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function spaced(s: string): string {
  return s.split("").join(" ");
}
