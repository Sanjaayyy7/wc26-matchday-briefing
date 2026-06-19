/**
 * Aggregate player stats from match-facts.json + players.json,
 * then run k-means clustering and write:
 *   data/player-stats.json    — per-player aggregated stats with _prov
 *   data/player-clusters.json — k-means result with cluster assignments
 *
 * Deterministic + idempotent. Every row carries assertProvenance()-valid _prov.
 * String entries in match-facts.json are guarded/skipped (spec requirement).
 *
 *   npm run players:build
 */

import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { appDir } from "./shared.mts";
import { assertProvenance } from "../lib/provenance.js";
import { kmeans, standardize, silhouette } from "../lib/kmeans.js";
import type { PlayerRow } from "./fetch-players.mts";

const TODAY = new Date().toISOString().slice(0, 10);
const CLUSTER_SEED = 20260618;

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ScoreEntry { home: number; away: number }
interface ScorerEntry { player: string; team: string; minute: number; assist?: string }
interface CardEntry { player: string; team: string; type: string; minute: number }
interface MatchFactsEntry {
  score?: ScoreEntry;
  scorers?: ScorerEntry[];
  facts?: { cards?: CardEntry[]; possessionHome?: number; possessionAway?: number; shotsHome?: number; shotsAway?: number; onTargetHome?: number; onTargetAway?: number };
  btts?: boolean;
  totalGoals?: number;
  _sources?: string[];
}

