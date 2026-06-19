/**
 * WC26 Phase IV — Deliverables 5 & 6: Challenger Model Evaluation
 * Tests 4 challenger configurations against the 21 settled WC26 predictions.
 *
 * Run: npx tsx scripts/challenger-eval.mts
 */
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(import.meta.dirname, "..");

// ── Data loading ─────────────────────────────────────────────────────────────

const model = JSON.parse(readFileSync(path.join(ROOT, "data", "model.json"), "utf8"));
const params = model.params as { baseLogGoals: number; eloSlope: number; rho: number };
const ratings = model.ratings as Record<string, number>;
const calibration = model.calibration as { a: number; b: number };

const predictions = JSON.parse(
  readFileSync(path.join(ROOT, "data", "predictions.json"), "utf8")
).entries as Array<{
  slug: string;
  split: { home: number; draw: number; away: number };
  result?: string;
  realized?: "home" | "draw" | "away";
  modelBrier?: number;
}>;

const fixturesRaw = JSON.parse(readFileSync(path.join(ROOT, "data", "fixtures.json"), "utf8"));
const allFixtures: Array<{ slug: string; homeId: string; awayId: string; neutral?: boolean; stage?: string }> =
  Array.isArray(fixturesRaw) ? fixturesRaw : fixturesRaw.fixtures ?? [];

const clubs = JSON.parse(readFileSync(path.join(ROOT, "data", "clubs.json"), "utf8")) as Array<{
  id: string; name: string; short: string; datasetName?: string;
}>;

const clubById = new Map(clubs.map((c) => [c.id, c]));
const fixtureMap = new Map(allFixtures.map((f) => [f.slug, f]));
const settled = predictions.filter((p) => p.realized !== undefined && p.modelBrier !== undefined);

// ── Core math ─────────────────────────────────────────────────────────────────

const GRID_SIZE = 9;
const ALIASES: Record<string, string> = {
  "Türkiye": "Turkey",
  "Bosnia & Herzegovina": "Bosnia and Herzegovina",
};

function resolveName(n: string): string { return ALIASES[n] ?? n; }

function poissonPMF(k: number, lambda: number): number {
  let log = -lambda + k * Math.log(lambda);
  for (let i = 1; i <= k; i++) log -= Math.log(i);
  return Math.exp(log);
}

function tau(h: number, a: number, lh: number, la: number, rho: number): number {
  if (h === 0 && a === 0) return 1 - lh * la * rho;
  if (h === 1 && a === 0) return 1 + la * rho;
  if (h === 0 && a === 1) return 1 + lh * rho;
  if (h === 1 && a === 1) return 1 - rho;
  return 1;
}

const HOME_ADVANTAGE = 100; // matches lib/elo.ts

function lambdasFromElo(
  eloHome: number, eloAway: number, neutral: boolean,
  p: { baseLogGoals: number; eloSlope: number }
): { home: number; away: number } {
  const effHome = eloHome + (neutral ? 0 : HOME_ADVANTAGE);
  const diff = (effHome - eloAway) / 400; // standard Elo scaling unit
  return {
    home: Math.exp(p.baseLogGoals + p.eloSlope * diff),
    away: Math.exp(p.baseLogGoals - p.eloSlope * diff),
  };
}

function scoreGrid(lh: number, la: number, rho: number): number[][] {
  const grid: number[][] = [];
  for (let h = 0; h < GRID_SIZE; h++) {
    grid[h] = [];
    for (let a = 0; a < GRID_SIZE; a++) {
      grid[h][a] = poissonPMF(h, lh) * poissonPMF(a, la) * tau(h, a, lh, la, rho);
    }
  }
  return grid;
}

function summarizeGrid(grid: number[][]): { home: number; draw: number; away: number } {
  let home = 0, draw = 0, away = 0;
  for (let h = 0; h < GRID_SIZE; h++) {
    for (let a = 0; a < GRID_SIZE; a++) {
      if (h > a) home += grid[h][a];
      else if (h === a) draw += grid[h][a];
      else away += grid[h][a];
    }
  }
  return { home, draw, away };
}

function applyPlatt(p: number, a: number, b: number): number {
  const c = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return 1 / (1 + Math.exp(-(a * Math.log(c / (1 - c)) + b)));
}

function normalizeSplit(s: { home: number; draw: number; away: number }) {
  const z = s.home + s.draw + s.away;
  return { home: s.home / z, draw: s.draw / z, away: s.away / z };
}

function brier(split: { home: number; draw: number; away: number }, realized: "home" | "draw" | "away"): number {
  const y = { home: 0, draw: 0, away: 0 };
  y[realized] = 1;
  return (
    Math.pow(split.home / 100 - y.home, 2) +
    Math.pow(split.draw / 100 - y.draw, 2) +
    Math.pow(split.away / 100 - y.away, 2)
  );
}

