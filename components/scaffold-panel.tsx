const STEPS = [
  "Recent form, last 6 league games",
  "Head-to-head, last 5 meetings",
  "Expected lineups + absentees",
  "Tactical matchup, friction point",
  "Set-piece edge",
  "Referee + venue factors",
  "Motivation / table state",
  "Score distribution",
] as const;

export function ScaffoldPanel() {
  return (
    <details className="mt-8 rounded-2xl border border-[var(--hairline)] bg-[var(--surface)] p-4">
      <summary className="cursor-pointer text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--ink-muted)]">
        How this briefing was assembled
      </summary>
      <ol className="mt-4 grid gap-2 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3 text-sm">
            <span className="font-mono text-[var(--gold)]">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
