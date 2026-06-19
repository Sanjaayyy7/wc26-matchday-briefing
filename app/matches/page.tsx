import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { MatchesFilter } from "@/components/matches-filter";
import { allMatchRows } from "@/lib/match-rows";
import knockouts from "@/data/knockouts.json";

export const metadata = { title: "Matches — Matchday Briefing" };

export default function MatchesPage() {
  const rows = allMatchRows();
  const played = rows.filter((row) => row.score).length;
  const locked = rows.filter((row) => row.split && !row.score).length;
  const upcoming = rows.length - played;
  return (
    <WCS26Shell
      route="matches"
      title="Fixture Board"
      rail={
        <SignalLine
          signals={[
            { label: "Fixtures", value: rows.length, detail: "group-stage board" },
            { label: "Played", value: played, tone: "up", detail: "resolved" },
            { label: "Open locks", value: locked, tone: "warn", detail: "pre-kickoff" },
            { label: "Upcoming", value: upcoming, detail: "queued" },
          ]}
        />
      }
    >
      <RouteStack className="min-w-0">
        <CanvasSection eyebrow="Terminal" title="Status lanes, probabilities, verdicts.">
          <DataPlane>
          <MatchesFilter rows={rows} />
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
