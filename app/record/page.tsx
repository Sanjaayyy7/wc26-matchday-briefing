import { SiteHeader } from "@/components/site-header";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { LockedEntry } from "@/lib/predictions-ledger";
import type { AccountabilityOutput, OfficialRow } from "@/lib/accountability";
import { verdictVar } from "@/lib/kit-color";
import { verdictDisplay } from "@/lib/verdict-display";
import { NumberTicker } from "@/components/number-ticker";
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

function MetricCard({
  label,
  value,
  sub,
}: {
  label: string;
  value: React.ReactNode;
  sub?: string;
}) {
  return (
    <div className="rounded-2xl bg-[var(--surface)] p-5 dark:border dark:border-[var(--hairline)]">
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

function VerdictChip({ verdict }: { verdict: OfficialRow["verdict"] }) {
  const { label, icon } = verdictDisplay(verdict);
  const color = verdictVar(verdict);
  return (
    <span
      className="text-label inline-flex items-center gap-1 rounded-sm px-2 py-0.5"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
      }}
    >
      {icon} {label}
    </span>
  );
}

export default function RecordPage() {
  const entries = (predictionsJson as { entries: LockedEntry[] }).entries;
  const open = entries.filter((e) => e.result === undefined);

  const { official, informational, caveats } = accountability;
  const agg = official.aggregates;

  const bt = (model as { backtest: { n: number; brier: number; rps: number; ece: number } })
    .backtest;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-6xl flex-1 space-y-16 px-6 py-12 md:py-16">
        <section className="animate-rise">
          <h1 className="text-title text-3xl">Prediction vs reality</h1>
          <p className="mt-3 max-w-2xl text-[17px] text-[var(--ink-muted)]">
            Every call is locked before kickoff and never edited. Only locked
            calls are graded against the model — matches played before a call
            was locked are shown for completeness but never scored
            retroactively. The official sample is currently{" "}
            <strong className="text-[var(--ink)]">n = {agg.n}</strong> — far
            too small to read as a track record. Treat every aggregate below
            as a single data point, not a trend.
          </p>
        </section>

        <section className="animate-rise" style={{ animationDelay: "0.06s" }}>
          <h2 className="text-label mb-4">At a glance</h2>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            <MetricCard
              label="Correct picks"
              value={
                agg.n ? (
                  <span>
                    {Math.round(agg.accuracy! * agg.n)}/{agg.n}
                  </span>
                ) : (
                  <Dash />
                )
              }
              sub={agg.n ? `n=${agg.n} · ${Math.round(agg.accuracy! * 100)}% hit rate` : "no calls settled yet"}
            />
            <MetricCard
              label="Avg Brier"
              value={agg.meanBrier !== null ? <span>{agg.meanBrier.toFixed(3)}</span> : <Dash />}
              sub={`n=${agg.n} · uniform baseline ${UNIFORM_BRIER}`}
            />
            <MetricCard
              label="Avg RPS"
              value={agg.meanRps !== null ? <span>{agg.meanRps.toFixed(3)}</span> : <Dash />}
              sub={`n=${agg.n} · coin-flip ≈ ${COIN_FLIP_RPS}`}
            />
            <MetricCard
              label="Model vs Kalshi"
              value={
                agg.vsKalshi.n > 0 ? (
                  <span>
                    {agg.vsKalshi.modelBrier!.toFixed(3)} / {agg.vsKalshi.marketBrier!.toFixed(3)}
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
            <MetricCard
              label="Model vs Polymarket"
              value={agg.vsPolymarket.n > 0 ? <span>{agg.vsPolymarket.modelBrier!.toFixed(3)} / {agg.vsPolymarket.marketBrier!.toFixed(3)}</span> : <Dash />}
              sub={
                agg.vsPolymarket.n > 0
                  ? `ours / market's Brier, n=${agg.vsPolymarket.n}`
                  : "no pre-kickoff Polymarket books yet (n=0)"
              }
            />
            <MetricCard
              label="Open locks"
              value={<NumberTicker value={open.length} />}
              sub="probabilities frozen pre-kickoff"
            />
            <MetricCard
              label="Backtest (2024+)"
              value={<span>{bt.rps.toFixed(3)} RPS</span>}
              sub={`n=${bt.n} · Brier ${bt.brier.toFixed(3)} · ECE ${(bt.ece * 100).toFixed(1)}%`}
            />
          </div>
        </section>

        {official.rows.length > 0 && (
          <section className="animate-rise" style={{ animationDelay: "0.12s" }}>
            <h2 className="text-label mb-4">Settled calls</h2>
            <div className="space-y-3 overflow-x-auto">
              {official.rows.map((row) => {
                const pm = (row as OfficialRow & { polymarket?: { brier: number; rps: number } })
                  .polymarket;
                return (
                  <div
                    key={row.slug}
                    className="grid min-w-[640px] grid-cols-[1.4fr_1fr_0.8fr_0.9fr_0.7fr_0.7fr_0.7fr] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-4 dark:border dark:border-[var(--hairline)] sm:min-w-0"
                  >
                    <div>
                      <p className="text-title text-[17px] truncate">{matchLabel(row.slug)}</p>
                      <p className="text-caption mt-1">Locked split</p>
                      <LockedSplit locked={row.locked} />
                    </div>
                    <div>
                      <p className="text-caption">Actual</p>
                      <p className="text-display tabular text-2xl">{row.actual}</p>
                    </div>
                    <div>
                      <VerdictChip verdict={row.verdict} />
                    </div>
                    <div>
                      <p className="text-caption">Brier</p>
                      <p className="tabular text-[15px] font-medium">{row.grades.modelBrier.toFixed(3)}</p>
                    </div>
                    <div>
                      <p className="text-caption">BTTS</p>
                      <p className="tabular text-[15px] font-medium">
                        {row.grades.bttsBrier !== undefined ? row.grades.bttsBrier.toFixed(3) : "—"}
                        {row.grades.bttsDerivedPostHoc && (
                          <span className="text-caption ml-1">(post-hoc)</span>
                        )}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption">Kalshi</p>
                      <p className="tabular text-[15px] font-medium">
                        {row.kalshi ? row.kalshi.brier.toFixed(3) : "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-caption">Polymarket</p>
                      <p className="tabular text-[15px] font-medium">{pm ? pm.brier.toFixed(3) : "—"}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {informational.rows.length > 0 && (
          <section className="animate-rise" style={{ animationDelay: "0.18s" }}>
            <h2 className="text-label mb-4">Informational — played before lock</h2>
            <p className="text-caption mb-4 max-w-2xl">
              These matches were played before a prediction was locked. They are
              NOT scored against the model — shown only for completeness and to
              show how the markets resolved.
            </p>
            <div className="space-y-2">
              {informational.rows.map((row) => (
                <div
                  key={row.slug}
                  className="rounded-xl bg-[var(--canvas)] px-4 py-3 dark:border dark:border-[var(--hairline)]"
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-[15px] font-medium truncate">{matchLabel(row.slug)}</span>
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
          </section>
        )}

        <section className="animate-rise" style={{ animationDelay: "0.24s" }}>
          <h2 className="text-label mb-4">Open calls ({open.length})</h2>
          <div className="space-y-2">
            {open.slice(0, 20).map((e) => (
              <div
                key={e.slug}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 dark:border dark:border-[var(--hairline)]"
              >
                <span className="truncate text-[15px]">{matchLabel(e.slug)}</span>
                <span className="text-caption tabular">
                  <span className="text-[var(--up)]">{e.split.home}</span> /{" "}
                  {e.split.draw} / <span className="text-[var(--down)]">{e.split.away}</span>
                  {e.market ? " · market locked" : ""}
                </span>
              </div>
            ))}
            {open.length > 20 && (
              <p className="text-caption">…and {open.length - 20} more, all locked.</p>
            )}
          </div>
        </section>

        <section>
          <h2 className="text-label mb-4">Caveats</h2>
          <ul className="text-caption max-w-2xl list-disc space-y-1 pl-5">
            {caveats.map((c, i) => (
              <li key={i}>{c}</li>
            ))}
          </ul>
          <p className="text-caption mt-4">
            Methodology: Elo + Dixon-Coles, trained on ~49k internationals — see the
            project README and audit ledger. RPS = ranked probability score over
            the ordered win/draw/loss outcome. Backtest figures are from
            data/model.json (2024+ holdout).
          </p>
        </section>
      </main>
    </>
  );
}
