const STEPS = [
  "Competitive form, last 10 internationals",
  "Head-to-head, last two cycles",
  "Squads + absences from verified facts",
  "Tactical matchup, friction point",
  "Set pieces, unknowns flagged",
  "Tournament factors — travel, heat, stakes",
  "Market reconciliation",
  "Score distribution",
] as const;

export function ScaffoldPanel() {
  return (
    <details className="group mt-12 rounded-2xl bg-[var(--surface)] p-6 dark:border dark:border-[var(--hairline)]">
      <summary className="text-label flex cursor-pointer list-none items-center justify-between">
        How this briefing was assembled
        <span className="transition-transform duration-300 group-open:rotate-180" aria-hidden>
          ⌄
        </span>
      </summary>
      <ol className="mt-5 grid gap-3 sm:grid-cols-2">
        {STEPS.map((s, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-caption tabular pt-0.5">
              {String(i + 1).padStart(2, "0")}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </details>
  );
}
