import { AppChrome } from "@/components/app-chrome";
import {
  AgentActivity,
  CanvasSection,
  DataPlane,
  FixtureLine,
  HeroScene,
  MetricRun,
  RouteStack,
  SignalLine,
  SignalStat,
} from "@/components/cinematic";
import { allClubs, clubById, featuredFixture } from "@/lib/data";
import { allMatchViews } from "@/lib/match-view";
import simulation from "@/data/simulation.json";
import predictions from "@/data/predictions.json";
import accountability from "@/data/backtest/wc26-accountability.json";

export default function HomePage() {
  const featured = featuredFixture();
  const views = allMatchViews();
  const upcoming = views
    .filter((v) => v.fixture.slug !== featured.slug && (v.status === "locked" || v.status === "upcoming"))
    .slice(0, 6);
  const played = views.filter((v) => v.status === "official" || v.status === "informational").slice(0, 4);
  const clubs = allClubs();
  const byDataset = new Map(clubs.map((c) => [c.datasetName ?? c.name, c]));
  const sim = simulation as {
    teams: Record<string, { champion: number; reachFinal: number }>;
  };
  const leaders = Object.entries(sim.teams)
    .map(([name, o]) => ({ club: byDataset.get(name), champion: o.champion, final: o.reachFinal }))
    .filter((row): row is { club: ReturnType<typeof allClubs>[number]; champion: number; final: number } => Boolean(row.club))
    .sort((a, b) => b.champion - a.champion)
    .slice(0, 6);
  const leader = leaders[0];
  const officialCount = (accountability as { official: { aggregates: { n: number } } }).official
    .aggregates.n;
  const openLocks = (predictions as { entries: Array<{ result?: string }> }).entries.filter(
    (entry) => entry.result === undefined,
  ).length;

  return (
    <AppChrome route="home">
      <RouteStack>
        <HeroScene
          fixture={featured}
          home={clubById(featured.homeId)}
          away={clubById(featured.awayId)}
          kicker={
            <div className="grid gap-4 sm:grid-cols-2">
              <SignalStat label="Official sample" value={officialCount} detail="graded locks" />
              <SignalStat label="Open locks" value={openLocks} tone="warn" detail="frozen pre-kickoff" />
            </div>
          }
        />

        <SignalLine
          signals={[
            { label: "Official sample", value: officialCount, detail: "settled calls" },
            { label: "Open locks", value: openLocks, tone: "warn", detail: "pre-kickoff" },
            { label: "Favorite", value: leader?.champion * 100 || 0, suffix: "%", decimals: 1, tone: "up", detail: leader?.club.name },
            { label: "Played feed", value: played.length, detail: "latest results" },
            { label: "Next queue", value: upcoming.length, detail: "model briefings" },
          ]}
        />

        <CanvasSection eyebrow="Ways to use Matchday" title="A tournament desk, not a dashboard.">
          <div className="grid gap-10 md:grid-cols-2">
            <DataPlane>
              <p className="text-label">For match prep</p>
              <h2 className="text-display mt-3 text-4xl">Open the room before kickoff.</h2>
              <p className="text-caption mt-4 max-w-md">
                Fixtures, lock status, model split, score grid, and context sit in one staged match surface.
              </p>
            </DataPlane>
            <DataPlane>
              <p className="text-label">For accountability</p>
              <h2 className="text-display mt-3 text-4xl">Audit the ledger after the whistle.</h2>
              <p className="text-caption mt-4 max-w-md">
                Settled calls, caveats, Brier, RPS, and market comparison stay visible without retroactive edits.
              </p>
            </DataPlane>
          </div>
        </CanvasSection>

        <div className="grid gap-8 lg:grid-cols-[1fr_24rem]">
          <CanvasSection eyebrow="Cup race" title="The futures board is sorting itself.">
            <DataPlane>
              <MetricRun
                items={leaders.map((row, index) => ({
                  label: `${index + 1}. ${row.club.name}`,
                  value: `${(row.champion * 100).toFixed(1)}%`,
                  tone: index === 0 ? "up" : "neutral",
                }))}
              />
            </DataPlane>
          </CanvasSection>

          <AgentActivity
            items={[
              {
                label: "Settlement ledger synced",
                detail: `${officialCount} official graded calls are visible on the record page.`,
                tone: "up",
              },
              {
                label: "Locks remain frozen",
                detail: `${openLocks} pre-kickoff predictions are waiting on official results.`,
                tone: "warn",
              },
              {
                label: "Simulation board loaded",
                detail: `${leaders.length} contenders are driving the top of the champion tape.`,
              },
            ]}
          />
        </div>

        {played.length > 0 && (
          <CanvasSection eyebrow="Latest results" title="Settled calls, shown like a ledger.">
            <DataPlane>
              {played.map((view) => (
                <FixtureLine key={view.fixture.slug} view={view} density="compact" />
              ))}
            </DataPlane>
          </CanvasSection>
        )}
        <CanvasSection eyebrow="Next up" title="Upcoming match rooms.">
          <DataPlane>
            {upcoming.map((view) => (
              <FixtureLine key={view.fixture.slug} view={view} />
            ))}
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Start here" title="Follow the next lock, then hold the model to it.">
          <DataPlane>
            <div className="grid gap-5 md:grid-cols-3">
              <SignalStat label="Model rooms" value={upcoming.length} detail="upcoming fixtures" />
              <SignalStat label="Ledger entries" value={officialCount} detail="official sample" />
              <SignalStat label="Frozen calls" value={openLocks} tone="warn" detail="waiting on results" />
            </div>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </AppChrome>
  );
}
