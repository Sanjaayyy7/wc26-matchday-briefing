import Link from "next/link";
import { NumberTicker } from "./number-ticker";
import { VerdictChip } from "./verdict-chip";
import { kitPairWashStyle } from "@/lib/kit-color";
import type { MatchView } from "@/lib/match-view";
import { buildAutopsy } from "@/lib/match-autopsy";

function Stat({
  label,
  value,
  suffix,
  decimals = 0,
}: {
  label: string;
  value: number;
  suffix?: string;
  decimals?: number;
}) {
  return (
    <div>
      <span className="text-label">{label}</span>
      <NumberTicker
        value={value}
        suffix={suffix}
        decimals={decimals}
        className="text-display mt-1 block text-2xl"
      />
    </div>
  );
}

export function MatchResultPanel({ view }: { view: MatchView }) {
  if (view.status !== "official" && view.status !== "informational") return null;

  const facts = view.facts;
  const detailFacts = facts?.facts;
  const scoreParts = view.score.split("-");
  const homeScore = Number(scoreParts[0]);
  const awayScore = Number(scoreParts[1]);

  const official = view.status === "official" ? view.official : null;
  const autopsy =
    official && Number.isFinite(homeScore) && Number.isFinite(awayScore)
      ? buildAutopsy(official.locked, homeScore, awayScore)
      : null;
  const outcomeName = (o: "home" | "draw" | "away") =>
    o === "home" ? `${view.home.short} win` : o === "away" ? `${view.away.short} win` : "a draw";

  return (
    <section
      className="relative -mx-6 px-6 py-10"
      style={kitPairWashStyle(view.home.primary, view.away.primary)}
    >
      <div className="chroma-rule absolute left-6 top-0 h-px w-64" />
      <div className="absolute bottom-0 left-0 h-px w-1/2" style={{ background: "var(--kit-home)" }} />
      <div className="absolute bottom-0 right-0 h-px w-1/2" style={{ background: "var(--kit-away)" }} />
      <div className="grid gap-8 lg:grid-cols-[1.2fr_1fr] lg:items-start">
        <div>
          <h2 className="text-label mb-4">
            {view.status === "official" ? "Settled result" : "Played match"}
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <span className="text-display tabular">
              {Number.isFinite(homeScore) ? homeScore : view.score}
              {Number.isFinite(homeScore) && Number.isFinite(awayScore) ? (
                <>
                  <span className="text-[var(--ink-faint)]">–</span>
                  {awayScore}
                </>
              ) : null}
            </span>
            {view.status === "official" ? (
              <VerdictChip verdict={view.verdict} />
            ) : (
              <span className="text-label border-b border-[var(--line)] px-1 py-0.5">
                Not graded
              </span>
            )}
          </div>
          <p className="mt-3 max-w-2xl text-[var(--ink-muted)]">
            {view.status === "official"
              ? "This prediction was locked before kickoff and is included in the official model record."
              : view.informational.note}
          </p>
        </div>

        {view.status === "official" ? (
          <div className="grid gap-4 sm:grid-cols-2">
            <Stat label="Brier" value={view.official.grades.modelBrier} decimals={3} />
            <Stat label="RPS" value={view.official.grades.modelRps} decimals={3} />
            <Stat label="Locked home" value={view.official.locked.home} suffix="%" />
            <Stat label="Locked draw" value={view.official.locked.draw} suffix="%" />
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {view.informational.totalGoals !== undefined && (
              <Stat label="Goals" value={view.informational.totalGoals} />
            )}
            {view.informational.btts !== undefined && (
              <div>
                <span className="text-label">BTTS</span>
                <span className="text-display mt-1 block text-2xl">
                  {view.informational.btts ? "Yes" : "No"}
                </span>
              </div>
            )}
          </div>
        )}
      </div>

      {autopsy && official ? (
        <div className="mt-8 flex flex-col gap-3 border-t border-[var(--hairline)] pt-6">
          <h3 className="text-label">Forecast autopsy</h3>
          <p className="max-w-2xl text-[var(--ink-muted)]">
            The model&rsquo;s strongest call was{" "}
            <span className="text-[var(--ink)]">{outcomeName(autopsy.topLabel)}</span> at{" "}
            <span className="data-mono tabular">{autopsy.topPct}%</span>. The match ended {view.score} —{" "}
            {outcomeName(autopsy.realized)} — which the model rated{" "}
            <span className="data-mono tabular">{autopsy.actualPct}%</span>.
          </p>
          <div className="flex h-2 w-full max-w-md overflow-hidden rounded-sm">
            <div style={{ width: `${official.locked.home}%`, background: "var(--kit-home)" }} />
            <div style={{ width: `${official.locked.draw}%`, background: "var(--ink-faint)" }} />
            <div style={{ width: `${official.locked.away}%`, background: "var(--kit-away)" }} />
          </div>
          <div className="flex max-w-md justify-between text-fine text-[var(--ink-faint)]">
            <span className={autopsy.realized === "home" ? "text-[var(--ink)]" : undefined}>
              {view.home.short} <span className="data-mono tabular">{official.locked.home}%</span>
            </span>
            <span className={autopsy.realized === "draw" ? "text-[var(--ink)]" : undefined}>
              Draw <span className="data-mono tabular">{official.locked.draw}%</span>
            </span>
            <span className={autopsy.realized === "away" ? "text-[var(--ink)]" : undefined}>
              {view.away.short} <span className="data-mono tabular">{official.locked.away}%</span>
            </span>
          </div>
          {autopsy.drawUnderrated ? (
            <p className="text-fine text-[var(--warn)]">
              A draw the model rated below the field — this pattern feeds the active calibration
              investigation.{" "}
              <Link href="/command" className="underline underline-offset-2">
                LSig-001 →
              </Link>
            </p>
          ) : null}
        </div>
      ) : null}

      {(facts?.scorers?.length || detailFacts) && (
        <div className="mt-8 grid gap-6 lg:grid-cols-2">
          {facts?.scorers?.length ? (
            <div>
              <h3 className="text-label mb-3">Scorers</h3>
              <ul className="space-y-2">
                {facts.scorers.map((s, index) => (
                  <li key={`${s.player}-${index}`} className="text-caption">
                    <span className="tabular">{s.minute}&prime;</span> {s.player}
                    {s.assist ? ` · ${s.assist}` : ""}
                  </li>
                ))}
              </ul>
            </div>
          ) : null}
          {detailFacts ? (
            <div>
              <h3 className="text-label mb-3">Match facts</h3>
              <div className="grid gap-3 sm:grid-cols-2">
                {detailFacts.possessionHome !== undefined && (
                  <Stat label={`${view.home.short} poss.`} value={detailFacts.possessionHome} suffix="%" />
                )}
                {detailFacts.possessionAway !== undefined && (
                  <Stat label={`${view.away.short} poss.`} value={detailFacts.possessionAway} suffix="%" />
                )}
                {detailFacts.onTargetHome !== undefined && (
                  <Stat label={`${view.home.short} SOT`} value={detailFacts.onTargetHome} />
                )}
                {detailFacts.onTargetAway !== undefined && (
                  <Stat label={`${view.away.short} SOT`} value={detailFacts.onTargetAway} />
                )}
              </div>
            </div>
          ) : null}
        </div>
      )}
    </section>
  );
}
