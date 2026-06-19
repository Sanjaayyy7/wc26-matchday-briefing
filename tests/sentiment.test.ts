import { describe, it, expect } from "vitest";
import { bucketByMinute, detectShift, type ScoredPost } from "@/lib/sentiment";
const mk = (m: number, label: ScoredPost["label"]): ScoredPost => ({ ts: m * 60000, minute: m, label });
describe("sentiment", () => {
  it("bucket fractions sum to ~1", () => {
    const [b0] = bucketByMinute([mk(1,"POS"),mk(2,"NEG"),mk(3,"NEU"),mk(4,"POS")], 5);
    expect(b0.posPct + b0.negPct + b0.neuPct).toBeCloseTo(1, 6);
    expect(b0.n).toBe(4);
  });
  it("detectShift negative when post-goal posts skew negative", () => {
    const posts = [mk(40,"POS"),mk(42,"POS"),mk(44,"NEU"),mk(46,"NEG"),mk(48,"NEG"),mk(50,"NEG")];
    const s = detectShift(posts, 45, 10);
    expect(s.delta).toBeLessThan(0);
    expect(s.nBefore).toBeGreaterThan(0); expect(s.nAfter).toBeGreaterThan(0);
  });
});
