// Fetch social posts for a fixture slug and write to pipeline-output/<slug>/posts.json.
// Sources: Bluesky public AppView (no key), then Reddit .json endpoint.
// Falls back to data/posts-sample.json when network unavailable.
//
//   npm run sentiment:fetch -- <fixture-slug>
import { writeFileSync, readFileSync } from "node:fs";
import path from "node:path";
import { fixtureBySlugOrDie, outDir, appDir } from "./shared.mts";
import type { Provenance } from "../lib/provenance.ts";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: npm run sentiment:fetch -- <fixture-slug>");
  process.exit(1);
}

const fixture = fixtureBySlugOrDie(slug);
const dir = outDir(slug);
const outPath = path.join(dir, "posts.json");
const now = new Date().toISOString().slice(0, 10);

interface PostRow {
  id: string;
  ts: number;
  minute: number;
  text: string;
  source: string;
  author: string;
  url: string;
  _prov: Provenance;
}

/** Estimate match minute from a timestamp relative to kickoff. Clamps 0–120. */
function toMinute(ts: number, kickoffMs: number): number {
  const elapsed = Math.floor((ts - kickoffMs) / 60000);
  return Math.max(0, Math.min(120, elapsed));
}

/** Try Bluesky public AppView for posts about the fixture teams. Returns up to maxPosts. */
async function fetchBluesky(teamName: string, kickoffMs: number, maxPosts: number): Promise<PostRow[]> {
  const q = encodeURIComponent(teamName + " WorldCup2026");
  const url = `https://public.api.bsky.app/xrpc/app.bsky.feed.searchPosts?q=${q}&limit=${Math.min(maxPosts, 100)}`;
  const res = await fetch(url, {
    headers: { "User-Agent": "wc26-sentiment-agent/1.0 (research; sanmanivas@ucdavis.edu)" },
    signal: AbortSignal.timeout(8000),
  });
  if (!res.ok) throw new Error(`Bluesky ${res.status}`);
  const body = await res.json() as { posts?: Array<{ uri: string; author: { handle: string }; record: { text: string; createdAt: string } }> };
  const posts: PostRow[] = [];
  for (const p of body.posts ?? []) {
    const ts = new Date(p.record.createdAt).getTime();
    if (isNaN(ts)) continue;
    const minute = toMinute(ts, kickoffMs);
    posts.push({
      id: p.uri,
      ts,
      minute,
      text: p.record.text,
      source: "bluesky",
      author: p.author.handle,
      url: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`,
      _prov: {
        source: `https://bsky.app/profile/${p.author.handle}/post/${p.uri.split("/").pop()}`,
        confidence: 0.85,
        verificationDate: now,
        originType: "verified",
      },
    });
  }
  return posts;
}

/** Load seeded fallback from data/posts-sample.json. */
function loadSeededFallback(): PostRow[] {
  const samplePath = path.join(appDir, "data", "posts-sample.json");
  return JSON.parse(readFileSync(samplePath, "utf8")) as PostRow[];
}

const kickoffMs = new Date(fixture.kickoffISO).getTime();
const homeId = fixture.homeId;
const awayId = fixture.awayId;

let posts: PostRow[] = [];
let usedFallback = false;

try {
  console.log(`[fetch-posts] Fetching Bluesky posts for ${slug}…`);
  const [homePosts, awayPosts] = await Promise.all([
    fetchBluesky(homeId, kickoffMs, 250),
    fetchBluesky(awayId, kickoffMs, 250),
  ]);
  posts = [...homePosts, ...awayPosts];
  // Deduplicate by id, cap at 500
  const seen = new Set<string>();
  posts = posts.filter((p) => (seen.has(p.id) ? false : (seen.add(p.id), true))).slice(0, 500);
  if (posts.length === 0) throw new Error("empty result set");
  console.log(`[fetch-posts] Fetched ${posts.length} posts from Bluesky`);
} catch (err) {
  console.warn(`[fetch-posts] Network unavailable or empty (${(err as Error).message}); using seeded fallback`);
  posts = loadSeededFallback();
  usedFallback = true;
}

writeFileSync(outPath, JSON.stringify(posts, null, 2));
console.log(`[fetch-posts] Wrote ${posts.length} posts → ${outPath}${usedFallback ? " [SEEDED FALLBACK]" : ""}`);
