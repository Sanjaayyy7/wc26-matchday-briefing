import {
  buildPulsePoints,
  pulsePath,
  pulseY,
  PULSE_BASELINE,
  type PulseVerdict,
} from "@/lib/forecast-pulse";

// "The Forecast Pulse" — the hero signature. A server-rendered EKG of every
// graded call: the dashed line is chance (Brier 0.667); the trace rises above
// it on sharp calls and sinks below on misses. The stroke is value-mapped
// (green high → red low), with a soft area fade for depth. A scan dot re-traces
// the record and the latest call pulses. SSR-first; animation is pure SMIL/CSS
// (60fps, no client JS, no blank paint), honouring prefers-reduced-motion.

const W = 680;
const H = 380;
const PAD = 30;

const COLOR: Record<PulseVerdict, string> = {
  nailed: "var(--verdict-nailed)",
  hit: "var(--up)",
  close: "var(--stage-sf)",
  miss: "var(--down)",
};

export function ForecastPulse() {
  const points = buildPulsePoints();
  if (points.length < 2) return null;

  const path = pulsePath(points, W, H, PAD);
  const baseY = pulseY(PULSE_BASELINE, H, PAD);
  const step = (W - PAD * 2) / (points.length - 1);
  const coords = points.map((p, idx) => ({
    ...p,
    x: PAD + idx * step,
    y: pulseY(p.brier, H, PAD),
  }));
  const first = coords[0];
  const last = coords[coords.length - 1];
  const floor = H - PAD;
  const areaPath = `${path} L ${last.x.toFixed(2)},${floor} L ${first.x.toFixed(2)},${floor} Z`;
  const gridYs = [PAD + (H - PAD * 2) * 0.18, baseY, PAD + (H - PAD * 2) * 0.82];

  return (
    <figure className="flex flex-col gap-3">
      <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
        Forecast pulse · {points.length} graded calls
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="w-full"
        role="img"
        aria-label="Forecast pulse: every settled prediction plotted against the chance baseline"
      >
        <defs>
          <linearGradient id="pulse-stroke" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--up)" }} />
            <stop offset="48%" style={{ stopColor: "var(--stage-sf)" }} />
            <stop offset="100%" style={{ stopColor: "var(--down)" }} />
          </linearGradient>
          <linearGradient id="pulse-area" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" style={{ stopColor: "var(--ink)" }} stopOpacity={0.1} />
            <stop offset="100%" style={{ stopColor: "var(--ink)" }} stopOpacity={0} />
          </linearGradient>
        </defs>

        {/* faint structural gridlines */}
        {gridYs.map((gy, i) => (
          <line
            key={i}
            x1={PAD}
            y1={gy}
            x2={W - PAD}
            y2={gy}
            stroke="var(--hairline)"
            strokeWidth={i === 1 ? 0 : 0.5}
            opacity={0.5}
          />
        ))}

        {/* chance baseline */}
        <line x1={PAD} y1={baseY} x2={W - PAD} y2={baseY} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 5" />

        {/* y anchors */}
        <text x={PAD} y={PAD - 10} fontSize={10} fill="var(--ink-faint)" className="data-mono">SHARP</text>
        <text x={W - PAD} y={baseY - 7} textAnchor="end" fontSize={11} fill="var(--ink-faint)" className="data-mono">chance · 0.667</text>
        <text x={PAD} y={floor + 16} fontSize={10} fill="var(--ink-faint)" className="data-mono">MISS</text>

        {/* depth fade under the trace */}
        <path d={areaPath} fill="url(#pulse-area)" stroke="none" />

        {/* the value-mapped pulse, drawing itself on load */}
        <path
          id="forecast-pulse-path"
          d={path}
          fill="none"
          stroke="url(#pulse-stroke)"
          strokeWidth={2}
          strokeLinejoin="round"
          strokeLinecap="round"
          pathLength={1}
          style={{ strokeDasharray: 1, strokeDashoffset: 1, animation: "pulse-draw 2.6s ease forwards" }}
        />

        {/* node per call, coloured by verdict */}
        {coords.map((c) => (
          <circle key={c.slug} cx={c.x} cy={c.y} r={2.4} fill={COLOR[c.verdict]} fillOpacity={0.95} />
        ))}

        {/* leading call: a steady dot with an expanding pulse ring */}
        <circle cx={last.x} cy={last.y} r={3.6} fill={COLOR[last.verdict]} />
        <circle cx={last.x} cy={last.y} r={3.6} fill="none" stroke={COLOR[last.verdict]} strokeWidth={1}>
          <animate attributeName="r" values="3.6;15" dur="2.4s" repeatCount="indefinite" />
          <animate attributeName="opacity" values="0.9;0" dur="2.4s" repeatCount="indefinite" />
        </circle>

        {/* scan dot re-tracing the record */}
        <circle r={3} fill="var(--ink)">
          <animateMotion dur="7s" repeatCount="indefinite">
            <mpath href="#forecast-pulse-path" />
          </animateMotion>
        </circle>
      </svg>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-fine text-[var(--ink-faint)]">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--up)" }} />
          above the line beats chance
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ background: "var(--down)" }} />
          below trends to a miss
        </span>
      </div>
    </figure>
  );
}
