export function EloSparkline({
  points,
  color,
  label,
}: {
  points: Array<{ date: string; elo: number }>;
  color: string;
  label: string;
}) {
  if (points.length < 2) return null;
  const W = 240;
  const H = 56;
  const elos = points.map((p) => p.elo);
  const min = Math.min(...elos);
  const max = Math.max(...elos);
  const span = Math.max(max - min, 40);
  const path = points
    .map((p, i) => {
      const x = (i / (points.length - 1)) * W;
      const y = H - ((p.elo - min) / span) * (H - 8) - 4;
      return `${i === 0 ? "M" : "L"}${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");
  const last = points.at(-1)!;
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-caption">
        {label} · {points[0].date} → {last.date}
      </span>
      <svg
        viewBox={`0 0 ${W} ${H}`}
        className="h-14 w-full"
        role="img"
        aria-label={`${label} Elo trend, now ${last.elo}`}
      >
        <path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinejoin="round" />
        <circle
          cx={W}
          cy={H - ((last.elo - min) / span) * (H - 8) - 4}
          r={3}
          fill={color}
        />
      </svg>
      <span className="tabular text-[13px] font-semibold">{last.elo}</span>
    </div>
  );
}