function roundTo100(probs: number[]): number[] {
  const scaled = probs.map((p) => p * 100);
  const floors = scaled.map(Math.floor);
  let rem = 100 - floors.reduce((a, b) => a + b, 0);
  const order = scaled.map((v, i) => ({ frac: v - floors[i], i })).sort((a, b) => b.frac - a.frac);
  const out = [...floors];
  for (const { i } of order) {
    if (rem <= 0) break;
    out[i] += 1;
    rem--;
  }
  return out;
}

// ── Challenger configurations ─────────────────────────────────────────────────

type DrawAdjust = "none" | "inflate1.3" | "inflate1.5" | "inflate1.7";
type EloCapMode = "none" | "cap400" | "cap350";

interface Config {
  name: string;
  rho: number;
  drawAdjust: DrawAdjust;
  eloCap: EloCapMode;
  description: string;
}

const CONFIGS: Config[] = [
  {
    name: "Champion (v1.0.0-platt)",
    rho: -0.05,
    drawAdjust: "none",
    eloCap: "none",
    description: "Current production model — rho=-0.05, Platt(a=0.894, b=-0.065)",
  },
  {
    name: "A: Rho×1.5",
    rho: -0.075,
    drawAdjust: "none",
    eloCap: "none",
    description: "rho=-0.075 (1.5× more negative) — more draw inflation in score grid",
  },
  {
    name: "B: Rho×3",
    rho: -0.15,
    drawAdjust: "none",
    eloCap: "none",
    description: "rho=-0.15 (3× more negative) — aggressive draw inflation",
  },
  {
    name: "C: Draw Prior +30%",
    rho: -0.05,
    drawAdjust: "inflate1.3",
    eloCap: "none",
    description: "Post-Platt draw inflation ×1.3 — adds WC tournament draw prior",
  },
  {
    name: "D: Draw Prior +50%",
    rho: -0.05,
    drawAdjust: "inflate1.5",
    eloCap: "none",
    description: "Post-Platt draw inflation ×1.5 — stronger WC draw prior",
  },
  {
    name: "E: Draw Prior +70%",
    rho: -0.05,
    drawAdjust: "inflate1.7",
    eloCap: "none",
    description: "Post-Platt draw inflation ×1.7 — maximum draw prior experiment",
  },
  {
    name: "F: Rho×3 + Elo Cap 400",
    rho: -0.15,
    drawAdjust: "none",
    eloCap: "cap400",
    description: "rho=-0.15 + Elo advantage capped at 400pts in WC group play",
  },
  {
    name: "G: Rho×3 + Draw +30%",
    rho: -0.15,
    drawAdjust: "inflate1.3",
    eloCap: "none",
    description: "Combined: rho inflation + draw prior",
  },
  {
    name: "H: Rho×3 + Draw +30% + Cap400",
    rho: -0.15,
    drawAdjust: "inflate1.3",
    eloCap: "cap400",
    description: "Full combination challenger — rho × draw prior × Elo cap",
  },
];

function applyDrawAdjust(
  split: { home: number; draw: number; away: number },
  mode: DrawAdjust
): { home: number; draw: number; away: number } {
  if (mode === "none") return split;
  const mult = mode === "inflate1.3" ? 1.3 : mode === "inflate1.5" ? 1.5 : 1.7;
  return normalizeSplit({ ...split, draw: split.draw * mult });
}

function applyEloCap(
  eloHome: number,
  eloAway: number,
  neutral: boolean,
  mode: EloCapMode
): { eloHome: number; eloAway: number } {
  if (mode === "none") return { eloHome, eloAway };
  const cap = mode === "cap400" ? 400 : 350;
  const effectiveH = neutral ? eloHome : eloHome + 100;
  const rawDiff = effectiveH - eloAway;
  if (Math.abs(rawDiff) <= cap) return { eloHome, eloAway };
  // Dampen: scale both ratings toward the cap
  const scale = cap / Math.abs(rawDiff);
  const midElo = (eloHome + eloAway) / 2;
  const newHome = midElo + (eloHome - midElo) * scale;
  const newAway = midElo + (eloAway - midElo) * scale;
  return { eloHome: newHome, eloAway: newAway };
}

// ── Evaluate all configs ──────────────────────────────────────────────────────

interface MatchResult {
  slug: string;
  realized: "home" | "draw" | "away";
  splits: Record<string, { home: number; draw: number; away: number }>;
  briers: Record<string, number>;
}

