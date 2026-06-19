import "server-only";

import { readFileSync } from "node:fs";
import path from "node:path";
import { impactPer90 } from "./player-impact";

// Local type mirrors of the script types — keeps scripts excluded from TS compilation.
interface PlayerRow {
  id: string;
  name: string;
  teamId: string;
  position: string;
  _prov?: {
    source: string;
    confidence: number;
    verificationDate: string;
    originType: "verified" | "derived" | "seeded";
  };
}

interface PlayerStatRow {
  id: string;
  name: string;
  teamId: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  minutes: number;
  appearances: number;
  _prov: {
    source: string;
    confidence: number;
    verificationDate: string;
    originType: "verified" | "derived" | "seeded";
  };
}

// ---------------------------------------------------------------------------
// Raw data loading (JSON imported at server-render time)
// ---------------------------------------------------------------------------

const DATA_DIR = path.resolve(process.cwd(), "data");

function loadJSON<T>(name: string): T {
  return JSON.parse(readFileSync(path.join(DATA_DIR, name), "utf8")) as T;
}

interface ClubRow {
  id: string;
  name: string;
  short: string;
  primary: string;
  secondary: string;
  group?: string;
}

interface ClusterAssignment {
  playerId: string;
  cluster: number;
  distance: number;
}

interface ClusterData {
  k: number;
  features: string[];
  centroids: number[][];
  assignments: ClusterAssignment[];
  clusterLabels: Array<{ cluster: number; label: string }>;
}

// ---------------------------------------------------------------------------
// Public view types
// ---------------------------------------------------------------------------

export interface PlayerRowView {
  id: string;
  name: string;
  teamId: string;
  teamName: string;
  teamShort: string;
  teamPrimary: string;
  teamSecondary: string;
  position: string;
  goals: number;
  assists: number;
  shots: number;
  keyPasses: number;
  minutes: number;
  appearances: number;
  impact: number;
  cluster: number;
  clusterLabel: string;
  clusterDistance: number;
  isSeeded: boolean;
  group?: string;
}

export interface ClusterSummaryRow {
  cluster: number;
  label: string;
  playerCount: number;
  avgGoals: number;
  avgAssists: number;
  avgImpact: number;
  topPlayers: string[];
}

// ---------------------------------------------------------------------------
// Data accessors
// ---------------------------------------------------------------------------

function loadAll() {
  const players = loadJSON<PlayerRow[]>("players.json");
  const stats = loadJSON<PlayerStatRow[]>("player-stats.json");
  const clusters = loadJSON<ClusterData>("player-clusters.json");
  const clubs = loadJSON<ClubRow[]>("clubs.json");

  const clubMap = new Map<string, ClubRow>(clubs.map((c) => [c.id, c]));
  const statMap = new Map<string, PlayerStatRow>(stats.map((s) => [s.id, s]));
  const assignMap = new Map<string, ClusterAssignment>(
    clusters.assignments.map((a) => [a.playerId, a])
  );
  const labelMap = new Map<number, string>(
    clusters.clusterLabels.map((cl) => [cl.cluster, cl.label])
  );

  return { players, stats, clusters, clubs, clubMap, statMap, assignMap, labelMap };
}

export function allPlayerRows(): PlayerRowView[] {
  const { players, clubMap, statMap, assignMap, labelMap } = loadAll();

  return players.map((p) => {
    const club = clubMap.get(p.teamId);
    const stat = statMap.get(p.id);
    const assign = assignMap.get(p.id);

    const goals = stat?.goals ?? 0;
    const assists = stat?.assists ?? 0;
    const shots = stat?.shots ?? 0;
    const keyPasses = stat?.keyPasses ?? 0;
    const minutes = stat?.minutes ?? 0;
    const appearances = stat?.appearances ?? 0;
    const cluster = assign?.cluster ?? 0;
    const clusterDistance = assign?.distance ?? 0;

    const impact = impactPer90({
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      position: p.position,
      goals,
      assists,
      shots,
      keyPasses,
      minutes,
      appearances,
    });

    return {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      teamName: club?.name ?? p.teamId,
      teamShort: club?.short ?? p.teamId.toUpperCase(),
      teamPrimary: club?.primary ?? "var(--ink-muted)",
      teamSecondary: club?.secondary ?? "var(--bg)",
      position: p.position,
      goals,
      assists,
      shots,
      keyPasses,
      minutes,
      appearances,
      impact: parseFloat(impact.toFixed(4)),
      cluster,
      clusterLabel: labelMap.get(cluster) ?? `Cluster ${cluster}`,
      clusterDistance,
      isSeeded: p._prov?.originType === "seeded",
      group: club?.group,
    };
  });
}

export function playerById(id: string): PlayerRowView | null {
  const all = allPlayerRows();
  return all.find((p) => p.id === id) ?? null;
}

export function clusterSummary(): ClusterSummaryRow[] {
  const rows = allPlayerRows();
  const { clusters } = loadAll();

  const byCluster = new Map<number, PlayerRowView[]>();
  for (const r of rows) {
    const arr = byCluster.get(r.cluster) ?? [];
    arr.push(r);
    byCluster.set(r.cluster, arr);
  }

  return clusters.clusterLabels.map(({ cluster, label }) => {
    const members = byCluster.get(cluster) ?? [];
    const avgGoals = members.reduce((s, m) => s + m.goals, 0) / (members.length || 1);
    const avgAssists = members.reduce((s, m) => s + m.assists, 0) / (members.length || 1);
    const avgImpact = members.reduce((s, m) => s + m.impact, 0) / (members.length || 1);
    const topPlayers = [...members]
      .sort((a, b) => b.impact - a.impact)
      .slice(0, 3)
      .map((m) => m.name);

    return {
      cluster,
      label,
      playerCount: members.length,
      avgGoals: parseFloat(avgGoals.toFixed(2)),
      avgAssists: parseFloat(avgAssists.toFixed(2)),
      avgImpact: parseFloat(avgImpact.toFixed(4)),
      topPlayers,
    };
  });
}
