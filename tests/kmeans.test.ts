import { describe, it, expect } from "vitest";
import { kmeans, silhouette, standardize } from "@/lib/kmeans";

describe("kmeans", () => {
  it("deterministic for a fixed seed", () => {
    const pts = [[0,0],[0.1,0],[10,10],[10.1,9.9]];
    const a = kmeans(pts, 2, { seed: 7 }), b = kmeans(pts, 2, { seed: 7 });
    expect(b.assignments).toEqual(a.assignments);
    expect(b.centroids).toEqual(a.centroids);
  });

  it("separates two blobs", () => {
    const pts = [[0,0],[0.2,0.1],[0.1,-0.1],[20,20],[20.1,19.9],[19.8,20.2]];
    const { assignments } = kmeans(pts, 2, { seed: 1 });
    expect(assignments[0]).toBe(assignments[2]);
    expect(assignments[0]).not.toBe(assignments[3]);
  });
});

describe("silhouette", () => {
  it("prefers k=2 over k=3 on two-blob set", () => {
    const pts = [[0,0],[0.2,0.1],[0.1,-0.1],[20,20],[20.1,19.9],[19.8,20.2]];
    const r2 = kmeans(pts, 2, { seed: 1 });
    const r3 = kmeans(pts, 3, { seed: 1 });
    const s2 = silhouette(pts, r2.assignments, r2.centroids);
    const s3 = silhouette(pts, r3.assignments, r3.centroids);
    expect(s2).toBeGreaterThan(s3);
  });
});

describe("standardize", () => {
  it("zero-centers and scales to unit variance", () => {
    const pts = [[0, 10], [1, 20], [2, 30]];
    const { z } = standardize(pts);
    // mean of first col should be ~0
    const mean0 = z.reduce((s, p) => s + p[0], 0) / z.length;
    expect(Math.abs(mean0)).toBeLessThan(1e-10);
  });

  it("guards zero std (constant column) by using 1", () => {
    const pts = [[5, 0], [5, 1], [5, 2]];
    // col 0 is constant; should not throw or produce NaN
    const { z } = standardize(pts);
    expect(z.every((p) => isFinite(p[0]))).toBe(true);
  });
});
