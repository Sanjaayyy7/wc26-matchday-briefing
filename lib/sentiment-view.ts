import "server-only";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";

export interface SentimentEventRow {
  minute: number;
  type: "goal" | "yellow" | "red";
  label: string;
}

export interface SentimentShift {
  event: SentimentEventRow;
  before: number;
  after: number;
  delta: number;
  nBefore: number;
  nAfter: number;
}

export interface SentimentBucket {
  minuteBucket: number;
  posPct: number;
  negPct: number;
  neuPct: number;
  n: number;
}

export interface SentimentScoredPost {
  id: string;
  ts: number;
  minute: number;
  text: string;
  label: "POS" | "NEG" | "NEU";
  score?: number;
}

export interface SentimentOutput {
  fixture: string;
  model: string;
  source: string;
  generatedAt: string;
  timeline: SentimentBucket[];
  events: SentimentEventRow[];
  shifts: SentimentShift[];
  posts: SentimentScoredPost[];
}

const dataDir = path.resolve(process.cwd(), "data", "sentiment");

export function sentimentSlugs(): string[] {
  try {
    return readdirSync(dataDir)
      .filter((f) => f.endsWith(".json"))
      .map((f) => f.replace(".json", ""));
  } catch {
    return [];
  }
}

export function sentimentBySlug(slug: string): SentimentOutput | null {
  if (!/^[a-z0-9-]+$/.test(slug)) return null; // guard against path traversal
  const p = path.join(dataDir, `${slug}.json`);
  if (!existsSync(p)) return null;
  return JSON.parse(readFileSync(p, "utf8")) as SentimentOutput;
}

/** Biggest absolute sentiment delta among all shift events. */
export function biggestSwing(output: SentimentOutput): SentimentShift | null {
  if (!output.shifts.length) return null;
  return output.shifts.reduce((best, s) =>
    Math.abs(s.delta) > Math.abs(best.delta) ? s : best
  );
}

/** Count POS/NEG/NEU posts in the output. */
export function labelCounts(output: SentimentOutput) {
  let pos = 0, neg = 0, neu = 0;
  for (const p of output.posts) {
    if (p.label === "POS") pos++;
    else if (p.label === "NEG") neg++;
    else neu++;
  }
  return { pos, neg, neu, total: output.posts.length };
}
