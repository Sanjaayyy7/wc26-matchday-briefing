import { BrierBar } from "./brier-bar";
import { VerdictChip } from "./verdict-chip";
import type { Verdict } from "@/lib/kit-color";

export function SettlementRow({
  matchName,
  context,
  score,
  brier,
  verdict,
}: {
  matchName: string;
  context: string;
  score: string;
  brier: number;
  verdict: Verdict;
}) {
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--hairline)] last:border-0 transition-colors duration-300 hover:bg-[var(--surface)]">
      <div className="min-w-0 flex-1">
        <div className="text-title truncate">{matchName}</div>
        <div className="text-caption text-[var(--ink-faint)] truncate">{context}</div>
      </div>
      <div className="text-mono data-mono tabular text-[var(--ink-muted)] w-12 text-right">{score}</div>
      <div className="flex items-center gap-2 w-28 justify-end">
        <span className="text-mono data-mono tabular text-[var(--ink-muted)]">{brier.toFixed(3)}</span>
        <BrierBar brier={brier} />
      </div>
      <div className="w-20 flex justify-end">
        <VerdictChip verdict={verdict} />
      </div>
    </div>
  );
}
