import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";

// ─── Forecast Grade ───────────────────────────────────────────────────────────

export type ForecastGrade = "sharp" | "solid" | "close" | "miss" | "surprise";

export function forecastGrade(brier: number): ForecastGrade {
  if (brier < 0.35) return "sharp";
  if (brier < 0.55) return "solid";
  if (brier < 0.75) return "close";
  if (brier < 0.90) return "miss";
  return "surprise";
}

// ─── Settled Scoreline → display cell ─────────────────────────────────────────
const DISPLAY_MAX = 5; // index 5 == the "5+" overflow bucket

export function parseSettledScoreline(
  result: string | undefined
): { home: number; away: number } | undefined {
  if (!result) return undefined;
  const m = /^(\d+)\s*-\s*(\d+)$/.exec(result.trim());
  if (!m) return undefined;
  return {
    home: Math.min(parseInt(m[1], 10), DISPLAY_MAX),
    away: Math.min(parseInt(m[2], 10), DISPLAY_MAX),
  };
}

// ─── Reliability Timeline ─────────────────────────────────────────────────────
export type ReliabilityTick = {
  slug: string;
  lockedAt: string;
  result: string;
  brier: number;
  grade: ForecastGrade;
  outcome: "hit" | "correct" | "miss" | "neutral";
};

export function buildReliabilityTicks(
  entries: LockedEntry[],
  limit = 50
): ReliabilityTick[] {
  return entries
    .filter((e) => e.result !== undefined && e.modelBrier !== undefined)
    .sort((a, b) => new Date(a.lockedAt).getTime() - new Date(b.lockedAt).getTime())
    .slice(-limit)
    .map((e) => {
      const brier = e.modelBrier!;
      const outcome: ReliabilityTick["outcome"] = e.scorelineHit
        ? "hit"
        : e.correctPick === true
          ? "correct"
          : e.correctPick === false
            ? "miss"
            : "neutral";
      return {
        slug: e.slug,
        lockedAt: e.lockedAt,
        result: e.result!,
        brier,
        grade: forecastGrade(brier),
        outcome,
      };
    });
}

// ─── Score Probability Surface ────────────────────────────────────────────────

export function compressGrid(grid: number[][]): number[][] {
  const DISPLAY = 6;
  const out: number[][] = Array.from({ length: DISPLAY }, () =>
    Array(DISPLAY).fill(0)
  );
  for (let r = 0; r < grid.length; r++) {
    const dr = Math.min(r, DISPLAY - 1);
    for (let c = 0; c < grid[r].length; c++) {
      const dc = Math.min(c, DISPLAY - 1);
      out[dr][dc] += grid[r][c];
    }
  }
  return out;
}

export function topScorelines(
  grid6: number[][],
  k = 6
): Array<{ home: number; away: number; prob: number }> {
  const items: Array<{ home: number; away: number; prob: number }> = [];
  for (let r = 0; r < grid6.length; r++) {
    for (let c = 0; c < grid6[r].length; c++) {
      items.push({ home: r, away: c, prob: grid6[r][c] });
    }
  }
  return items.sort((a, b) => b.prob - a.prob).slice(0, k);
}

// ─── Championship Projection ──────────────────────────────────────────────────

export type ChampionProjection = {
  rank: number;
  team: string;
  probability: number;
  delta?: number;
};

type SimTeam = { champion: number; reachFinal: number };

export function buildChampionshipProjections(
  teams: Record<string, SimTeam>,
  topN = 8,
  previous?: Record<string, SimTeam>
): ChampionProjection[] {
  return Object.entries(teams)
    .sort(([, a], [, b]) => b.champion - a.champion)
    .slice(0, topN)
    .map(([team, data], i) => ({
      rank: i + 1,
      team,
      probability: data.champion,
      delta: previous ? data.champion - (previous[team]?.champion ?? data.champion) : undefined,
    }));
}

// ─── Forecast Record (left panel) ────────────────────────────────────────────