const matchResults: MatchResult[] = [];
const configStats: Record<string, {
  brierSum: number; n: number; drawPickCount: number; drawHitCount: number; correctPicks: number;
  drawBrierSum: number; drawN: number;
}> = {};
for (const c of CONFIGS) configStats[c.name] = { brierSum: 0, n: 0, drawPickCount: 0, drawHitCount: 0, correctPicks: 0, drawBrierSum: 0, drawN: 0 };

for (const pred of settled) {
  const fixture = fixtureMap.get(pred.slug);
  if (!fixture) continue;

  const homeClub = clubById.get(fixture.homeId);
  const awayClub = clubById.get(fixture.awayId);
  if (!homeClub || !awayClub) continue;

  const homeName = resolveName(homeClub.datasetName ?? homeClub.name);
  const awayName = resolveName(awayClub.datasetName ?? awayClub.name);
  if (!(homeName in ratings) || !(awayName in ratings)) continue;

  const eloRaw = { home: ratings[homeName], away: ratings[awayName] };
  const neutral = fixture.neutral ?? true;
  const realized = pred.realized!;

  const matchResult: MatchResult = { slug: pred.slug, realized, splits: {}, briers: {} };

  for (const cfg of CONFIGS) {
    const { eloHome, eloAway } = applyEloCap(eloRaw.home, eloRaw.away, neutral, cfg.eloCap);
    const lambdas = lambdasFromElo(eloHome, eloAway, neutral, params);
    const grid = scoreGrid(lambdas.home, lambdas.away, cfg.rho);
    const summary = summarizeGrid(grid);

    const calibrated = normalizeSplit({
      home: applyPlatt(summary.home, calibration.a, calibration.b),
      draw: applyPlatt(summary.draw, calibration.a, calibration.b),
      away: applyPlatt(summary.away, calibration.a, calibration.b),
    });

    const adjusted = applyDrawAdjust(calibrated, cfg.drawAdjust);
    const [h, d, a] = roundTo100([adjusted.home, adjusted.draw, adjusted.away]);
    const split = { home: h, draw: d, away: a };
    const br = brier(split, realized);

    matchResult.splits[cfg.name] = split;
    matchResult.briers[cfg.name] = br;

    const st = configStats[cfg.name];
    st.brierSum += br;
    st.n++;
    const top = h >= d && h >= a ? "home" : d >= a ? "draw" : "away";
    if (top === "draw") st.drawPickCount++;
    if (top === realized) st.correctPicks++;
    if (realized === "draw") {
      st.drawBrierSum += br;
      st.drawN++;
      if (top === "draw") st.drawHitCount++;
    }
  }

  matchResults.push(matchResult);
}

// ── Print results ─────────────────────────────────────────────────────────────

console.log(`\n${"═".repeat(90)}`);
console.log(`WC26 PHASE IV — CHALLENGER MODEL EVALUATION (n=${matchResults.length} settled)`);
console.log(`${"═".repeat(90)}\n`);

console.log(
  "Config".padEnd(36) +
  "Brier".padEnd(8) +
  "Δvs Champion".padEnd(14) +
  "Correct".padEnd(10) +
  "DrawPick".padEnd(10) +
  "DrawHit".padEnd(10) +
  "DrawBrier"
);
console.log("─".repeat(90));

const championName = CONFIGS[0].name;
const championStats = configStats[championName];
const championBrier = championStats.brierSum / championStats.n;

const rows = CONFIGS.map((cfg) => {
  const st = configStats[cfg.name];
  const avgBrier = st.brierSum / st.n;
  const delta = avgBrier - championBrier;
  const deltaStr = delta === 0 ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(4);
  const drawBrier = st.drawN > 0 ? (st.drawBrierSum / st.drawN).toFixed(3) : "—";
  return {
    name: cfg.name,
    avgBrier,
    delta,
    correct: st.correctPicks,
    drawPick: st.drawPickCount,
    drawHit: st.drawHitCount,
    drawBrier,
  };
}).sort((a, b) => a.avgBrier - b.avgBrier);

for (const r of rows) {
  const isChampion = r.name === championName;
  const isBest = r === rows[0];
  const flag = isBest ? "★ " : isChampion ? "● " : "  ";
  console.log(
    (flag + r.name).padEnd(38) +
    r.avgBrier.toFixed(4).padEnd(8) +
    (r.delta === 0 ? "—" : (r.delta > 0 ? "+" : "") + r.delta.toFixed(4)).padEnd(14) +
    `${r.correct}/21`.padEnd(10) +
    `${r.drawPick}`.padEnd(10) +
    `${r.drawHit}/8`.padEnd(10) +
    r.drawBrier
  );
}

