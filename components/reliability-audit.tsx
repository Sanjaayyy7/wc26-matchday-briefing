import type { CalibrationBin } from "@/lib/accountability";
import { analyzeReliability, type ReliabilityBin } from "@/lib/reliability-audit";

// SSR reliability audit: predicted (x) vs observed (y). The model curve vs the
// perfect-calibration diagonal; the area between them is the miscalibration we
// publish, shaded by direction. A sample-count histogram shares the x-axis.
const W = 460;
const H = 360;
const PAD_L = 40;
const PAD_R = 16;
const PAD_T = 16;
const PLOT_H = 248; // reliability plot height
const HIST_H = 56; // histogram height
const GAP = 16; // gap between plot and histogram
const SPAN_X = W - PAD_L - PAD_R;
const TICKS = [0, 0.25, 0.5, 0.75, 1] as const;

const x = (p: number) => PAD_L + p * SPAN_X;
const y = (p: number) => PAD_T + PLOT_H - p * PLOT_H;
const histTop = PAD_T + PLOT_H + GAP;

function gapColor(d: ReliabilityBin["direction"]): string {
  if (d === "on") return "var(--up)";
  if (d === "over") return "var(--down)";
  return "var(--warn)";
}

export function ReliabilityAudit({ bins, graded }: { bins: CalibrationBin[]; graded: number }) {
  const a = analyzeReliability(bins);
  if (!a.hasData) {
    return (
      <p className="text-fine text-[var(--ink-faint)] py-8 text-center">
        Reliability audit appears once ≥2 probability bins have settled matches.
      </p>
    );
  }
  const pts = a.bins;
  const maxN = Math.max(...pts.map((b) => b.n), 1);
  const curve = pts.map((b) => `${x(b.predicted).toFixed(1)},${y(b.observed).toFixed(1)}`).join(" ");

  // Closed band between the model curve and the diagonal = the published gap.
  const band =
    pts.map((b) => `${x(b.predicted).toFixed(1)},${y(b.observed).toFixed(1)}`).join(" ") +
    " " +
    [...pts].reverse().map((b) => `${x(b.predicted).toFixed(1)},${y(b.predicted).toFixed(1)}`).join(" ");

  const eceStr = a.ece !== null ? `${(a.ece * 100).toFixed(1)}%` : "—";

  return (
    <figure className="flex flex-col gap-5">
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Reliability audit: predicted probability versus observed outcome frequency, with sample-count histogram"
      >
        {/* gridlines + ticks */}
        {TICKS.map((t) => (
          <g key={t}>
            <line x1={x(t)} y1={y(0)} x2={x(t)} y2={y(1)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.5} />
            <line x1={x(0)} y1={y(t)} x2={x(1)} y2={y(t)} stroke="var(--hairline)" strokeWidth={0.5} opacity={0.5} />
            <text x={x(t)} y={histTop + HIST_H + 16} textAnchor="middle" fontSize={10} fill="var(--ink-faint)" className="data-mono">
              {Math.round(t * 100)}
            </text>
            <text x={x(0) - 8} y={y(t) + 3} textAnchor="end" fontSize={10} fill="var(--ink-faint)" className="data-mono">
              {Math.round(t * 100)}
            </text>
          </g>
        ))}

        {/* published miscalibration band (curve ↔ diagonal) */}
        <polygon points={band} fill="var(--down)" fillOpacity={0.12} />

        {/* perfect-calibration diagonal */}
        <line x1={x(0)} y1={y(0)} x2={x(1)} y2={y(1)} stroke="var(--ink-faint)" strokeWidth={1} strokeDasharray="3 4" />

        {/* model reliability curve */}
        <polyline points={curve} fill="none" stroke="var(--ink)" strokeWidth={1.75} />

        {/* bin nodes sized by n, coloured by direction */}
        {pts.map((b, i) => (
          <circle
            key={`pt-${i}`}
            cx={x(b.predicted)}
            cy={y(b.observed)}
            r={3 + Math.sqrt(b.n) * 1.4}
            fill={gapColor(b.direction)}
            fillOpacity={0.9}
            stroke="var(--canvas)"
            strokeWidth={1}
          />
        ))}

        {/* axis labels */}
        <text x={x(0.5)} y={H - 2} textAnchor="middle" fontSize={11} fill="var(--ink-faint)">
          Predicted probability
        </text>
        <text x={12} y={y(0.5)} textAnchor="middle" fontSize={11} fill="var(--ink-faint)" transform={`rotate(-90 12 ${y(0.5)})`}>
          Observed frequency
        </text>

        {/* sample-count histogram (shared x-axis) */}
        <line x1={x(0)} y1={histTop + HIST_H} x2={x(1)} y2={histTop + HIST_H} stroke="var(--line)" strokeWidth={1} />
        {pts.map((b, i) => {
          const bw = Math.max(6, (SPAN_X / pts.length) * 0.6);
          const bh = (b.n / maxN) * HIST_H;
          return (
            <rect
              key={`bar-${i}`}
              x={x(b.predicted) - bw / 2}
              y={histTop + HIST_H - bh}
              width={bw}
              height={bh}
              fill="var(--ink-muted)"
              fillOpacity={0.55}
            />
          );
        })}
        <text x={x(0) - 8} y={histTop + 8} textAnchor="end" fontSize={9} fill="var(--ink-faint)" className="data-mono">
          n
        </text>
      </svg>

      {/* legend */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fine text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />
          calibrated
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--down)" }} />
          overconfident
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--warn)" }} />
          underconfident
        </span>
        <span>· bubble = sample count</span>
      </div>

      {/* data-derived plain-English callouts */}
      <ul className="flex flex-col gap-1.5 border-t border-[var(--hairline)] pt-4">
        {a.callouts.map((c, i) => (
          <li key={i} className="text-caption flex items-start gap-2 text-[var(--ink-muted)]">
            <span aria-hidden className="mt-1 inline-block h-1 w-3 shrink-0" style={{ background: "var(--accent)" }} />
            <span className="tabular">{c}</span>
          </li>
        ))}
      </ul>

      <figcaption className="text-fine text-[var(--ink-faint)] tabular">
        {graded} graded · ECE {eceStr} vs 3.0% target
      </figcaption>
    </figure>
  );
}
