export function StarField() {
  const stars = Array.from({ length: 64 }, (_, i) => {
    const cx = Math.round((Math.sin(i * 7.13) * 0.5 + 0.5) * 100 * 100) / 100;
    const cy = Math.round((Math.cos(i * 3.71) * 0.5 + 0.5) * 100 * 100) / 100;
    const r = ((i * 13) % 7) / 14 + 0.4;
    const o = 0.18 + ((i * 17) % 9) * 0.045;
    return { cx, cy, r, o };
  });
  return (
    <svg
      aria-hidden
      className="pointer-events-none absolute inset-0 h-full w-full opacity-70"
      style={{ animation: "starDrift 60s ease-in-out infinite alternate" }}
      viewBox="0 0 100 100"
      preserveAspectRatio="none"
    >
      {stars.map((s, i) => (
        <circle
          key={i}
          cx={s.cx}
          cy={s.cy}
          r={s.r}
          fill="var(--gold)"
          opacity={s.o}
        />
      ))}
    </svg>
  );
}