console.log("\n── DRAW-SPECIFIC BREAKDOWN ──\n");
console.log(
  "Config".padEnd(36) +
  "Avg Draw Brier".padEnd(16) +
  "Δ vs Champion".padEnd(16) +
  "Mean Draw%"
);
console.log("─".repeat(78));

for (const cfg of CONFIGS) {
  const st = configStats[cfg.name];
  const drawBrier = st.drawN > 0 ? st.drawBrierSum / st.drawN : 0;
  const champDrawBrier = configStats[championName].drawBrierSum / configStats[championName].drawN;
  const delta = drawBrier - champDrawBrier;
  const deltaStr = delta === 0 ? "—" : (delta > 0 ? "+" : "") + delta.toFixed(4);

  // Mean predicted draw% across all 21 settled matches
  const drawPcts = matchResults.map(m => m.splits[cfg.name].draw);
  const meanDraw = drawPcts.reduce((s, v) => s + v, 0) / drawPcts.length;

  console.log(
    cfg.name.padEnd(36) +
    drawBrier.toFixed(4).padEnd(16) +
    deltaStr.padEnd(16) +
    `${meanDraw.toFixed(1)}%`
  );
}

// ── Per-match breakdown for top 3 configs ────────────────────────────────────

console.log("\n── PER-MATCH COMPARISON: Champion vs Best Challenger ──\n");
const bestCfg = rows[0].name;
console.log(`Champion: ${championName}  |  Best: ${bestCfg}\n`);

for (const m of matchResults.sort((a, b) => b.briers[championName] - a.briers[championName])) {
  const f = fixtureMap.get(m.slug)!;
  const home = clubById.get(f.homeId)?.short ?? "?";
  const away = clubById.get(f.awayId)?.short ?? "?";
  const champSplit = m.splits[championName];
  const bestSplit = m.splits[bestCfg];
  const champBr = m.briers[championName];
  const bestBr = m.briers[bestCfg];
  const delta = bestBr - champBr;
  const flag = delta < -0.05 ? "▲" : delta > 0.05 ? "▼" : " ";
  console.log(
    `${flag} ${`${home} vs ${away}`.padEnd(20)} ${m.realized.padEnd(5)} | Champ: H:${champSplit.home}% D:${champSplit.draw}% A:${champSplit.away}% B:${champBr.toFixed(3)} | Best: H:${bestSplit.home}% D:${bestSplit.draw}% A:${bestSplit.away}% B:${bestBr.toFixed(3)}`
  );
}

// ── Write JSON output ─────────────────────────────────────────────────────────

const output = {
  generatedAt: new Date().toISOString(),
  n: matchResults.length,
  champion: { name: championName, avgBrier: championBrier },
  configs: CONFIGS.map((cfg) => {
    const st = configStats[cfg.name];
    const avgBrier = st.brierSum / st.n;
    return {
      name: cfg.name,
      description: cfg.description,
      rho: cfg.rho,
      drawAdjust: cfg.drawAdjust,
      eloCap: cfg.eloCap,
      avgBrier,
      deltaBrier: avgBrier - championBrier,
      correctPicks: st.correctPicks,
      drawPicks: st.drawPickCount,
      drawHits: st.drawHitCount,
      avgDrawBrier: st.drawN > 0 ? st.drawBrierSum / st.drawN : null,
    };
  }),
  matchResults,
};
writeFileSync(
  path.join(ROOT, "docs", "phase-iv", "challenger-eval.json"),
  JSON.stringify(output, null, 2)
);
console.log("\nJSON → docs/phase-iv/challenger-eval.json");

// ── Promotion recommendation ──────────────────────────────────────────────────
const bestResult = rows[0];
console.log("\n── PROMOTION RECOMMENDATION ──\n");
if (bestResult.delta < -0.05) {
  console.log(`PROMOTE: ${bestResult.name}`);
  console.log(`  Brier improvement: ${Math.abs(bestResult.delta).toFixed(4)} (${((Math.abs(bestResult.delta) / championBrier) * 100).toFixed(1)}%)`);
  console.log(`  Correct picks: ${bestResult.correct}/21 vs Champion ${configStats[championName].correctPicks}/21`);
  console.log(`  Draw Brier: ${bestResult.drawBrier} vs Champion ${(configStats[championName].drawBrierSum / configStats[championName].drawN).toFixed(3)}`);
} else if (bestResult.delta < 0) {
  console.log(`MARGINAL: ${bestResult.name} improves by only ${Math.abs(bestResult.delta).toFixed(4)} — within variance. Need more data.`);
} else {
  console.log(`HOLD: No challenger beats Champion. Champion remains.`);
}
