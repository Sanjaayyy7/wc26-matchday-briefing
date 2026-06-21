import type { CalibrationBin } from "@/lib/accountability";
import { calibrationPoint, binDeviation } from "@/lib/calibration-diagram";

// Signature artifact: a server-rendered (SSR-first, no chart lib) reliability
// diagram. Each bin is plotted predicted (x) vs observed (y); the dashed
// diagonal is perfect calibration. Dots off the diagonal = miscalibration,
// shown honestly. Dot size ∝ sample n; colour ∝ calibration error.

const SIZE = 100;
const PAD = 12;

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

  const lo = PAD;
  const hi = SIZE - PAD;
  const mid = (lo + hi) / 2;
  const pts = usable.map((b) => ({
    ...calibrationPoint(b, { size: SIZE, pad: PAD }),
    dev: binDeviation(b),
  }));
  const curve = [...usable]
    .sort((a, b) => a.predicted - b.predicted)
    .map((b) => {
      const p = calibrationPoint(b, { size: SIZE, pad: PAD });
      return `${p.cx},${p.cy}`;
    })
    .join(" ");

  return (
    <figure className="flex flex-col gap-3">
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        className="w-full max-w-xs"
        role="img"
        aria-label="Calibration reliability diagram: predicted probability versus observed outcome frequency"
      >
        <line x1={lo} y1={hi} x2={hi} y2={hi} stroke="var(--line)" strokeWidth={0.4} />
        <line x1={lo} y1={lo} x2={lo} y2={hi} stroke="var(--line)" strokeWidth={0.4} />
        {/* perfect-calibration diagonal */}
        <line x1={lo} y1={hi} x2={hi} y2={lo} stroke="var(--hairline)" strokeWidth={0.6} strokeDasharray="2 2" />
        {/* model reliability curve */}
        <polyline points={curve} fill="none" stroke="var(--ink-faint)" strokeWidth={0.6} />
        {pts.map((p, i) => (
          <circle key={i} cx={p.cx} cy={p.cy} r={p.r} fill={dotColor(p.dev)} fillOpacity={0.85} />
        ))}
        <text x={mid} y={hi + 8} textAnchor="middle" fontSize={4} fill="var(--ink-faint)">
          Predicted
        </text>
        <text
          x={lo - 7}
          y={mid}
          textAnchor="middle"
          fontSize={4}
          fill="var(--ink-faint)"
          transform={`rotate(-90 ${lo - 7} ${mid})`}
        >
          Observed
        </text>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fine text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />
          on the diagonal = calibrated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--down)" }} />
          off = miscalibrated
        </span>
      </div>
      {caption ? <figcaption className="text-fine text-[var(--ink-faint)]">{caption}</figcaption> : null}
    </figure>
  );
}
