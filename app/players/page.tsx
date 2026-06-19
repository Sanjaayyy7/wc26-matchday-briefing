import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { PlayerLeaderboard } from "@/components/player-leaderboard";
import { StyleClusterPlot } from "@/components/style-cluster-plot";
import { allPlayerRows, clusterSummary } from "@/lib/player-view";

export const metadata = { title: "Players — WC26 Matchday Briefing" };

export default function PlayersPage() {
  const players = allPlayerRows();
  const summary = clusterSummary();

  const topScorer = [...players].sort((a, b) => b.goals - a.goals)[0];
  const totalGoals = players.reduce((s, p) => s + p.goals, 0);
  const seededCount = players.filter((p) => p.isSeeded).length;

  return (
    <WCS26Shell
      route="players"
      title="Player Dossiers"
      rail={
        <SignalLine
          signals={[
            { label: "Players", value: players.length, detail: "tracked" },
            { label: "Goals", value: totalGoals, detail: "in dataset" },
            {
              label: "Top scorer",
              value: topScorer?.goals ?? 0,
              detail: topScorer?.name ?? "—",
              tone: "up",
            },
            { label: "Seeded", value: seededCount, detail: "low confidence" },
          ]}
        />
      }
    >
      <RouteStack>
        <CanvasSection eyebrow="Impact leaderboard" title="Ranked by shrunk per-90 impact.">
          <DataPlane>
            <PlayerLeaderboard players={players} />
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="Style clusters" title={`${summary.length} playing style groups (k-means, seed ${20260618}).`}>
          <DataPlane>
            <StyleClusterPlot players={players} summary={summary} />
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
