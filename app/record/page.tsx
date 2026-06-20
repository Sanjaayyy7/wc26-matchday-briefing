import { WCS26Shell } from "@/components/wc26-shell";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { LockedEntry } from "@/lib/predictions-ledger";
import type { AccountabilityOutput } from "@/lib/accountability";
import { NumberTicker } from "@/components/number-ticker";
import { IntelligenceCard } from "@/components/intelligence-card";
import { SettlementTable, type SettlementTableRow } from "@/components/settlement-table";
import { CalibrationChart } from "@/components/calibration-chart";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";

export const metadata = { title: "Record — Matchday Briefing" };

const accountability = accountabilityJson as AccountabilityOutput;

function teamLabel(slug: string, side: "home" | "away"): string {
  const f = fixtureBySlug(slug);
  if (!f) return slug;
  return clubById(side === "home" ? f.homeId : f.awayId).short;
}

function matchLabel(slug: string): string {
  return `${teamLabel(slug, "home")} vs ${teamLabel(slug, "away")}`;
}

function LedgerMetric({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="border-b border-[var(--line)] pb-5 last:border-0">
      <span className="text-label">{label}</span>
      <div className="mt-2 text-3xl text-display tabular">{value}</div>
      {sub && <p className="text-caption mt-1">{sub}</p>}
    </div>
  );
}

function Dash() {
  return <span className="text-[var(--ink-muted)]">—</span>;
}

