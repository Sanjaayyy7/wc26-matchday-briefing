import { AppChrome } from "@/components/app-chrome";
import { CanvasSection, DataPlane, RouteStack, SignalLine } from "@/components/cinematic";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { LockedEntry } from "@/lib/predictions-ledger";
import type { AccountabilityOutput, OfficialRow } from "@/lib/accountability";
import { NumberTicker } from "@/components/number-ticker";
import { VerdictChip } from "@/components/verdict-chip";
import { CalibrationChart } from "@/components/calibration-chart";
import predictionsJson from "@/data/predictions.json";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import model from "@/data/model.json";

export const metadata = { title: "Record — Matchday Briefing" };

const COIN_FLIP_RPS = 0.278;
const UNIFORM_BRIER = 0.667;

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

/** Locked split bar: home (up) / draw (neutral) / away (down), per design §8.3 colors without team kits. */
function LockedSplit({ locked }: { locked: { home: number; draw: number; away: number } }) {
  return (
    <div className="flex w-full flex-col gap-1">
      <div className="flex h-2 w-full overflow-hidden rounded-full bg-[var(--neutral-fill)]">
        <div className="h-full bg-[var(--up)]" style={{ width: `${locked.home}%` }} />
        <div className="h-full bg-[var(--neutral-fill)]" style={{ width: `${locked.draw}%` }} />
        <div className="h-full bg-[var(--down)]" style={{ width: `${locked.away}%` }} />
      </div>
      <div className="text-caption tabular flex gap-2">
        <span className="text-[var(--up)]">{locked.home}</span>
        <span>{locked.draw}</span>
        <span className="text-[var(--down)]">{locked.away}</span>
      </div>
    </div>
  );
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

  const bt = (model as { backtest: { n: number; brier: number; rps: number; ece: number } })
    .backtest;

  return (
    <AppChrome
      route="record"
      title="Accountability Ledger"
      rail={
        <SignalLine
          signals={[
            { label: "Official n", value: agg.n, tone: agg.n < 10 ? "warn" : "neutral", detail: "graded sample" },
            { label: "Open locks", value: open.length, detail: "frozen calls" },
            { label: "Backtest RPS", value: bt.rps, decimals: 3, detail: `${bt.n} matches` },
          ]}
        />
      }
    >
      <RouteStack className="w-full">
        <CanvasSection eyebrow="Sample warning" title="Locked before kickoff. Scored after the whistle.">
          <DataPlane>
            <p className="max-w-4xl text-title text-2xl leading-tight md:text-4xl">
              Every call is locked before kickoff and never edited. Only locked
              calls are graded against the model; matches played before a call
              was locked are shown for completeness but never scored
              retroactively. The official sample is currently{" "}
              <strong className="text-[var(--ink)]">n = {agg.n}</strong> — far
              too small to read as a track record.
            </p>
          </DataPlane>
        </CanvasSection>

        <CanvasSection eyebrow="At a glance" title="Model accountability, not marketing stats.">
          <DataPlane>
            <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              <LedgerMetric
                label="Correct picks"
                value={
                  agg.n ? (
                    <span>
                      <NumberTicker value={Math.round(agg.accuracy! * agg.n)} />
                      /<NumberTicker value={agg.n} />
                    </span>
                  ) : (
                    <Dash />
                  )
                }
                sub={agg.n ? `n=${agg.n} · ${Math.round(agg.accuracy! * 100)}% hit rate` : "no calls settled yet"}
              />
              <LedgerMetric
                label="Avg Brier"
                value={
                  agg.meanBrier !== null ? (
                    <NumberTicker value={agg.meanBrier} decimals={3} />
                  ) : (
                    <Dash />
                  )
                }
                sub={`n=${agg.n} · uniform baseline ${UNIFORM_BRIER}`}
              />
              <LedgerMetric
                label="Avg RPS"
                value={
                  agg.meanRps !== null ? (
                    <NumberTicker value={agg.meanRps} decimals={3} />
                  ) : (
                    <Dash />
                  )
                }
                sub={`n=${agg.n} · coin-flip ≈ ${COIN_FLIP_RPS}`}
              />
              <LedgerMetric
                label="Avg Log-loss"
                value={
                  meanLogLoss !== null ? (
                    <NumberTicker value={meanLogLoss} decimals={3} />
                  ) : (
                    <Dash />
                  )
                }
                sub={`n=${settledEntries.length} · lower better · random ≈ 1.099`}
              />
              <LedgerMetric
                label="ECE (live)"
                value={
                  ece !== null ? (
                    <span>
                      <NumberTicker value={ece * 100} decimals={1} />%
                    </span>
                  ) : (
                    <Dash />
                  )
                }
                sub={`expected calibration error · target < 3% · ${calibrationBins.length} bins`}
              />
              <LedgerMetric
                label="Model vs Kalshi"
                value={
                  agg.vsKalshi.n > 0 ? (
                    <span>
                      <NumberTicker value={agg.vsKalshi.modelBrier!} decimals={3} /> /{" "}
                      <NumberTicker value={agg.vsKalshi.marketBrier!} decimals={3} />
                    </span>
                  ) : (
                    <Dash />
                  )
                }
                sub={
                  agg.vsKalshi.n > 0
                    ? `ours / market's Brier, n=${agg.vsKalshi.n} · edge ${agg.vsKalshi.edge!.toFixed(3)} (${agg.vsKalshi.edge! < 0 ? "market sharper" : "model sharper"})`
                    : "needs settled calls with a Kalshi snapshot"
                }
              />
              <LedgerMetric
                label="Model vs Polymarket"
                value={
                  agg.vsPolymarket.n > 0 ? (
                    <span>
                      <NumberTicker value={agg.vsPolymarket.modelBrier!} decimals={3} /> /{" "}
                      <NumberTicker value={agg.vsPolymarket.marketBrier!} decimals={3} />
                    </span>
                  ) : (
                    <Dash />
                  )
                }
                sub={
                  agg.vsPolymarket.n > 0
                    ? `ours / market's Brier, n=${agg.vsPolymarket.n}`
                    : "no pre-kickoff Polymarket books yet (n=0)"
                }
              />
              <LedgerMetric
                label="Open locks"
                value={<NumberTicker value={open.length} />}
                sub="probabilities frozen pre-kickoff"
              />
              <LedgerMetric
                label="Backtest (2024+)"
                value={
                  <span>
                    <NumberTicker value={bt.rps} decimals={3} /> RPS
                  </span>
                }
                sub={`n=${bt.n} · Brier ${bt.brier.toFixed(3)} · ECE ${(bt.ece * 100).toFixed(1)}%`}
              />
            </div>
          </DataPlane>
        </CanvasSection>

        {official.rows.length > 0 && (
          <CanvasSection eyebrow="Settled calls" title="Official rows, grades, and market comparison.">
            <DataPlane>
              <div>
                {official.rows.map((row) => {
                  const pm = (row as OfficialRow & { polymarket?: { brier: number; rps: number } })
                    .polymarket;
                  return (
                    <div
                      key={row.slug}
                      className="grid gap-5 border-b border-[var(--line)] py-5 last:border-0 lg:grid-cols-[1.35fr_0.6fr_0.6fr_0.62fr_0.62fr_0.62fr_0.7fr]"
                    >
                      <div>
                        <p className="text-title truncate">{matchLabel(row.slug)}</p>
                        <p className="text-caption mt-1">Locked split</p>
                        <LockedSplit locked={row.locked} />
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption">Actual</p>
                        <p className="text-display tabular text-2xl">{row.actual}</p>
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption lg:hidden">Verdict</p>
                        <VerdictChip verdict={row.verdict} />
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption">Brier</p>
                        <NumberTicker value={row.grades.modelBrier} decimals={3} className="text-title" />
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption">BTTS</p>
                        <p className="text-title tabular">
                          {row.grades.bttsBrier !== undefined ? (
                            <NumberTicker value={row.grades.bttsBrier} decimals={3} />
                          ) : (
                            "—"
                          )}
                          {row.grades.bttsDerivedPostHoc && (
                            <span className="text-caption ml-1">(post-hoc)</span>
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption">Kalshi</p>
                        <p className="text-title tabular">
                          {row.kalshi ? (
                            <NumberTicker value={row.kalshi.brier} decimals={3} />
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>
                      <div className="flex items-center justify-between gap-4 lg:block">
                        <p className="text-caption">Polymarket</p>
                        <p className="text-title tabular">
                          {pm ? <NumberTicker value={pm.brier} decimals={3} /> : "—"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
            </DataPlane>
          </CanvasSection>
        )}

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

        {official.rows.length >= 3 && (() => {
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

        {informational.rows.length > 0 && (
          <CanvasSection
            eyebrow="Informational"
            title="Played before lock, never scored retroactively."
          >
            <DataPlane>
              <div>
                {informational.rows.map((row) => (
                  <div
                    key={row.slug}
                    className="border-b border-[var(--line)] py-4 last:border-0"
                  >
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

        <CanvasSection eyebrow={`Open calls (${open.length})`} title="Frozen probabilities waiting for results.">
          <DataPlane>
            <div>
              {open.slice(0, 20).map((e) => (
                <div
                  key={e.slug}
                  className="grid grid-cols-[minmax(0,1fr)_auto] items-center gap-4 border-b border-[var(--line)] py-4 last:border-0"
                >
                  <span className="text-title truncate">{matchLabel(e.slug)}</span>
                  <span className="text-caption tabular">
                    <span className="text-[var(--up)]">{e.split.home}</span> /{" "}
                    {e.split.draw} / <span className="text-[var(--down)]">{e.split.away}</span>
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

        <CanvasSection eyebrow="Caveats" title="What this ledger can and cannot claim.">
          <DataPlane>
            <ul className="text-caption max-w-2xl list-disc space-y-1 pl-5">
              {caveats.map((c, i) => (
                <li key={i}>{c}</li>
              ))}
            </ul>
            <p className="text-caption mt-4 max-w-3xl">
              Methodology: Elo + Dixon-Coles, trained on ~49k internationals — see the
              project README and audit ledger. RPS = ranked probability score over
              the ordered win/draw/loss outcome. Backtest figures are from
              data/model.json (2024+ holdout).
            </p>
          </DataPlane>
        </CanvasSection>
      </RouteStack>
    </AppChrome>
  );
}