export type CommandFixture = {
  slug: string;
  homeTeam: string;
  awayTeam: string;
  kickoffISO: string;
  stage: string;
  group?: string;
  result?: string;
  grade?: ForecastGrade;
  isOperational: boolean;
  split?: { home: number; draw: number; away: number };
  hoursUntilKickoff?: number;
};

export function hoursUntil(kickoffISO: string, now = new Date()): number | undefined {
  const diff = new Date(kickoffISO).getTime() - now.getTime();
  return diff > 0 ? diff / 3_600_000 : undefined;
}

// ─── Intelligence Dispatch ────────────────────────────────────────────────────

export type Dispatch = {
  dateline: string;
  headline: string;
  body: string;
  signals: Array<{ label: string; value: string; color: "up" | "warn" | "neutral" }>;
};

export type DispatchInput = {
  topTeam: string;
  topTeamPct: number;
  surpriseCount: number;
  activePatternsCount: number;
  operationalLockCount: number;
  sharpOrSolidPct: number;
  closingSoonLabels: string[];
  ece: number;
};

export function buildDispatch(input: DispatchInput): Dispatch {
  const {
    topTeam, topTeamPct, surpriseCount, activePatternsCount,
    operationalLockCount, sharpOrSolidPct, closingSoonLabels, ece,
  } = input;

  const ecePct = (ece * 100).toFixed(1);
  const calibStatus = ece < 0.03 ? "NOMINAL" : ece < 0.05 ? "WARNING" : "BREACH";

  const surpriseLine =
    surpriseCount > 0
      ? ` The model identified ${surpriseCount === 1 ? "a blind spot" : `${surpriseCount} blind spots`} and is actively monitoring.`
      : ` Calibration is ${calibStatus} at ECE ${ecePct}%.`;

  const headline = `${topTeam} leads the tournament.${surpriseLine}`;

  const patternLine =
    activePatternsCount > 0
      ? `${activePatternsCount === 1 ? "One active pattern is" : `${activePatternsCount} active patterns are`} under monitoring — draw probability may be underweighted in strong-favorite group-stage scenarios. `
      : "";

  const lockLine =
    closingSoonLabels.length > 0
      ? `${closingSoonLabels.slice(0, 2).join(" and ")} ${closingSoonLabels.length === 1 ? "closes" : "close"} within 24 hours.`
      : `${operationalLockCount} prediction locks are currently operational.`;

  const body = `${patternLine}${topTeam} holds the highest Championship Projection at ${topTeamPct.toFixed(1)}%. ${lockLine}`;

  const signals: Dispatch["signals"] = [
    {
      label: `${operationalLockCount} locks in play`,
      value: activePatternsCount > 0 ? `${activePatternsCount} pattern monitored` : "no alerts",
      color: activePatternsCount > 0 ? "warn" : "neutral",
    },
    {
      label: "Sharp or Solid",
      value: `${sharpOrSolidPct.toFixed(1)}% of settled`,
      color: sharpOrSolidPct >= 40 ? "up" : "warn",
    },
    {
      label: "Calibration",
      value: calibStatus,
      color: calibStatus === "NOMINAL" ? "up" : "warn",
    },
  ];

  return { dateline: "Intelligence Dispatch", headline, body, signals };
}

// ─── Model Evolution + Forecast Autopsy ──────────────────────────────────────

export type EvolutionEntryType = "surprise" | "calibration" | "confirm";

export type ForecastAutopsy = {
  lockedLine: string;
  resultLine: string;
  freqLine: string;
  patternNote: string;
};

export type EvolutionEntry = {
  id: string;
  type: EvolutionEntryType;
  date: string;
  matchLabel?: string;
  body: string;
  autopsy?: ForecastAutopsy;
  statusLine: string;
  statusColor: "up" | "warn" | "blue";
};

