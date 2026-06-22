import Link from "next/link";
import { matchdayRead, tagPhrase, type Split } from "@/lib/todays-matchday";

export type TodaysMatch = {
  slug: string;
  home: string;
  away: string;
  koET: string;
  split: Split;
};

const TAG_COLOR = {
  STRONG: "var(--up)",
  EDGE: "var(--stage-sf)",
  TIGHT: "var(--ink-muted)",
} as const;

function Bar({ label, pct, fav }: { label: string; pct: number; fav: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="w-12 truncate text-fine text-[var(--ink-faint)]">{label}</span>
      <span className="h-1 flex-1 overflow-hidden bg-[var(--hairline)]">
        <span
          className="block h-full"
          style={{ width: `${pct}%`, background: fav ? "var(--up)" : "var(--neutral-fill)" }}
        />
      </span>
      <span className="w-8 text-right text-fine data-mono tabular text-[var(--ink-muted)]">{pct}</span>
    </div>
  );
}

export function MatchdayToday({ matches }: { matches: TodaysMatch[] }) {
  if (matches.length === 0) {
    return (
      <p className="text-fine text-[var(--ink-faint)]">No locked fixtures today — next matchday loads at lock.</p>
    );
  }

  return (
    <div className="grid gap-x-10 gap-y-8 sm:grid-cols-2 lg:grid-cols-4">
      {matches.map((m) => {
        const read = matchdayRead(m.split);
        const favLabel = read.favorite === "draw" ? "a draw" : read.favorite === "home" ? m.home : m.away;
        return (
          <Link
            key={m.slug}
            href={`/fixture/${m.slug}`}
            className="group flex flex-col gap-3 border-t border-[var(--line)] pt-4 transition-colors duration-300"
          >
            <div className="flex items-baseline justify-between gap-2">
              <span className="text-title transition-colors duration-300 group-hover:text-[var(--up)]">
                {m.home} <span className="text-[var(--ink-faint)]">v</span> {m.away}
              </span>
              <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">Locked</span>
            </div>
            <span className="text-slight data-mono text-[var(--ink-muted)]">{m.koET}</span>

            <div className="flex flex-col gap-1.5">
              <Bar label={m.home} pct={m.split.home} fav={read.favorite === "home"} />
              <Bar label="Draw" pct={m.split.draw} fav={read.favorite === "draw"} />
              <Bar label={m.away} pct={m.split.away} fav={read.favorite === "away"} />
            </div>

            <div className="flex items-center gap-2 text-fine text-[var(--ink-muted)]">
              <span
                className="data-mono uppercase tracking-wider"
                style={{ color: TAG_COLOR[read.tag] }}
              >
                {read.tag}
              </span>
              <span>
                Model backs {favLabel}{" "}
                <span className="data-mono tabular text-[var(--ink)]">{read.conf}%</span> ·{" "}
                {tagPhrase(read.tag)}
              </span>
            </div>
          </Link>
        );
      })}
    </div>
  );
}
