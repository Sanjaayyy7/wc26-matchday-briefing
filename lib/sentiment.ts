export interface ScoredPost { ts: number; minute: number; label: "POS" | "NEG" | "NEU"; }
export interface Bucket { minuteBucket: number; posPct: number; negPct: number; neuPct: number; n: number; }
export function bucketByMinute(posts: ScoredPost[], size = 5): Bucket[] {
  const by = new Map<number, ScoredPost[]>();
  for (const p of posts) { const b = Math.floor(p.minute / size) * size; (by.get(b) ?? by.set(b, []).get(b)!).push(p); }
  return [...by.keys()].sort((a, b) => a - b).map((b) => {
    const arr = by.get(b)!, frac = (l: string) => arr.filter((p) => p.label === l).length / arr.length;
    return { minuteBucket: b, posPct: frac("POS"), negPct: frac("NEG"), neuPct: frac("NEU"), n: arr.length };
  });
}
export function detectShift(posts: ScoredPost[], eventMinute: number, window = 10) {
  const score = (p: ScoredPost) => (p.label === "POS" ? 1 : p.label === "NEG" ? -1 : 0);
  const range = (lo: number, hi: number) => posts.filter((p) => p.minute >= lo && p.minute < hi);
  const before = range(eventMinute - window, eventMinute), after = range(eventMinute, eventMinute + window);
  const mean = (a: ScoredPost[]) => (a.length ? a.reduce((s, p) => s + score(p), 0) / a.length : 0);
  const b = mean(before), a = mean(after);
  return { before: b, after: a, delta: a - b, nBefore: before.length, nAfter: after.length };
}