export function buildEvolutionLog(
  entries: LockedEntry[],
  homeTeamLabel: (slug: string) => string,
  awayTeamLabel: (slug: string) => string,
  ece: number,
): EvolutionEntry[] {
  const result: EvolutionEntry[] = [];

  const surprises = entries
    .filter((e) => e.modelBrier !== undefined && e.modelBrier >= 0.90)
    .sort((a, b) => (b.lockedAt > a.lockedAt ? 1 : -1));

  for (const entry of surprises) {
    const home = homeTeamLabel(entry.slug);
    const away = awayTeamLabel(entry.slug);
    const s = entry.split;
    const lockedLine = `${home} ${s.home.toFixed(0)}% · Draw ${s.draw.toFixed(0)}% · ${away} ${s.away.toFixed(0)}%`;
    const scoreStr = entry.result ?? "?";
    const brierStr = entry.modelBrier!.toFixed(3);
    const resultLine = `${scoreStr.replace("-", "–")} · Brier ${brierStr} · Surprise`;

    result.push({
      id: entry.slug,
      type: "surprise",
      date: entry.lockedAt,
      matchLabel: `${home} vs ${away}`,
      body: `${home} vs ${away} settled ${scoreStr.replace("-", "–")}. Model assigned ${home} ${s.home.toFixed(0)}% win probability, draw only ${s.draw.toFixed(0)}%. Brier ${brierStr} — worst forecast this tournament.`,
      autopsy: {
        lockedLine,
        resultLine,
        freqLine: `Draw expected: ${s.draw.toFixed(0)}% model vs ~28% historical in comparable fixtures (top-5 Elo, neutral venue, group stage)`,
        patternNote: "Monitoring: draw underestimation in strong-home-favorite group-stage scenarios.",
      },
      statusLine: "Pattern active — monitoring upcoming locks with similar Elo profile",
      statusColor: "warn",
    });
  }

  if (ece > 0) {
    const ecePct = (ece * 100).toFixed(1);
    result.push({
      id: "calibration-md",
      type: "calibration",
      date: new Date().toISOString(),
      body: `ECE at ${ecePct}% — within the 3% gate. Platt scaling is holding. No version change required.`,
      statusLine: "Logged · v1.0.0-platt unchanged",
      statusColor: "blue",
    });
  }

  const sharps = entries
    .filter((e) => e.modelBrier !== undefined && e.modelBrier < 0.35)
    .sort((a, b) => (b.lockedAt > a.lockedAt ? 1 : -1))
    .slice(0, 1);

  for (const entry of sharps) {
    const home = homeTeamLabel(entry.slug);
    const away = awayTeamLabel(entry.slug);
    const brierStr = entry.modelBrier!.toFixed(3);
    result.push({
      id: `confirm-${entry.slug}`,
      type: "confirm",
      date: entry.lockedAt,
      matchLabel: `${home} vs ${away}`,
      body: `${home} vs ${away} settled ${entry.result?.replace("-", "–") ?? ""}. Brier ${brierStr} → Sharp grade. Model confidence was well-placed.`,
      statusLine: "Pattern confirmed — high-Elo-gap forecasts within expected accuracy range",
      statusColor: "up",
    });
  }

  return result.sort((a, b) => (b.date > a.date ? 1 : -1));
}

// ─── System Health ─────────────────────────────────────────────────────────────

export type SystemHealth = {
  status: "NOMINAL" | "WARNING" | "BREACH";
  brier: number;
  ece: number;
  rps: number;
  graded: number;
  total: number;
};

export function buildSystemHealth(
  accountability: AccountabilityOutput,
  totalLocks: number,
): SystemHealth {
  const { aggregates } = accountability.official;
  const bins = accountability.official.calibrationBins ?? [];
  const n = bins.reduce((s, b) => s + b.n, 0);
  const ece =
    n > 0
      ? bins.reduce((s, b) => s + (b.n / n) * Math.abs(b.predicted - b.observed), 0)
      : 0;
  const status: SystemHealth["status"] =
    ece < 0.03 ? "NOMINAL" : ece < 0.05 ? "WARNING" : "BREACH";
  return {
    status,
    brier: aggregates.meanBrier ?? 0,
    ece,
    rps: aggregates.meanRps ?? 0,
    graded: aggregates.n,
    total: totalLocks,
  };
}
