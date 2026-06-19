import "server-only";
import {
  allFixtures,
  fixtureBySlug,
  clubById,
} from "@/lib/data";
import { predictFixture } from "@/lib/predict";
import type { LockedEntry } from "@/lib/predictions-ledger";
import type { AccountabilityOutput } from "@/lib/accountability";
import {
  forecastGrade,
  buildChampionshipProjections,
  buildDispatch,
  buildEvolutionLog,
  buildSystemHealth,
  hoursUntil,
  type CommandFixture,
  type DispatchInput,
} from "@/lib/command-data";
import { CommandShell, type OperationalPrediction } from "@/components/command/command-shell";
import predictionsData from "@/data/predictions.json";
import accountabilityData from "@/data/backtest/wc26-accountability.json";
import simulationData from "@/data/simulation.json";
import learningSignalsData from "@/data/learning-signals.json";

const predictions = (predictionsData as { entries: LockedEntry[] }).entries;
const accountability = accountabilityData as AccountabilityOutput;
const simulation = simulationData as {
  runMeta: unknown;
  teams: Record<string, { champion: number; reachFinal: number; reachR16?: number; reachQF?: number; reachSF?: number; advanceGroup?: number }>;
};

type ClubInfo = { short: string; venue: string };

export const metadata = { title: "Command — WC26 Forecasting" };

