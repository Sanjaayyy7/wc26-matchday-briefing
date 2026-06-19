// Score sentiment for posts for a fixture and write data/sentiment/<slug>.json.
// Uses @huggingface/transformers pipeline (server-side) or a lexicon fallback.
//
//   npm run sentiment:score -- <fixture-slug>
import { writeFileSync, readFileSync, existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import { fixtureBySlugOrDie, outDir, appDir } from "./shared.mts";
import { bucketByMinute, detectShift, type ScoredPost } from "../lib/sentiment.ts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: npm run sentiment:score -- <fixture-slug>");
  process.exit(1);
}

const fixture = fixtureBySlugOrDie(slug);
const dir = outDir(slug);
const postsPath = path.join(dir, "posts.json");
const samplePath = path.join(appDir, "data", "posts-sample.json");

// Load match-facts for event minutes
const matchFactsPath = path.join(appDir, "data", "match-facts.json");
const matchFacts = JSON.parse(readFileSync(matchFactsPath, "utf8")) as Record<string, unknown>;
const facts = matchFacts[slug];

interface GoalEvent { minute: number; type: "goal"; label: string; }
interface CardEvent { minute: number; type: "yellow" | "red"; label: string; }
type MatchEvent = GoalEvent | CardEvent;

const events: MatchEvent[] = [];

if (facts && typeof facts === "object") {
  const f = facts as Record<string, unknown>;
  const scorers = f.scorers as Array<{ player: string; team: string; minute: number }> | undefined;
  if (Array.isArray(scorers)) {
    for (const s of scorers) {
      events.push({ minute: s.minute, type: "goal", label: `${s.player} (${s.team})` });
    }
  }
  const factsData = f.facts as Record<string, unknown> | undefined;
  if (factsData) {
    const cards = factsData.cards as Array<{ player: string; team: string; type: string; minute: number }> | undefined;
    if (Array.isArray(cards)) {
      for (const c of cards) {
        if (c.type === "red" || c.type === "yellow") {
          events.push({ minute: c.minute, type: c.type, label: `${c.player} (${c.team})` });
        }
      }
    }
  }
}

events.sort((a, b) => a.minute - b.minute);
console.log(`[score-sentiment] Found ${events.length} events for ${slug}`);

// Load posts (prefer pipeline-output, fall back to sample)
interface RawPost { id: string; ts: number; minute: number; text: string; source: string; author: string; url: string; }
let posts: RawPost[] = [];
if (existsSync(postsPath)) {
  posts = JSON.parse(readFileSync(postsPath, "utf8")) as RawPost[];
  console.log(`[score-sentiment] Loaded ${posts.length} posts from ${postsPath}`);
} else {
  posts = JSON.parse(readFileSync(samplePath, "utf8")) as RawPost[];
  console.log(`[score-sentiment] No fetched posts found, using sample (${posts.length} posts)`);
}

/** Simple deterministic lexicon fallback scorer. */
const POS_WORDS = new Set([
  "goal","gooal","great","brilliant","amazing","excellent","win","winning","winner",
  "good","nice","beautiful","superb","incredible","fantastic","class","love","best",
  "happy","yes","celebrate","celebrating","up","top","strong","comfortable","cruising",
  "perfect","impressive","quality","effort","well","congratulations","clean","score",
  "positive","hope","hoping","confident","lead",
]);
const NEG_WORDS = new Set([
  "red","disaster","terrible","awful","poor","bad","miss","missed","struggling",
  "losing","loser","disappointing","disappointing","hurt","collapse","collapses",
  "embarrassing","shambolic","reckless","foul","frustrating","frustrated","blow",
  "fail","failed","failure","misery","broken","down","done","heartbreaking","chaos",
  "stupid","idiot","pathetic","done","finished","over",
]);

function lexiconScore(text: string): ScoredPost["label"] {
  const words = text.toLowerCase().split(/\W+/);
  let pos = 0, neg = 0;
  for (const w of words) {
    if (POS_WORDS.has(w)) pos++;
    if (NEG_WORDS.has(w)) neg++;
  }
  if (pos > neg) return "POS";
  if (neg > pos) return "NEG";
  return "NEU";
}

