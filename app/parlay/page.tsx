import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { ParlaySlipCard } from "@/components/parlay-slip-card";
import { parlayLedger, parlayRecord, parlayViews } from "@/lib/parlay-view";

export const metadata = { title: "Parlays — Matchday Briefing" };

const pct = (x: number | null): string => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export default function ParlayPage() {
  const views = parlayViews();
  const record = parlayRecord(parlayLedger());

  const open = views.filter((v) => v.status === "open");
  const settled = views
    .filter((v) => v.status !== "open")
    .sort((a, b) => new Date(b.kickoffISO).getTime() - new Date(a.kickoffISO).getTime());

  return (
    <WCS26Shell
      route="parlay"
      title="Parlay Slips"
      rail={
        <div className="flex flex-col gap-3">
          <SignalLine
            signals={[
              { label: "Locked", value: record.slips, detail: "slips" },
              { label: "Graded", value: record.graded, detail: "settled" },
              { label: "Slip hits", value: record.slipHits, tone: "up", detail: `of ${record.graded} graded` },
              { label: "Leg hits", value: record.legHits, detail: `of ${record.legs} legs` },
            ]}
          />
          <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)] lg:text-right">
            Selection is pure model · Kalshi mids shown for benchmark only
          </span>
        </div>
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Open" title="Locked slips awaiting kickoff.">
          <DataPlane>
            {open.length === 0 ? (
              <p className="text-caption text-[var(--ink-muted)]">
                No open slips — the next lock runs before the coming round.
              </p>
            ) : (
              <div className="grid gap-4 lg:grid-cols-2">
                {open.map((slip) => (
                  <ParlaySlipCard key={slip.slug} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Record" title="Every slip, graded in public.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              Slip hit rate {pct(record.slipHitRate)} · leg hit rate {pct(record.legHitRate)} · locked joint
              average {pct(record.meanLockedJoint)} across graded slips. No-slip days recorded: {record.noSlips}.
            </p>
            {settled.length === 0 ? (
              <p className="mt-3 text-caption text-[var(--ink-muted)]">
                Nothing graded yet — the first slips settle with the quarter-finals.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {settled.map((slip) => (
                  <ParlaySlipCard key={slip.slug} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Protocol" title="Pre-registered, immutable, inspected.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              One slip per match, locked pre-kickoff into an append-only ledger. Legs come only from
              Kalshi-listed markets the model can price on its score grid; selection maximizes exact joint
              probability under pre-registered floors (every leg ≥ 60%, joint ≥ 35%, 2–5 legs, redundancy
              cap 97%). Regulation legs grade on the 90-minute score, advancement legs on the actual
              winner. A dedicated inspector recomputes every number from stored inputs on every run.
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