export interface PlayerStatRow {
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

interface ClusterAssignment {
  playerId: string;
  cluster: number;
  distance: number;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function loadJSON<T>(relPath: string): T {
  return JSON.parse(readFileSync(path.join(appDir, relPath), "utf8")) as T;
}

/** Estimate minutes played for a player appearing in a match. */
function estimateMinutes(appearances: number): number {
  // Per WC group game: 90 min baseline; approximation for substitutes
  return appearances * 70; // conservative average (some subs play less)
}

// ---------------------------------------------------------------------------
// Main aggregation
// ---------------------------------------------------------------------------

async function main() {
  console.log("[build-player-stats] Loading players...");
  const players: PlayerRow[] = loadJSON<PlayerRow[]>("data/players.json");

  console.log("[build-player-stats] Loading match-facts...");
  const matchFacts = loadJSON<Record<string, MatchFactsEntry | string>>("data/match-facts.json");

  // Build player stat accumulators
  const statMap = new Map<string, {
    goals: number; assists: number; shots: number; keyPasses: number;
    minutes: number; appearances: number; sources: string[];
  }>();

  // Index players by name (normalized) and by id
  const playerByName = new Map<string, PlayerRow>();
  const playerById = new Map<string, PlayerRow>();
  for (const p of players) {
    playerById.set(p.id, p);
    playerByName.set(p.name.toLowerCase(), p);
  }

  // Initialize stat accumulators for all players
  for (const p of players) {
    statMap.set(p.id, { goals: 0, assists: 0, shots: 0, keyPasses: 0, minutes: 0, appearances: 0, sources: [] });
  }

  let fixturesProcessed = 0;
  let fixturesSkipped = 0;

  for (const [slug, entry] of Object.entries(matchFacts)) {
    // Guard string entries (spec requirement)
    if (slug === "_note") continue;
    if (typeof entry === "string") {
      console.warn(`[build-player-stats] Skipping string entry: ${slug}`);
      fixturesSkipped++;
      continue;
    }

    fixturesProcessed++;
    const sources = entry._sources ?? [];

    // Process scorers
    if (Array.isArray(entry.scorers)) {
      for (const scorer of entry.scorers) {
        const nameKey = scorer.player.toLowerCase();
        const p = playerByName.get(nameKey);
        if (!p) {
          // Create a minimal ad-hoc player from match data
          const teamId = scorer.team;
          const id = `${teamId}-${scorer.player.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "")}`;
          if (!playerById.has(id)) {
            const newPlayer: PlayerRow = {
              id,
              name: scorer.player,
              teamId,
              position: "FW",
              _prov: {
                source: sources[0] ?? "seed:match-facts",
                confidence: 0.7,
                verificationDate: TODAY,
                originType: sources.length > 0 ? "derived" : "seeded",
              },
            };
            players.push(newPlayer);
            playerById.set(id, newPlayer);
            playerByName.set(nameKey, newPlayer);
            statMap.set(id, { goals: 0, assists: 0, shots: 0, keyPasses: 0, minutes: 0, appearances: 0, sources: [] });
          }
        }
        const resolvedP = playerByName.get(nameKey);
        if (!resolvedP) continue;
        const acc = statMap.get(resolvedP.id)!;
        acc.goals++;
        acc.sources.push(...sources);
      }
    }

    // Process assists
    if (Array.isArray(entry.scorers)) {
      for (const scorer of entry.scorers) {
        if (!scorer.assist) continue;
        // Extract assisting player name (may have parenthetical notes)
        const assistRaw = scorer.assist.split("(")[0].trim();
        const assistKey = assistRaw.toLowerCase();
        const p = playerByName.get(assistKey);
        if (!p) continue;
        const acc = statMap.get(p.id)!;
        acc.assists++;
      }
    }

    // Count appearances: everyone with a scorer entry played (rough proxy)
    const seenInMatch = new Set<string>();
    if (Array.isArray(entry.scorers)) {
      for (const scorer of entry.scorers) {
        const nameKey = scorer.player.toLowerCase();
        const p = playerByName.get(nameKey);
        if (p && !seenInMatch.has(p.id)) {
          seenInMatch.add(p.id);
          const acc = statMap.get(p.id)!;
          acc.appearances++;
        }
      }
    }
  }

  console.log(`[build-player-stats] Processed ${fixturesProcessed} fixtures, skipped ${fixturesSkipped} string entries.`);

  // Estimate minutes from appearances
  for (const acc of statMap.values()) {
    if (acc.appearances > 0 && acc.minutes === 0) {
      acc.minutes = estimateMinutes(acc.appearances);
    }
    // Players with no appearances get a baseline of 0 (seeded)
  }

  // Build final stats with provenance
  const allStats: PlayerStatRow[] = [];
  for (const p of players) {
    const acc = statMap.get(p.id) ?? { goals: 0, assists: 0, shots: 0, keyPasses: 0, minutes: 0, appearances: 0, sources: [] };
    const hasRealData = acc.goals > 0 || acc.assists > 0 || acc.appearances > 0;
    const originalProv = p._prov;

    let originType: "verified" | "derived" | "seeded";
    let source: string;
    let confidence: number;

    if (hasRealData && acc.sources.length > 0) {
      originType = "derived";
      source = acc.sources[0];
      confidence = 0.75;
    } else if (originalProv?.originType === "verified") {
      originType = "derived";
      source = originalProv.source;
      confidence = 0.6;
    } else {
      originType = "seeded";
      source = "seed:wc26-known-roster";
      confidence = 0.3;
    }

    const statRow: PlayerStatRow = {
      id: p.id,
      name: p.name,
      teamId: p.teamId,
      position: p.position,
      goals: acc.goals,
      assists: acc.assists,
      shots: acc.shots,
      keyPasses: acc.keyPasses,
      minutes: acc.minutes,
      appearances: acc.appearances,
      _prov: {
        source,
        confidence,
        verificationDate: TODAY,
        originType,
      },
    };

    assertProvenance(statRow);
    allStats.push(statRow);
  }

  const statsOutPath = path.join(appDir, "data", "player-stats.json");
  writeFileSync(statsOutPath, JSON.stringify(allStats, null, 2) + "\n");
  console.log(`[build-player-stats] Wrote ${allStats.length} player stats → ${statsOutPath}`);

  // ---------------------------------------------------------------------------
  // K-means clustering
  // ---------------------------------------------------------------------------

  console.log("[build-player-stats] Building feature matrix for clustering...");

  // Feature set: [goals, assists, shots, keyPasses, minutes_normalized]
  // Use all players with at least some seeded data
  const features = ["goals", "assists", "shots", "keyPasses", "minutes"] as const;
  const featureVectors = allStats.map((s) => [
    s.goals,
    s.assists,
    s.shots,
    s.keyPasses,
    s.minutes / 90, // n90
  ]);

  // Standardize
  const { z: standardized } = standardize(featureVectors);

  // Pick k by silhouette (try k=3..6)
  let bestK = 3;
  let bestSil = -Infinity;
  const silScores: Record<number, number> = {};
  for (let k = 3; k <= 6; k++) {
    const result = kmeans(standardized, k, { seed: CLUSTER_SEED });
    const sil = silhouette(standardized, result.assignments, result.centroids);
    silScores[k] = sil;
    console.log(`[build-player-stats] k=${k} silhouette=${sil.toFixed(4)}`);
    if (sil > bestSil) {
      bestSil = sil;
      bestK = k;
    }
  }

  console.log(`[build-player-stats] Chose k=${bestK} (silhouette=${bestSil.toFixed(4)})`);

  // Run final k-means with chosen k
  const finalResult = kmeans(standardized, bestK, { seed: CLUSTER_SEED });

  // Label clusters by dominant characteristic
  function labelCluster(centroid: number[]): string {
    // centroid is in standardized space; use original feature ranking
    // We know: [goals, assists, shots, keyPasses, n90]
    const [g, a, s, kp] = centroid;
    if (g > 0.5) return "Scorer";
    if (a > 0.5) return "Creator";
    if (s > 0.3) return "Shooter";
    if (kp > 0.3) return "Playmaker";
    return "Utility";
  }

  const clusterLabels = finalResult.centroids.map((c, i) => ({
    cluster: i,
    label: labelCluster(c),
  }));

  // Build assignments with distances
  const assignments: ClusterAssignment[] = allStats.map((s, i) => {
    const cluster = finalResult.assignments[i];
    const centroid = finalResult.centroids[cluster];
    const pt = standardized[i];
    const dist = Math.sqrt(pt.reduce((acc, v, j) => acc + (v - centroid[j]) ** 2, 0));
    return { playerId: s.id, cluster, distance: parseFloat(dist.toFixed(4)) };
  });

  const clusterOut = {
    seed: CLUSTER_SEED,
    k: bestK,
    features: features as unknown as string[],
    silhouetteScores: silScores,
    centroids: finalResult.centroids,
    assignments,
    clusterLabels,
    _prov: {
      source: `derived:player-stats.json+kmeans(seed=${CLUSTER_SEED},k=${bestK})`,
      confidence: 0.75,
      verificationDate: TODAY,
      originType: "derived" as const,
    },
  };

  assertProvenance(clusterOut);

  const clusterOutPath = path.join(appDir, "data", "player-clusters.json");
  writeFileSync(clusterOutPath, JSON.stringify(clusterOut, null, 2) + "\n");
  console.log(`[build-player-stats] Wrote cluster data (k=${bestK}) → ${clusterOutPath}`);

  // Summary
  const seededCount = allStats.filter((s) => s._prov.originType === "seeded").length;
  const derivedCount = allStats.filter((s) => s._prov.originType === "derived").length;
  const verifiedCount = allStats.filter((s) => s._prov.originType === "verified").length;
  console.log(`[build-player-stats] Stats summary: derived=${derivedCount}, seeded=${seededCount}, verified=${verifiedCount}`);
  console.log(`[build-player-stats] Done.`);
}

const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;

if (isMain) {
  main().catch((err) => {
    console.error("[build-player-stats] Fatal:", err);
    process.exit(1);
  });
}