type ScoredPostFull = ScoredPost & { id: string; text: string; score?: number; };
let scoredPosts: ScoredPostFull[] = [];
let modelUsed = "lexicon-fallback";

try {
  console.log("[score-sentiment] Loading @huggingface/transformers pipeline…");
  const { pipeline, env } = await import("@huggingface/transformers");
  // Cache model in .cache/huggingface inside the app dir
  env.cacheDir = path.join(appDir, ".cache", "huggingface");
  mkdirSync(env.cacheDir, { recursive: true });

  const MODEL_ID = "Xenova/twitter-roberta-base-sentiment-latest";
  const classifier = await pipeline("sentiment-analysis", MODEL_ID, { device: "cpu" });
  modelUsed = MODEL_ID;
  console.log(`[score-sentiment] Model loaded: ${MODEL_ID}`);

  const BATCH = 16;
  for (let i = 0; i < posts.length; i += BATCH) {
    const batch = posts.slice(i, i + BATCH);
    const texts = batch.map((p) => p.text.slice(0, 512));
    // Pipeline returns array or single result
    const results = await classifier(texts) as Array<{ label: string; score: number }> | { label: string; score: number };
    const arr = Array.isArray(results) ? results : [results];
    for (let j = 0; j < batch.length; j++) {
      const raw = arr[j]?.label?.toUpperCase() ?? "NEU";
      // twitter-roberta labels: LABEL_0=NEG LABEL_1=NEU LABEL_2=POS
      let label: ScoredPost["label"] = "NEU";
      if (raw.includes("2") || raw === "POS" || raw === "POSITIVE") label = "POS";
      else if (raw.includes("0") || raw === "NEG" || raw === "NEGATIVE") label = "NEG";
      scoredPosts.push({ id: batch[j].id, ts: batch[j].ts, minute: batch[j].minute, text: batch[j].text, label, score: arr[j]?.score });
    }
    if ((i / BATCH) % 5 === 0) process.stdout.write(".");
  }
  console.log("\n[score-sentiment] Scoring complete");
} catch (err) {
  console.warn(`[score-sentiment] Transformers unavailable (${(err as Error).message}); using lexicon fallback`);
  for (const p of posts) {
    scoredPosts.push({ id: p.id, ts: p.ts, minute: p.minute, text: p.text, label: lexiconScore(p.text) });
  }
}

const timeline = bucketByMinute(scoredPosts, 5);

// Compute shifts around each goal/card event
const shifts = events.map((ev) => {
  const shift = detectShift(scoredPosts, ev.minute, 10);
  return { event: ev, ...shift };
});

// Write output
const sentimentDir = path.join(appDir, "data", "sentiment");
mkdirSync(sentimentDir, { recursive: true });
const outPath = path.join(sentimentDir, `${slug}.json`);
const output = {
  fixture: slug,
  model: modelUsed,
  source: existsSync(path.join(outDir(slug), "posts.json")) ? "fetched" : "sample",
  generatedAt: new Date().toISOString(),
  timeline,
  events,
  shifts,
  posts: scoredPosts,
};
writeFileSync(outPath, JSON.stringify(output, null, 2));
console.log(`[score-sentiment] Wrote ${outPath}`);
console.log(`[score-sentiment] Model: ${modelUsed}`);
console.log(`[score-sentiment] Posts: ${scoredPosts.length} | Buckets: ${timeline.length} | Events: ${events.length}`);
console.log("[score-sentiment] Top shifts:");
const topShifts = [...shifts].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 3);
for (const s of topShifts) {
  console.log(`  min ${s.event.minute} (${s.event.type}): delta=${s.delta.toFixed(3)} before=${s.before.toFixed(3)} after=${s.after.toFixed(3)} n=${s.nBefore}/${s.nAfter}`);
}
