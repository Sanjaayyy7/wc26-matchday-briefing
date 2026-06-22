import type { CalibrationBin } from "@/lib/accountability";
import { calibrationPoint, binDeviation } from "@/lib/calibration-diagram";

// Signature artifact: a server-rendered (SSR-first, no chart lib) reliability
// diagram. Predicted probability (x) vs observed frequency (y). The dashed
// diagonal is perfect calibration; the faint band is the "calibrated zone".
// Each bin is a node sized by sample count and coloured by error, with a
// drop-line to the diagonal that draws the miscalibration gap (the ECE), shown
// honestly. Built to the WC26 Design Constitution: real axes, sample encoding,
// one accent + the honest red, no decoration.

const SIZE = 320;
const PAD = 44;
const SPAN = SIZE - PAD * 2;
const BAND = 0.1; // ± calibrated-zone half-width (in probability units)
const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

const sx = (p: number) => PAD + p * SPAN;
const sy = (p: number) => SIZE - PAD - p * SPAN;

function dotColor(dev: number): string {
  if (dev < 0.05) return "var(--up)";
  if (dev > 0.15) return "var(--down)";
  return "var(--warn)";
}

export function CalibrationDiagram({
  bins,
  caption,
}: {
  bins: CalibrationBin[];
  caption?: string;
}) {
  const usable = bins.filter((b) => b.n > 0);
  if (usable.length < 2) {
    return (
      <p className="text-fine text-[var(--ink-faint)] py-8 text-center">
        Calibration diagram appears once ≥2 probability bins have settled matches.
      </p>
    );
  }

  const sorted = [...usable].sort((a, b) => a.predicted - b.predicted);
  const pts = sorted.map((b) => ({
    ...calibrationPoint(b, { size: SIZE, pad: PAD, rMin: 4, rMax: 14, k: 1.6 }),
    predicted: b.predicted,
    observed: b.observed,
    dev: binDeviation(b),
  }));
  const curve = pts.map((p) => `${p.cx.toFixed(1)},${p.cy.toFixed(1)}`).join(" ");
  const off = BAND * SPAN;

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-md"
        role="img"
        aria-label="Calibration reliability diagram: predicted probability versus observed outcome frequency"
      >
        {/* calibrated zone: a band around the perfect-calibration diagonal */}
        <polygon
          points={`${sx(0)},${sy(0) - off} ${sx(1)},${sy(1) - off} ${sx(1)},${sy(1) + off} ${sx(0)},${sy(0) + off}`}
          fill="var(--up)"
          fillOpacity={0.05}
        />

        {/* gridlines + ticks */}
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={sx(t)} y1={sy(0)} x2={sx(t)} y2={sy(1)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.4} />
            <line x1={sx(0)} y1={sy(t)} x2={sx(1)} y2={sy(t)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.4} />
            <text x={sx(t)} y={sy(0) + 18} textAnchor="middle" fontSize={10} fill="var(--ink-faint)" className="data-mono">
              {Math.round(t * 100)}
            </text>
            <text x={sx(0) - 10} y={sy(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-faint)" className="data-mono">
              {Math.round(t * 100)}
            </text>
          </g>
        ))}

        {/* axes */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(0)} stroke="var(--line)" strokeWidth={1} />
        <line x1={sx(0)} y1={sy(0)} x2={sx(0)} y2={sy(1)} stroke="var(--line)" strokeWidth={1} />

        {/* perfect-calibration diagonal */}
        <line x1={sx(0)} y1={sy(0)} x2={sx(1)} y2={sy(1)} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 4" />

        {/* miscalibration gap: drop-line from each bin to the diagonal */}
        {pts.map((p, i) => (
          <line
            key={`gap-${i}`}
            x1={p.cx}
            y1={p.cy}
            x2={p.cx}
            y2={sy(p.predicted)}
            stroke={dotColor(p.dev)}
            strokeWidth={1.5}
            opacity={0.45}
          />
        ))}

        {/* connecting curve through bins */}
        <polyline points={curve} fill="none" stroke="var(--ink-muted)" strokeWidth={1.25} strokeOpacity={0.7} />

        {/* bins: node sized by sample, coloured by error */}
        {pts.map((p, i) => (
          <circle key={`pt-${i}`} cx={p.cx} cy={p.cy} r={p.r} fill={dotColor(p.dev)} fillOpacity={0.92} stroke="var(--canvas)" strokeWidth={1} />
        ))}

        {/* axis labels */}
        <text x={sx(0.5)} y={SIZE - 8} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
          Predicted probability
        </text>
        <text x={14} y={sy(0.5)} textAnchor="middle" fontSize={11} fill="var(--ink-faint)" transform={`rotate(-90 14 ${sy(0.5)})`}>
          Observed frequency
        </text>
      </svg>

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fine text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />
          on the diagonal = calibrated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--down)" }} />
          drop-line = the gap we publish
        </span>
        <span>· bubble size = sample count</span>
      </div>
      {caption ? <figcaption className="text-fine text-[var(--ink-faint)]">{caption}</figcaption> : null}
    </figure>
  );
}
