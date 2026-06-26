"use client";

import { useState } from "react";
import type {
  ForecastGrade,
  CommandFixture,
  Dispatch,
  EvolutionEntry,
  ChampionProjection,
  SystemHealth,
} from "@/lib/command-data";
import type { Prediction } from "@/lib/predict";
import { ForecastRecord } from "./forecast-record";
import { MatchDetail } from "./match-detail";
import { ModelEvolution } from "./model-evolution";
import { ChampionshipProjection as ChampionProjectionPanel } from "./championship-projection";
import { LearningSignals } from "./learning-signals";
import { ReliabilityTimeline } from "./reliability-timeline";
import { WC26ShellHeader } from "@/components/wc26-shell-header";
import { Surface } from "@/components/ui/surface";
import type { ReliabilityTick } from "@/lib/command-data";

export type OperationalPrediction = {
  slug: string;
  prediction: Prediction;
};

type ClubInfo = { short: string; venue: string };

interface LearningSignal {
  id: string;
  status: "monitoring" | "resolved" | "action_required";
  category: string;
  title: string;
  issueDate: string;
  issue: string;
  evidence: string;
  action: string;
  result: string;
  promotionDecision: "DENIED" | "APPROVED" | "PENDING";
  promotionRationale: string;
  revisitDate: string;
  revisitTrigger: string;
  promotionRequiredN: number;
  currentN: number;
  drawGapObserved?: number;
  drawGapChallenger?: number;
}

type Props = {
  fixtures: CommandFixture[];
  operationalPredictions: OperationalPrediction[];
  defaultSlug: string;
  dispatch: Dispatch;
  evolutionLog: EvolutionEntry[];
  championshipProjections: ChampionProjection[];
  systemHealth: SystemHealth;
  matchdayLabel: string;
  nextClosing: string;
  clubMap: Map<string, ClubInfo>;
  learningSignals?: LearningSignal[];
  reliabilityTicks?: ReliabilityTick[];
};

function statusDot(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "var(--up)";
  if (status === "WARNING") return "var(--warn)";
  return "var(--down)";
}

function statusText(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "text-[var(--up)]";
  if (status === "WARNING") return "text-[var(--warn)]";
  return "text-[var(--down)]";
}

function metricColor(key: string, status: SystemHealth["status"]) {
  if (key === "Reliability (ECE)") return statusText(status);
  return "text-[var(--ink-muted)]";
}

export function CommandShell({
  fixtures,
  operationalPredictions,
  defaultSlug,
  dispatch,
  evolutionLog,
  championshipProjections,
  systemHealth,
  matchdayLabel,
  nextClosing,
  clubMap,
  learningSignals = [],
  reliabilityTicks = [],
}: Props) {
  const [selectedSlug, setSelectedSlug] = useState(defaultSlug);

  const predictionMap = new Map(operationalPredictions.map((p) => [p.slug, p.prediction]));
  const selectedPrediction = predictionMap.get(selectedSlug);
  const selectedFixture = fixtures.find((f) => f.slug === selectedSlug);
  const homeClub = clubMap.get(selectedSlug + "__home") ?? { short: "Home", venue: "" };
  const awayClub = clubMap.get(selectedSlug + "__away") ?? { short: "Away", venue: "" };

  // Suppress unused import warning — ForecastGrade is used by child components
  void (undefined as unknown as ForecastGrade);

  const dotColor = statusDot(systemHealth.status);
  const textCls = statusText(systemHealth.status);

  return (
    <>
      <WC26ShellHeader
        route="command"
        systemHealth={systemHealth}
        extra={
          <>
            <div className="flex items-center gap-1.5 px-4 border-l border-[var(--hairline)] text-[var(--ink-faint)]">
              <span className="text-fine">Next:</span>
              <span className="text-fine font-semibold text-[var(--warn)]">{nextClosing}</span>
            </div>
            <div className="ml-auto text-fine text-[var(--ink-faint)]">{matchdayLabel}</div>
          </>
        }
      />

      {/* 3-column body */}
      <div
        className="flex-1 overflow-hidden"
        style={{ display: "grid", gridTemplateColumns: "224px 1fr 256px", minHeight: 0 }}
      >
        {/* Left: Forecast Record */}
        <div className="border-r border-[var(--line)] overflow-y-auto">
          <ForecastRecord
            fixtures={fixtures}
            selectedSlug={selectedSlug}
            onSelect={setSelectedSlug}
          />
        </div>

        {/* Center: Match detail + Model Evolution */}
        <div className="overflow-y-auto">
          {selectedFixture && selectedPrediction ? (
            <MatchDetail
              fixture={selectedFixture}
              prediction={selectedPrediction}
              dispatch={dispatch}
              homeClub={homeClub}
              awayClub={awayClub}
            />
          ) : (
            <div className="p-6 text-[var(--ink-faint)] text-sm">Select a forecast from the left panel.</div>
          )}
          <ModelEvolution entries={evolutionLog} />
        </div>

        {/* Right: System health + projections */}
        <div className="border-l border-[var(--line)] overflow-y-auto">
          <div className="p-4 border-b border-[var(--hairline)]">
            <div className="text-label font-semibold text-[var(--ink)] mb-3">System Health</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
              <span className={`text-label font-semibold ${textCls}`}>{systemHealth.status}</span>
            </div>
            <Surface className="px-3 py-2 rounded-[var(--radius-card)]">
              {[
                { key: "Brier score", val: systemHealth.brier.toFixed(3) },
                { key: "Reliability (ECE)", val: `${(systemHealth.ece * 100).toFixed(1)}%` },
                { key: "RPS", val: systemHealth.rps.toFixed(3) },
              ].map(({ key, val }) => (
                <div key={key} className="flex justify-between items-center py-1 border-b border-[var(--hairline)] last:border-0">
                  <span className="text-slight text-[var(--ink-faint)]">{key}</span>
                  <span className={`text-slight font-semibold tabular-nums ${metricColor(key, systemHealth.status)}`}>{val}</span>
                </div>
              ))}
            </Surface>
            {systemHealth.status === "BREACH" && (
              <div className="mt-3 text-fine text-[var(--down)] leading-snug">
                All metrics exceed training-gate thresholds. Active investigation: LSig-001.
              </div>
            )}
          </div>
          <ChampionProjectionPanel projections={championshipProjections} />
        </div>
      </div>

      {/* Reliability Timeline — full width strip below 3-col grid */}
      {reliabilityTicks.length > 0 && (
        <div className="flex-shrink-0">
          <ReliabilityTimeline ticks={reliabilityTicks} />
        </div>
      )}

      {/* Learning Signals — full width below 3-col grid */}
      {learningSignals.length > 0 && (
        <div className="flex-shrink-0 border-t border-[var(--line)] overflow-y-auto max-h-[40vh]">
          <LearningSignals signals={learningSignals} />
        </div>
      )}
    </>
  );
}
