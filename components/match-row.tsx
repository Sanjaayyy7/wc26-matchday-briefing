import Link from "next/link";

export type MatchRowData = {
  slug: string;
  dateLabel: string;
  group: string;
  stage: string;
  homeName: string;
  awayName: string;
  homeColor: string;
  awayColor: string;
  score?: string;
  split?: { home: number; draw: number; away: number };
  pick?: { label: string; pct: number; correct?: boolean };
};

function Dot({ color }: { color: string }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: color }}
      aria-hidden
    />
  );
}

export function MatchRow({ m }: { m: MatchRowData }) {
  return (
    <Link
      href={`/fixture/${m.slug}`}
      className="grid grid-cols-[5.5rem_1fr_auto] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 transition-colors duration-300 hover:bg-[var(--elevated)] dark:border dark:border-[var(--hairline)]"
    >
      <div className="flex flex-col">
        <span className="text-caption tabular">{m.dateLabel}</span>
        <span className="text-caption">Group {m.group}</span>
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="flex items-center gap-2 truncate text-[15px] font-medium">
          <Dot color={m.homeColor} /> {m.homeName}
        </span>
        <span className="flex items-center gap-2 truncate text-[15px] font-medium">
          <Dot color={m.awayColor} /> {m.awayName}
        </span>
      </div>
      <div className="flex flex-col items-end gap-1">
        {m.score ? (
          <>
            <span className="tabular text-[17px] font-bold">{m.score}</span>
            {m.pick && (
              <span
                className={`text-caption tabular ${
                  m.pick.correct === undefined
                    ? ""
                    : m.pick.correct
                      ? "text-[var(--up)]"
                      : "text-[var(--down)]"
                }`}
              >
                picked {m.pick.label} {m.pick.pct}%{" "}
                {m.pick.correct === undefined ? "" : m.pick.correct ? "✓" : "✗"}
              </span>
            )}
          </>
        ) : m.split ? (
          <span className="text-caption tabular">
            <span className="text-[var(--up)]">{m.split.home}</span>
            {" / "}
            {m.split.draw}
            {" / "}
            <span className="text-[var(--down)]">{m.split.away}</span>
          </span>
        ) : null}
      </div>
    </Link>
  );
}
