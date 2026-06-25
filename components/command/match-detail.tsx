"use client";

import type { Dispatch, CommandFixture } from "@/lib/command-data";
import { parseSettledScoreline } from "@/lib/command-data";
import type { Prediction } from "@/lib/predict";
import { ScoreProbabilitySurface } from "./score-probability-surface";
import { ForecastDrivers } from "./forecast-drivers";
import { Surface } from "@/components/ui/surface";

type ClubInfo = { short: string; venue: string };

type Props = {
  fixture: CommandFixture;
  prediction: Prediction;
  dispatch: Dispatch;
  homeClub: ClubInfo;
  awayClub: ClubInfo;
  kalshiHomePct?: number;
};

function DispatchCard({ dispatch }: { dispatch: Dispatch }) {
  return (
    <Surface className="mx-4 mt-4 mb-0 px-5 py-4 border-b-0">
      <div className="text-tiny font-semibold uppercase tracking-widest text-[var(--accent)] mb-2">
        {dispatch.dateline}
      </div>
      <div className="text-label font-semibold text-[var(--ink)] leading-snug mb-2">
        {dispatch.headline}
      </div>
      <div className="text-slight text-[var(--ink-muted)] leading-relaxed max-w-xl">
        {dispatch.body}
      </div>
      <div className="flex gap-4 mt-3">
        {dispatch.signals.map((s) => (
          <div key={s.label} className="flex items-center gap-1.5 text-slight text-[var(--ink-faint)]">
            <span>{s.label}</span>
            <span className={`font-semibold ${
              s.color === "up" ? "text-[var(--up)]" : s.color === "warn" ? "text-[var(--warn)]" : "text-[var(--ink-muted)]"
            }`}>{s.value}</span>
          </div>
        ))}
      </div>
    </Surface>
  );
}

export function MatchDetail({ fixture, prediction, dispatch, homeClub, awayClub, kalshiHomePct }: Props) {
  const { split } = prediction;
  const homeWins = split.home >= split.draw && split.home >= split.away;
  const drawWins = split.draw > split.home && split.draw > split.away;

  return (
    <>
      <DispatchCard dispatch={dispatch} />

      {/* Match header */}
      <div className="px-6 py-5 mt-4 border-b border-[var(--hairline)]">
        <div className="flex items-center justify-between text-fine text-[var(--ink-faint)] mb-2.5">
          <span>
            {fixture.group ? `Group ${fixture.group.replace("Group ", "")} · ` : ""}
            {new Date(fixture.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" })}
            {" · "}
            {homeClub.venue}
          </span>
          {fixture.isOperational && fixture.hoursUntilKickoff !== undefined && (
            <span className="text-[var(--warn)] font-medium">
              Closes {fixture.hoursUntilKickoff < 24
                ? `in ${Math.round(fixture.hoursUntilKickoff)}h`
                : `${Math.round(fixture.hoursUntilKickoff / 24)}d`}
            </span>
          )}
        </div>

        <div className="text-2xl font-bold mb-1">
          <span className="text-[var(--ink)]">{fixture.homeTeam}</span>
          <span className="mx-2 text-sm font-normal text-[var(--ink-faint)]">vs</span>
          <span className="text-[var(--ink-muted)]">{fixture.awayTeam}</span>
        </div>

        {/* 3-way probability */}
        <div className="flex gap-0.5 mt-4">
          {[
            { label: `${fixture.homeTeam} win`, pct: Math.round(split.home), winner: homeWins },
            { label: "Draw", pct: Math.round(split.draw), winner: drawWins },
            { label: `${fixture.awayTeam} win`, pct: Math.round(split.away), winner: !homeWins && !drawWins },
          ].map(({ label, pct, winner }) => (
            <div
              key={label}
              className={[
                "flex-1 px-3 py-2.5 relative border-t",
                winner ? "border-[var(--up)]" : "border-[var(--hairline)]",
              ].join(" ")}
            >
              <div className="text-tiny text-[var(--ink-faint)] uppercase tracking-widest mb-1.5">{label}</div>
              <div className={`text-2xl font-bold tabular-nums ${winner ? "text-[var(--up)]" : "text-[var(--ink-muted)]"}`}>
                {pct}%
              </div>
              <div
                className="absolute bottom-0 left-0 h-0.5"
                style={{
                  width: `${pct}%`,
                  background: winner ? "var(--up)" : "var(--line)",
                }}
              />
            </div>
          ))}
        </div>
      </div>

      {/* Forecast Drivers */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ForecastDrivers
          prediction={prediction}
          homeClub={homeClub}
          awayClub={awayClub}
          neutral={true}
          kalshiHomePct={kalshiHomePct}
        />
      </div>

      {/* Score Probability Surface */}
      <div className="px-6 py-4 border-b border-[var(--hairline)]">
        <ScoreProbabilitySurface
          grid={prediction.grid}
          homeTeam={fixture.homeTeam}
          awayTeam={fixture.awayTeam}
          lambdas={prediction.lambdas}
          elo={prediction.elo}
          settledScoreline={!fixture.isOperational ? parseSettledScoreline(fixture.result) : undefined}
          lockExpiresISO={fixture.isOperational ? fixture.kickoffISO : undefined}
        />
      </div>
    </>
  );
}
