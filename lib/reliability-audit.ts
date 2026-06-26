import type { CalibrationBin } from "./accountability";

export type ReliabilityBin = {
  predicted: number; // 0..1 mean predicted probability
  observed: number;  // 0..1 observed outcome frequency
  n: number;
  gap: number;       // observed - predicted (signed)
  direction: "over" | "under" | "on";
};

export type ReliabilityAnalysis = {
  bins: ReliabilityBin[];
  ece: number | null;   // sample-weighted mean |gap|, 0..1
  callouts: string[];   // data-derived plain-English lines
  hasData: boolean;     // >= 2 usable bins
};

const ON_THRESHOLD = 0.05; // within 5 pts of the diagonal reads as "on"
const pct = (v: number): number => Math.round(v * 100);

function buildCallouts(bins: ReliabilityBin[], ece: number | null): string[] {
  const out: string[] = [];
  if (ece !== null) out.push(`ECE ${(ece * 100).toFixed(1)}% vs 3.0% target`);

  const over = bins.filter((b) => b.direction === "over");
  if (over.length) {
    const worst = over.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    out.push(
      `Around ${pct(worst.predicted)}% confidence the model is overconfident by ${Math.round(Math.abs(worst.gap) * 100)} pts`,
    );
  }
  const under = bins.filter((b) => b.direction === "under");
  if (under.length) {
    const worstU = under.reduce((a, b) => (Math.abs(b.gap) > Math.abs(a.gap) ? b : a));
    out.push(
      `Around ${pct(worstU.predicted)}% the model is underconfident by ${Math.round(Math.abs(worstU.gap) * 100)} pts`,
    );
  }
  const best = bins.reduce((a, b) => (Math.abs(b.gap) < Math.abs(a.gap) ? b : a));
  out.push(`Best calibrated around the ${pct(best.predicted)}% band`);
  return out;
}

export function analyzeReliability(bins: CalibrationBin[]): ReliabilityAnalysis {
  const usable = bins
    .filter((b) => b.n > 0)
    .sort((a, b) => a.predicted - b.predicted);
  if (usable.length < 2) {
    return { bins: [], ece: null, callouts: [], hasData: false };
  }
  const rbins: ReliabilityBin[] = usable.map((b) => {
    const gap = b.observed - b.predicted;
    const direction = Math.abs(gap) < ON_THRESHOLD ? "on" : gap < 0 ? "over" : "under";
    return { predicted: b.predicted, observed: b.observed, n: b.n, gap, direction };
  });
  const totalN = rbins.reduce((s, b) => s + b.n, 0);
  const ece = totalN > 0 ? rbins.reduce((s, b) => s + (b.n / totalN) * Math.abs(b.gap), 0) : null;
  return { bins: rbins, ece, callouts: buildCallouts(rbins, ece), hasData: true };
}