export default function CommandPage() {
  // ── 1. Build fixture map from predictions ────────────────────────────────
  const predMap = new Map(predictions.map((p) => [p.slug, p]));
  const allFix = allFixtures();

  // Only include fixtures we have predictions for
  const relevantFixtures = allFix.filter((f) => predMap.has(f.slug));

  // ── 2. Build CommandFixture list ─────────────────────────────────────────
  const commandFixtures: CommandFixture[] = relevantFixtures.map((f) => {
    const pred = predMap.get(f.slug)!;
    const homeClub = clubById(f.homeId);
    const awayClub = clubById(f.awayId);
    const isSettled = pred.result !== undefined;
    const grade =
      isSettled && pred.modelBrier !== undefined
        ? forecastGrade(pred.modelBrier)
        : undefined;
    return {
      slug: f.slug,
      homeTeam: homeClub.short,
      awayTeam: awayClub.short,
      kickoffISO: f.kickoffISO,
      stage: f.stage ?? "group",
      group: f.group,
      result: pred.result,
      grade,
      isOperational: !isSettled,
      split: !isSettled
        ? { home: pred.split.home, draw: pred.split.draw, away: pred.split.away }
        : undefined,
      hoursUntilKickoff: !isSettled ? hoursUntil(f.kickoffISO) : undefined,
    };
  });

  // ── 3. Compute predictions for operational locks ─────────────────────────
  const operationalPredictions: OperationalPrediction[] = [];
  for (const cf of commandFixtures) {
    if (!cf.isOperational) continue;
    const fixture = fixtureBySlug(cf.slug);
    if (!fixture) continue;
    try {
      const homeClub = clubById(fixture.homeId);
      const awayClub = clubById(fixture.awayId);
      const prediction = predictFixture({
        home: homeClub.datasetName ?? homeClub.name,
        away: awayClub.datasetName ?? awayClub.name,
        neutral: fixture.neutral ?? false,
        stage: fixture.stage ?? "group",
      });
      operationalPredictions.push({ slug: cf.slug, prediction });
    } catch {
      // Team not in model — skip silently
    }
  }

  // ── 4. Club info map for the selected fixture ────────────────────────────
  const clubMapEntries: Array<[string, ClubInfo]> = [];
  for (const f of relevantFixtures) {
    try {
      const home = clubById(f.homeId);
      const away = clubById(f.awayId);
      clubMapEntries.push([f.slug + "__home", { short: home.short, venue: home.venue }]);
      clubMapEntries.push([f.slug + "__away", { short: away.short, venue: away.venue }]);
    } catch {
      // Skip if club not found
    }
  }
  const clubMap = new Map<string, ClubInfo>(clubMapEntries);

  // ── 5. Default featured fixture (first operational by kickoff, or first settled) ──
  const operational = commandFixtures.filter((f) => f.isOperational);
  const sortedOp = [...operational].sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime()
  );
  const defaultSlug = sortedOp[0]?.slug ?? commandFixtures[0]?.slug ?? "";

  // ── 6. System health ─────────────────────────────────────────────────────
  const systemHealth = buildSystemHealth(accountability, predictions.length);

  // ── 7. Championship projections ──────────────────────────────────────────
  const championshipProjections = buildChampionshipProjections(simulation.teams, 8);

  // ── 8. Intelligence dispatch ─────────────────────────────────────────────
  const graded = predictions.filter((e) => e.modelBrier !== undefined);
  const sharpOrSolid = graded.filter((e) => e.modelBrier! < 0.55);
  const sharpOrSolidPct = graded.length > 0 ? (sharpOrSolid.length / graded.length) * 100 : 0;
  const surpriseEntries = graded.filter((e) => e.modelBrier! >= 0.9);

  const closingSoon = operational
    .filter((f) => f.hoursUntilKickoff !== undefined && f.hoursUntilKickoff <= 24)
    .map((f) => `${f.homeTeam}–${f.awayTeam}`);

  const dispatchInput: DispatchInput = {
    topTeam: championshipProjections[0]?.team ?? "Brazil",
    topTeamPct: (championshipProjections[0]?.probability ?? 0) * 100,
    surpriseCount: surpriseEntries.length,
    activePatternsCount: surpriseEntries.length > 0 ? 1 : 0,
    operationalLockCount: operational.length,
    sharpOrSolidPct,
    closingSoonLabels: closingSoon.slice(0, 2),
    ece: systemHealth.ece,
  };
  const dispatch = buildDispatch(dispatchInput);
  dispatch.dateline = `Intelligence Dispatch · ${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}`;

  // ── 9. Evolution log ─────────────────────────────────────────────────────
  const evolutionLog = buildEvolutionLog(
    predictions,
    (slug) => {
      const f = fixtureBySlug(slug);
      if (!f) return slug;
      try { return clubById(f.homeId).short; } catch { return slug; }
    },
    (slug) => {
      const f = fixtureBySlug(slug);
      if (!f) return slug;
      try { return clubById(f.awayId).short; } catch { return slug; }
    },
    systemHealth.ece,
  );

  // ── 10. Next-closing rail label ──────────────────────────────────────────
  const nextOp = [...operational]
    .filter((f) => f.hoursUntilKickoff !== undefined)
    .sort((a, b) => (a.hoursUntilKickoff ?? 9999) - (b.hoursUntilKickoff ?? 9999))[0];

  const nextClosing = nextOp
    ? `${nextOp.homeTeam}–${nextOp.awayTeam} closes in ${
        nextOp.hoursUntilKickoff! < 24
          ? `${Math.round(nextOp.hoursUntilKickoff!)}h`
          : `${Math.round(nextOp.hoursUntilKickoff! / 24)}d`
      }`
    : "No locks closing soon";

  // ── 11. Matchday label ───────────────────────────────────────────────────
  const matchdayLabel = `${new Date().toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })} · Matchday 9`;

  const learningSignals = (learningSignalsData as { signals: unknown[] }).signals;

  return (
    <CommandShell
      fixtures={commandFixtures}
      operationalPredictions={operationalPredictions}
      defaultSlug={defaultSlug}
      dispatch={dispatch}
      evolutionLog={evolutionLog}
      championshipProjections={championshipProjections}
      systemHealth={systemHealth}
      matchdayLabel={matchdayLabel}
      nextClosing={nextClosing}
      clubMap={clubMap}
      learningSignals={learningSignals as Parameters<typeof CommandShell>[0]["learningSignals"]}
    />
  );
}
