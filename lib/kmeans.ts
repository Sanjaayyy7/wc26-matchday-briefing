import { mulberry32 } from "./rng";

export type Vec = number[];

const dist2 = (a: Vec, b: Vec) => a.reduce((s, _, j) => s + (a[j] - b[j]) ** 2, 0);

export function standardize(points: Vec[]) {
  const d = points[0].length, mean = Array(d).fill(0), std = Array(d).fill(0);
  for (const p of points) for (let j = 0; j < d; j++) mean[j] += p[j];
  for (let j = 0; j < d; j++) mean[j] /= points.length;
  for (const p of points) for (let j = 0; j < d; j++) std[j] += (p[j] - mean[j]) ** 2;
  for (let j = 0; j < d; j++) std[j] = Math.sqrt(std[j] / points.length) || 1;
  return { z: points.map((p) => p.map((v, j) => (v - mean[j]) / std[j])), mean, std };
}

export function kmeans(points: Vec[], k: number, opts: { seed: number; maxIter?: number; tol?: number }) {
  const rng = mulberry32(opts.seed), maxIter = opts.maxIter ?? 100, tol = opts.tol ?? 1e-6;
  const centroids: Vec[] = [points[Math.floor(rng() * points.length)].slice()];
  while (centroids.length < k) {
    const d2 = points.map((p) => Math.min(...centroids.map((c) => dist2(p, c))));
    const sum = d2.reduce((a, b) => a + b, 0) || 1; let r = rng() * sum, idx = 0;
    while (r > d2[idx] && idx < d2.length - 1) { r -= d2[idx]; idx++; }
    centroids.push(points[idx].slice());
  }
  const assignments = Array(points.length).fill(0); let inertia = 0;
  for (let it = 0; it < maxIter; it++) {
    inertia = 0;
    for (let i = 0; i < points.length; i++) {
      let best = 0, bd = Infinity;
      for (let c = 0; c < k; c++) { const dd = dist2(points[i], centroids[c]); if (dd < bd) { bd = dd; best = c; } }
      assignments[i] = best; inertia += bd;
    }
    const sums = Array.from({ length: k }, () => Array(points[0].length).fill(0)), counts = Array(k).fill(0);
    for (let i = 0; i < points.length; i++) { counts[assignments[i]]++; for (let j = 0; j < points[0].length; j++) sums[assignments[i]][j] += points[i][j]; }
    let shift = 0;
    for (let c = 0; c < k; c++) if (counts[c]) for (let j = 0; j < points[0].length; j++) { const nv = sums[c][j] / counts[c]; shift += (nv - centroids[c][j]) ** 2; centroids[c][j] = nv; }
    if (shift < tol) break;
  }
  return { centroids, assignments, inertia };
}

/**
 * Silhouette coefficient: mean of per-point silhouette scores.
 * Returns a value in [-1, 1]; higher is better (tighter, well-separated clusters).
 */
export function silhouette(points: Vec[], assignments: number[], centroids: Vec[]): number {
  const k = centroids.length;
  if (k <= 1) return 0;

  // Group indices by cluster
  const clusterIdx: number[][] = Array.from({ length: k }, () => []);
  for (let i = 0; i < points.length; i++) clusterIdx[assignments[i]].push(i);

  const scores: number[] = [];
  for (let i = 0; i < points.length; i++) {
    const ci = assignments[i];
    const same = clusterIdx[ci];

    // a(i): mean distance to own cluster members (excluding self)
    let a = 0;
    if (same.length > 1) {
      for (const j of same) if (j !== i) a += Math.sqrt(dist2(points[i], points[j]));
      a /= (same.length - 1);
    }

    // b(i): min mean distance to any other cluster
    let b = Infinity;
    for (let c = 0; c < k; c++) {
      if (c === ci) continue;
      const other = clusterIdx[c];
      if (other.length === 0) continue;
      let d = 0;
      for (const j of other) d += Math.sqrt(dist2(points[i], points[j]));
      d /= other.length;
      if (d < b) b = d;
    }
    if (!isFinite(b)) continue;

    const s = (b - a) / Math.max(a, b);
    scores.push(s);
  }
  if (scores.length === 0) return 0;
  return scores.reduce((sum, s) => sum + s, 0) / scores.length;
}