export default function RecordPage() {
  const entries = (predictionsJson as { entries: LockedEntry[] }).entries;
  const open = entries.filter((e) => e.result === undefined);
  const settledEntries = entries.filter((e) => e.logLoss !== undefined);
  const meanLogLoss =
    settledEntries.length > 0
      ? settledEntries.reduce((s, e) => s + e.logLoss!, 0) / settledEntries.length
      : null;

  const { official, informational, caveats } = accountability;
  const agg = official.aggregates;

  const calibrationBins = official.calibrationBins ?? [];
  const ece =
    calibrationBins.length > 0
      ? (() => {
          const total = calibrationBins.reduce((s, b) => s + b.n, 0);
          return calibrationBins.reduce(
            (s, b) => s + (b.n / total) * Math.abs(b.predicted - b.observed),
            0,
          );
        })()
      : null;

  // ── Derived display inputs ──
  const accuracyPct = agg.accuracy !== null ? Math.round(agg.accuracy * 100) : null;
  const correct = agg.accuracy !== null ? Math.round(agg.accuracy * agg.n) : 0;

  // Largest miss (highest model Brier among official rows).
  const worst = [...official.rows].sort((a, b) => b.grades.modelBrier - a.grades.modelBrier)[0];
  const worstName = worst ? matchLabel(worst.slug) : "—";

  // Settlement table rows (date sort handled in the client component).
  const settlementRows: SettlementTableRow[] = official.rows.map((row) => {
    const f = fixtureBySlug(row.slug);
    const stage = f?.group ? `Group ${f.group}` : (f?.stage ?? "Tournament");
    const date = f
      ? new Date(f.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })
      : "—";
    return {
      slug: row.slug,
      matchName: matchLabel(row.slug),
      context: `${stage} · ${date} · ${row.locked.home} / ${row.locked.draw} / ${row.locked.away}`,
      result: row.actual,
      brier: row.grades.modelBrier,
      rps: row.grades.modelRps,
      verdict: row.verdict,
      kickoffMs: f ? new Date(f.kickoffISO).getTime() : 0,
    };
  });

  // Pre-stringified numerics keep numeric formatting off JSX call sites.
  const brierStr = agg.meanBrier !== null ? agg.meanBrier.toFixed(3) : "—";
  const rpsStr = agg.meanRps !== null ? agg.meanRps.toFixed(3) : "—";
  const logLossStr = meanLogLoss !== null ? meanLogLoss.toFixed(3) : "—";
  const eceStr = ece !== null ? `${(ece * 100).toFixed(1)}%` : "—";
  const accuracyStr = accuracyPct !== null ? `${accuracyPct}%` : "—";
  const kalshiEdgeStr =
    agg.vsKalshi.n > 0 && agg.vsKalshi.edge !== null ? agg.vsKalshi.edge.toFixed(3) : "—";
  const kalshiSubStr =
    agg.vsKalshi.n > 0
      ? `n=${agg.vsKalshi.n} · ${(agg.vsKalshi.edge ?? 0) < 0 ? "market sharper" : "model sharper"}`
      : "needs Kalshi snapshots";
  const perfAccent = (agg.meanBrier ?? 0) >= 0.55 ? "down" : "up";
  const calibAccent = ece === null ? undefined : ece >= 0.03 ? "down" : "up";

  return (
    <WCS26Shell
      route="record"
      title="Accountability Ledger"
      rail={
        <SignalLine
          signals={[
            {
              label: "Brier",
              value: agg.meanBrier ?? 0,
              decimals: 3,
              tone: (agg.meanBrier ?? 0) >= 0.55 ? "warn" : "neutral",
              detail: "live · lower better",
            },
            {
              label: "ECE",
              value: ece !== null ? ece * 100 : 0,
              suffix: "%",
              decimals: 1,
              tone: ece !== null && ece >= 0.03 ? "warn" : "up",
              detail: "target < 3%",
            },
            { label: "Log-loss", value: meanLogLoss ?? 0, decimals: 3, detail: "random ≈ 1.099" },
            { label: "Accuracy", value: accuracyPct ?? 0, suffix: "%", detail: "top-outcome" },
            {
              label: "Official n",
              value: agg.n,
              tone: agg.n < 30 ? "warn" : "neutral",
              detail: "graded sample",
            },
          ]}
        />
      }
    >
      <RouteStack className="w-full">
        {/* ── HERO + METRIC STRIP ── */}
        <CanvasSection
          eyebrow="Accountability ledger"
          title="Locked before kickoff, graded after the whistle."
        >
          <DataPlane>
            <div className="flex flex-col gap-2">
              <div className="text-hero data-mono tabular">
                <NumberTicker value={correct} />/<NumberTicker value={agg.n} /> correct picks
              </div>
              <div className="text-caption data-mono tabular text-[var(--ink-muted)]">
                Brier {brierStr} · RPS {rpsStr} · Log-loss {logLossStr} · ECE {eceStr} · n={agg.n}
              </div>
              {agg.n < 30 && (
                <div className="text-caption text-[var(--warn)]">
                  △ n={agg.n} — sample too small for conclusions.
                </div>
              )}
            </div>

            <div className="mt-8 grid grid-cols-2 gap-6 md:grid-cols-3 lg:grid-cols-5">
              <LedgerMetric label="Brier score (live)" value={<NumberTicker value={agg.meanBrier ?? 0} decimals={3} />} sub="Baseline 0.667 · lower better" />
              <LedgerMetric label="RPS" value={<NumberTicker value={agg.meanRps ?? 0} decimals={3} />} sub="Coin-flip ≈ 0.278" />
              <LedgerMetric label="Log-loss" value={meanLogLoss !== null ? <NumberTicker value={meanLogLoss} decimals={3} /> : <Dash />} sub="Random ≈ 1.099" />
              <LedgerMetric label="ECE (live)" value={ece !== null ? <span><NumberTicker value={ece * 100} decimals={1} />%</span> : <Dash />} sub="Target < 3.0%" />
              <LedgerMetric label="vs Kalshi (edge)" value={kalshiEdgeStr} sub={kalshiSubStr} />
            </div>
          </DataPlane>
        </CanvasSection>

        {/* ── INTELLIGENCE BRIEFING (2×2) ── */}
        <CanvasSection eyebrow="Intelligence briefing" title="Every claim sourced to a metric.">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
            <IntelligenceCard category="Performance assessment" accent={perfAccent}>
              Official graded record: {agg.n} matches, {correct} correct picks ({accuracyStr}). Mean
              Brier {brierStr} against a 0.667 uniform baseline. At n={agg.n} this is consistent with
              small-sample variance, not a demonstrated edge.
            </IntelligenceCard>
            <IntelligenceCard category="Calibration signal" accent={calibAccent}>
              Expected calibration error is {eceStr} against a 3.0% gate. Lower means stated
              probabilities track observed frequencies; the reliability diagram below shows alignment
              per probability bin.
            </IntelligenceCard>
            <IntelligenceCard category="Largest miss" accent="warn">
              {worst
                ? `${worstName} settled ${worst.actual}; the model split ${worst.locked.home}/${worst.locked.draw}/${worst.locked.away} (Brier ${worst.grades.modelBrier.toFixed(3)} — worst in the settled record).`
                : "No settled rows yet."}
            </IntelligenceCard>
            <IntelligenceCard category="Market comparison · Kalshi">
              {agg.vsKalshi.n > 0
                ? `${agg.vsKalshi.n} match with Kalshi data: model Brier ${agg.vsKalshi.modelBrier!.toFixed(3)} vs Kalshi ${agg.vsKalshi.marketBrier!.toFixed(3)}, edge ${kalshiEdgeStr}. n=${agg.vsKalshi.n} is noise; a meaningful read needs 10+ matched pairs.`
                : "No matched Kalshi pairs yet (n=0)."}
            </IntelligenceCard>
          </div>
        </CanvasSection>

        {/* ── RELIABILITY DIAGRAM ── */}
        {calibrationBins.length >= 2 && (
          <CanvasSection
            eyebrow="Calibration"
            title="Reliability diagram — predicted probability vs observed frequency."
          >
            <DataPlane>
              <p className="text-caption max-w-2xl mb-4">
                Points on the diagonal = perfectly calibrated. Above diagonal = underconfident.
                Below = overconfident. Bubble size proportional to sample count in each bin.
                n={agg.n} settled matches × 3 outcomes = {agg.n * 3} calibration points across{" "}
                {calibrationBins.length} non-empty bins.
              </p>
              <CalibrationChart bins={calibrationBins} />
            </DataPlane>
          </CanvasSection>
        )}

        {/* ── SETTLEMENT TABLE (sortable by Brier) ── */}
        {official.rows.length > 0 && (
          <CanvasSection
            eyebrow={`Settlement record · ${official.rows.length} graded calls`}
            title="Locked split, official result, and grade."
          >
            <DataPlane>
              <SettlementTable rows={settlementRows} />
              <p className="text-caption mt-3">
                Sorted by date. Click the Brier header to sort by score.
              </p>
            </DataPlane>
          </CanvasSection>
        )}

        {/* ── TEAM BREAKDOWN ── */}
        {official.rows.length >= 3 &&
          (() => {
            type TeamStats = { hits: number; total: number; brierSum: number };
            const teamStats = new Map<string, TeamStats>();
            for (const row of official.rows) {
              const f = fixtureBySlug(row.slug);
              if (!f) continue;
              const homeLabel = clubById(f.homeId).short;
              const awayLabel = clubById(f.awayId).short;
              for (const label of [homeLabel, awayLabel]) {
                const prev = teamStats.get(label) ?? { hits: 0, total: 0, brierSum: 0 };
                teamStats.set(label, {
                  hits: prev.hits + (row.grades.correctPick ? 1 : 0),
                  total: prev.total + 1,
                  brierSum: prev.brierSum + row.grades.modelBrier,
                });
              }
            }
            const teamRows = [...teamStats.entries()]
              .filter(([, s]) => s.total >= 2)
              .map(([team, s]) => ({ team, ...s, avgBrier: s.brierSum / s.total }))
              .sort((a, b) => b.avgBrier - a.avgBrier)
              .slice(0, 10);
            if (teamRows.length === 0) return null;
            return (
              <CanvasSection eyebrow="Team breakdown" title="Per-team forecasting performance.">
                <DataPlane>
                  <div>
                    {teamRows.map((r) => (
                      <div
                        key={r.team}
                        className="grid grid-cols-[1fr_auto_auto] gap-4 border-b border-[var(--line)] py-3 last:border-0"
                      >
                        <span className="text-title">{r.team}</span>
                        <span className="text-caption tabular text-right">
                          {r.hits}/{r.total} picks
                        </span>
                        <span className="text-caption tabular text-right">
                          Brier {r.avgBrier.toFixed(3)}
                        </span>
                      </div>
                    ))}
                  </div>
                  <p className="text-caption mt-3">
                    Sorted by avg Brier (highest = hardest to forecast). n ≥ 2 appearances only.
                  </p>
                </DataPlane>
              </CanvasSection>
            );
          })()}

        {/* ── INFORMATIONAL (played before lock) ── */}
        {informational.rows.length > 0 && (
          <CanvasSection
            eyebrow="Informational"
            title="Played before lock, never scored retroactively."
          >
            <DataPlane>
              <div>
                {informational.rows.map((row) => (
                  <div key={row.slug} className="border-b border-[var(--line)] py-4 last:border-0">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <span className="text-title truncate">{matchLabel(row.slug)}</span>
                      <span className="text-display tabular text-xl">{row.actual}</span>
                    </div>
                    <p className="text-caption mt-2 tabular">
                      BTTS: {row.btts ? "yes" : "no"} · Total goals: {row.totalGoals ?? "—"} · Kalshi
                      resolved: {row.kalshiResolution ?? "—"} · Polymarket resolved:{" "}
                      {row.polymarketResolution ?? "—"}
                    </p>
                    <p className="text-caption mt-1 italic">{row.note}</p>
                  </div>
                ))}
              </div>
            </DataPlane>
          </CanvasSection>
        )}

        {/* ── OPEN CALLS ── */}
        <CanvasSection
          eyebrow={`Open calls (${open.length})`}
          title="Frozen probabilities waiting for results."
        >
          <DataPlane>
            <div>
              {open.slice(0, 20).map((e) => (
                <div
                  key={e.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <span className="text-title truncate">{matchLabel(e.slug)}</span>
                  <span className="text-caption tabular">
                    <span className="text-[var(--up)]">{e.split.home}</span> / {e.split.draw} /{" "}
                    <span className="text-[var(--down)]">{e.split.away}</span>
                    {e.market ? " · market locked" : ""}
                  </span>
                </div>
              ))}
              {open.length > 20 && (
                <p className="text-caption pt-4">…and {open.length - 20} more, all locked.</p>
              )}
            </div>
          </DataPlane>
        </CanvasSection>

        {/* ── CAVEATS ── */}
        <CanvasSection eyebrow="Caveats" title="What this ledger can and cannot claim.">
          <DataPlane>
            <ul className="text-caption max-w-2xl list-disc space-y-1 pl-5">
              {caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="text-caption mt-4 max-w-3xl">
              Methodology: Elo + Dixon-Coles, trained on ~49k internationals — see the project README
              and audit ledger. RPS = ranked probability score over the ordered win/draw/loss outcome.
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
