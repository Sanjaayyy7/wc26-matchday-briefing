// Kalshi-style slip card. Server-safe: no hooks; reasoning expands via
// native <details>. Honesty-first: misses render exactly like hits.
import { Surface } from "@/components/ui/surface";
import { StageChip } from "@/components/stage-chip";
import { VerdictChip } from "@/components/verdict-chip";
import { verdictVar } from "@/lib/kit-color";
import type { ParlayLegView, ParlaySlipView } from "@/lib/parlay-view";

const pct = (x: number): string => `${(x * 100).toFixed(1)}%`;

function sideMid(leg: ParlayLegView): string {
  if (leg.kalshiMid === null) return "n/a";
  return pct(leg.kalshiMid);
}

function LegRow({ leg }: { leg: ParlayLegView }) {
  return (
    <div className="grid grid-cols-[2.5rem_1fr_auto] items-baseline gap-3 border-b border-[var(--line)] py-2 last:border-0">
      <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">{leg.side}</span>
      <div className="min-w-0">
        <p className="text-caption text-[var(--ink)]">
          {leg.hit !== null && (
            <span className="mr-1" style={{ color: verdictVar(leg.hit ? "hit" : "miss") }}>
              {leg.hit ? "✓" : "✗"}
            </span>
          )}
          {leg.title}
        </p>
      </div>
      <span className="text-caption tabular text-[var(--ink-muted)]">
        model {pct(leg.modelProb)} · Kalshi {sideMid(leg)}
      </span>
    </div>
  );
}

function StatusChip({ slip }: { slip: ParlaySlipView }) {
  if (slip.status === "hit") return <VerdictChip verdict="hit" />;
  if (slip.status === "miss") return <VerdictChip verdict="miss" />;
  const label = slip.status === "open" ? "Open" : "No slip";
  return (
    <span className="text-label inline-flex items-center rounded-sm border border-[var(--line)] px-2 py-0.5 text-[var(--ink-muted)]">
      {label}
    </span>
  );
}

export function ParlaySlipCard({ slip }: { slip: ParlaySlipView }) {
  return (
    <Surface className="p-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <StageChip stage={slip.stage} />
          <span className="text-body font-medium text-[var(--ink)]">{slip.matchup}</span>
        </div>
        <StatusChip slip={slip} />
      </div>

      {slip.status === "no-slip" ? (
        <p className="mt-3 text-caption text-[var(--ink-muted)]">
          No slip cleared the pre-registered floors: {slip.reason}
        </p>
      ) : (
        <>
          <div className="mt-3">
            {slip.legs.map((leg) => (
              <LegRow key={leg.ticker} leg={leg} />
            ))}
          </div>
          <div className="mt-3 flex items-baseline justify-between">
            <span className="text-label uppercase tracking-widest text-[var(--ink-faint)]">
              {slip.legs.length}-leg joint
            </span>
            {slip.jointProb !== undefined && (
              <span className="text-title tabular text-[var(--ink)]">{pct(slip.jointProb)}</span>
            )}
          </div>
          <details className="mt-2">
            <summary className="cursor-pointer text-label text-[var(--ink-muted)]">
              Per-leg reasoning
            </summary>
            <ul className="mt-2 space-y-2">
              {slip.legs.map((leg) => (
                <li key={leg.ticker} className="text-caption tabular text-[var(--ink-muted)]">
                  {leg.reasoning}
                </li>
              ))}
            </ul>
          </details>
        </>
      )}
    </Surface>
  );
}
