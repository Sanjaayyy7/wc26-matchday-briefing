import { Suspense } from "react";
import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { DateGroupedMatches } from "@/components/date-grouped-matches";
import { allMatchViews, matchViewToRow } from "@/lib/match-view";
import { groupByMatchday, defaultSelectedIndex } from "@/lib/match-day-groups";
import knockouts from "@/data/knockouts.json";

export const metadata = { title: "Matches — Matchday Briefing" };

export default function MatchesPage() {
  const views = allMatchViews();

  // Rail counts derived from views (same source of truth as grouping)
  const settled = views.filter((v) => v.status === "official").length;
  const locked = views.filter((v) => v.status === "locked").length;
  const informational = views.filter((v) => v.status === "informational").length;

  // Group by ET calendar date; serialize to plain MatchRowData for the client
  const dayGroups = groupByMatchday(views);
  const groups = dayGroups.map((g) => ({
    dateISO: g.dateISO,
    label: g.label,
    rows: g.views.map(matchViewToRow),
  }));
  const defaultSelected = defaultSelectedIndex(dayGroups, new Date());

  return (
    <WCS26Shell
      route="matches"
      title="Fixture Board"
      rail={
        <div className="flex flex-col gap-3">
          <SignalLine
            signals={[
              { label: "Total", value: views.length, detail: "all fixtures" },
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
              <DateGroupedMatches
                groups={groups}
                defaultSelected={defaultSelected}
              />
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
