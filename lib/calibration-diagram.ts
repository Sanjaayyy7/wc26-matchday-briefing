// Pure geometry for the homepage calibration reliability diagram.
// Maps a calibration bin (predicted, observed, n) to SVG coordinates:
// predicted → x (left→right), observed → y (bottom→top, inverted), n → radius.

export type CalibBinInput = { predicted: number; observed: number; n: number };
export type CalibPoint = { cx: number; cy: number; r: number };

export type CalibOpts = {
  size: number;
  pad: number;
  rMin?: number;
  rMax?: number;
  k?: number;
};

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v));

export function calibrationPoint(bin: CalibBinInput, opts: CalibOpts): CalibPoint {
  const { size, pad, rMin = 1.5, rMax = 5, k = 0.6 } = opts;
  const span = size - 2 * pad;
  const cx = pad + clamp01(bin.predicted) * span;
  const cy = size - pad - clamp01(bin.observed) * span;
  const r = Math.min(rMax, Math.max(rMin, rMin + Math.sqrt(Math.max(0, bin.n)) * k));
  return { cx, cy, r };
}

// Calibration error for a bin = |predicted − observed|. Drives dot colour.
export function binDeviation(bin: { predicted: number; observed: number }): number {
  return Math.abs(bin.predicted - bin.observed);
}
