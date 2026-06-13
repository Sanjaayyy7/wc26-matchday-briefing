import Link from "next/link";
import { kitAccent } from "@/lib/kit-color";
import { StageChip } from "./stage-chip";
import { VerdictChip } from "./verdict-chip";
import type { MatchRowData } from "@/lib/match-view";

function Dot({ color, fallback }: { color: string; fallback: "up" | "down" }) {
  return (
    <span
      className="h-2 w-2 shrink-0 rounded-full"
      style={{ background: kitAccent(color, fallback) }}
      aria-hidden
    />
  );
}

export function MatchRow({ m }: { m: MatchRowData }) {
  return (
    <Link
      href={`/fixture/${m.slug}`}
      className="grid gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 transition-colors duration-300 hover:bg-[var(--elevated)] dark:border dark:border-[var(--hairline)] sm:grid-cols-[6rem_1fr_auto] sm:items-center"
    >
      <div className="flex items-center gap-2 sm:flex-col sm:items-start">
        <span className="text-caption tabular">{m.dateLabel}</span>
        <StageChip stage={m.stage} />
      </div>
      <div className="flex min-w-0 flex-col gap-1">
        <span className="text-title flex items-center gap-2 truncate">
          <Dot color={m.homeColor} fallback="up" /> {m.homeName}
        </span>
        <span className="text-title flex items-center gap-2 truncate">
          <Dot color={m.awayColor} fallback="down" /> {m.awayName}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:flex-col sm:items-end sm:gap-1">
        {m.score ? (
          <>
            <span className="text-display tabular text-2xl">{m.score}</span>
            {m.verdict && <VerdictChip verdict={m.verdict} />}
            {m.grade && (
              <span className="text-caption tabular">
                Brier {m.grade.brier.toFixed(3)} · RPS {m.grade.rps.toFixed(3)}
              </span>
            )}
            {m.note && <span className="text-caption">{m.note}</span>}
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
