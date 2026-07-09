import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { ParlaySlipCard } from "@/components/parlay-slip-card";
import { parlayLedger, parlayRecord, parlayViews } from "@/lib/parlay-view";

export const metadata = { title: "Parlays — Matchday Briefing" };

const pct = (x: number | null): string => (x === null ? "—" : `${(x * 100).toFixed(1)}%`);

export default function ParlayPage() {
  const views = parlayViews();
  const rows = parlayLedger();
  const record = parlayRecord(rows);
  const recordV21 = parlayRecord(rows.filter((r) => r.engineVersion === "v2.1-combo"));
  const recordV2 = parlayRecord(rows.filter((r) => r.engineVersion === "v2-combo"));
  const recordV1 = parlayRecord(rows.filter((r) => r.engineVersion !== "v2.1-combo" && r.engineVersion !== "v2-combo"));

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
                  <ParlaySlipCard key={`${slip.slug}-${slip.engineVersion}`} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Record" title="Every slip, graded in public.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              v2.1 combo engine: slip hit rate {pct(recordV21.slipHitRate)} · leg hit rate {pct(recordV21.legHitRate)} ·
              locked joint average {pct(recordV21.meanLockedJoint)} across graded slips · no-slip days {recordV21.noSlips}.
            </p>
            <p className="mt-1 text-caption tabular text-[var(--ink-muted)]">
              v2 combo engine (legacy): slip hit rate {pct(recordV2.slipHitRate)} · leg hit rate {pct(recordV2.legHitRate)} ·
              locked joint average {pct(recordV2.meanLockedJoint)} across graded slips · no-slip days {recordV2.noSlips}.
            </p>
            <p className="mt-1 text-caption tabular text-[var(--ink-muted)]">
              v1 engine: slip hit rate {pct(recordV1.slipHitRate)} · leg hit rate {pct(recordV1.legHitRate)} ·
              locked joint average {pct(recordV1.meanLockedJoint)} across graded slips · no-slip days {recordV1.noSlips}.
            </p>
            {settled.length === 0 ? (
              <p className="mt-3 text-caption text-[var(--ink-muted)]">
                Nothing graded yet — the first slips settle with the quarter-finals.
              </p>
            ) : (
              <div className="mt-4 grid gap-4 lg:grid-cols-2">
                {settled.map((slip) => (
                  <ParlaySlipCard key={`${slip.slug}-${slip.engineVersion}`} slip={slip} />
                ))}
              </div>
            )}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Protocol" title="Pre-registered, immutable, inspected.">
          <DataPlane>
            <p className="text-caption tabular text-[var(--ink-muted)]">
              One slip per match, locked pre-kickoff into an append-only ledger. v2 slips draw only from
              markets the Kalshi combo builder can combine into one ticket — regulation and first-half
              moneylines, spreads, totals, both-teams-to-score, and advancement — priced on the model
              score grid with a pre-registered first-half split (q = 0.45). Selection maximizes exact joint
              probability under pre-registered v2 floors (every leg ≥ 75%, joint ≥ 60%, 2–4 legs, redundancy
              cap 97%). Combos allow at most one leg per market category; verified against the Kalshi
              collections API on 2026-07-09. Earlier v1 slips (leg ≥ 60%, joint ≥ 35%, 2–5 legs) remain in
              the ledger and grade under their own floors. Regulation legs grade on the 90-minute score,
              first-half legs on the half-time score, advancement legs on the actual winner. Goalscorer and
              corner markets are combo-eligible but unmodeled, so they are never selected. A dedicated
              inspector recomputes every number from stored inputs on every run.
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
