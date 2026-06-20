import { Suspense } from "react";
import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { MatchesFilter } from "@/components/matches-filter";
import { allMatchRows } from "@/lib/match-rows";
import knockouts from "@/data/knockouts.json";

export const metadata = { title: "Matches — Matchday Briefing" };

export default function MatchesPage() {
  const rows = allMatchRows();
  const settled = rows.filter((r) => r.status === "official").length;
  const locked = rows.filter((r) => r.status === "locked").length;
  const informational = rows.filter((r) => r.status === "informational").length;

  return (
    <WCS26Shell
      route="matches"
      title="Locked Predictions"
      rail={
        <div className="flex flex-col gap-3">
          <SignalLine
            signals={[
              { label: "Total", value: rows.length, detail: "all fixtures" },
              { label: "Settled", value: settled, tone: "up", detail: "graded" },
              { label: "Locked", value: locked, tone: "warn", detail: "in-flight" },
              { label: "Informational", value: informational, detail: "pre-lock" },
            ]}
          />
          <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)] lg:text-right">
            All predictions locked pre-kickoff · Never edited after lock
          </span>
        </div>
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Ledger" title="Every prediction, with its status.">
          <DataPlane>
            <Suspense fallback={<p className="text-caption">Loading predictions…</p>}>
              <MatchesFilter rows={rows} />
            </Suspense>
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Knockout shell" title="Round of 32 slots set after the groups.">
          <DataPlane>
            <div className="space-y-2">
              {(knockouts as Array<{ match: number; homeLabel: string; awayLabel: string }>).map(
                (k) => (
                  <div
                    key={k.match}
                    className="grid grid-cols-[5.5rem_1fr] items-center gap-4 border-b border-[var(--line)] py-3 opacity-70 last:border-0"
                  >
                    <span className="text-caption tabular">Match {k.match}</span>
                    <span className="text-caption">
                      {k.homeLabel} vs {k.awayLabel}
                    </span>
                  </div>
                ),
              )}
            </div>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
