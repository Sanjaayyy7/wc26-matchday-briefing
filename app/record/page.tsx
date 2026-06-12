import { SiteHeader } from "@/components/site-header";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { LockedEntry } from "@/lib/predictions-ledger";
import { NumberTicker } from "@/components/number-ticker";
import predictionsJson from "@/data/predictions.json";
import model from "@/data/model.json";

export const metadata = { title: "Record — Matchday Briefing" };

const COIN_FLIP_RPS = 0.278;

function avg(xs: number[]): number | null {
  return xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null;
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
      <div className="mt-2 text-[28px] font-bold tracking-[-0.02em]">{value}</div>
      {sub && <p className="text-caption mt-1">{sub}</p>}
    </div>
  );
}

function teamLabel(slug: string, side: "home" | "away"): string {
  const f = fixtureBySlug(slug);
  if (!f) return slug;
  return clubById(side === "home" ? f.homeId : f.awayId).short;
}

function pickLabel(e: LockedEntry): string {
  const top = (
    Object.entries(e.split) as Array<["home" | "draw" | "away", number]>
  ).reduce((a, b) => (b[1] > a[1] ? b : a));
  const name =
    top[0] === "draw" ? "Draw" : teamLabel(e.slug, top[0]);
  return `${name} ${top[1]}%`;
}

function matchLabel(e: LockedEntry): string {
  return `${teamLabel(e.slug, "home")} vs ${teamLabel(e.slug, "away")}`;
}

export default function RecordPage() {
  const entries = (predictionsJson as { entries: LockedEntry[] }).entries;
  const settled = entries.filter((e) => e.result !== undefined);
  const open = entries.filter((e) => e.result === undefined);
  const correct = settled.filter((e) => e.correctPick).length;
  const modelBrier = avg(settled.map((e) => e.modelBrier!));
  const modelRps = avg(settled.map((e) => e.modelRps!));
  const withMarket = settled.filter((e) => e.marketBrier !== undefined);
  const marketBrier = avg(withMarket.map((e) => e.marketBrier!));
  const modelBrierOnMarketSet = avg(withMarket.map((e) => e.modelBrier!));
  const bt = (model as {
    backtest: { n: number; brier: number; rps: number; ece: number };
  }).backtest;

  return (
    <>
      <SiteHeader />
      <main className="mx-auto w-full max-w-3xl flex-1 space-y-12 px-6 py-12">
        <div>
          <h1 className="text-title text-2xl">Prediction vs reality</h1>
          <p className="mt-2 max-w-xl text-[15px] text-[var(--ink-muted)]">
            Every call is locked before kickoff and never edited. Matches played
            before this ledger existed are not graded — no retroactive predictions.
          </p>
        </div>

        <section className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          <MetricCard
            label="Correct picks"
            value={
              settled.length ? (
                <span className="tabular">{correct}/{settled.length}</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              )
            }
            sub={settled.length ? `${Math.round((correct / settled.length) * 100)}% hit rate` : "no calls settled yet"}
          />
          <MetricCard
            label="Avg RPS"
            value={
              modelRps !== null ? (
                <span className="tabular">{modelRps.toFixed(3)}</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              )
            }
            sub={`coin-flip ≈ ${COIN_FLIP_RPS} · lower is better`}
          />
          <MetricCard
            label="Avg Brier"
            value={
              modelBrier !== null ? (
                <span className="tabular">{modelBrier.toFixed(3)}</span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              )
            }
            sub="uniform baseline 0.667"
          />
          <MetricCard
            label="Model vs Kalshi"
            value={
              marketBrier !== null && modelBrierOnMarketSet !== null ? (
                <span className="tabular">
                  {modelBrierOnMarketSet.toFixed(3)} / {marketBrier.toFixed(3)}
                </span>
              ) : (
                <span className="text-[var(--ink-muted)]">—</span>
              )
            }
            sub={
              withMarket.length
                ? `Brier, ours / market's, n=${withMarket.length}`
                : "needs settled calls with market snapshots"
            }
          />
          <MetricCard
            label="Open locks"
            value={<NumberTicker value={open.length} className="font-bold" />}
            sub="probabilities frozen pre-kickoff"
          />
          <MetricCard
            label="Backtest (2024+)"
            value={<span className="tabular">{bt.rps.toFixed(3)} RPS</span>}
            sub={`n=${bt.n} · Brier ${bt.brier} · ECE ${(bt.ece * 100).toFixed(1)}%`}
          />
        </section>

        {settled.length > 0 && (
          <section>
            <h2 className="text-label mb-4">Settled calls</h2>
            <div className="space-y-2">
              {settled.map((e) => (
                <div
                  key={e.slug}
                  className="grid grid-cols-[1fr_auto_auto] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 dark:border dark:border-[var(--hairline)]"
                >
                  <span className="truncate text-[15px] font-medium">
                    {matchLabel(e)}
                  </span>
                  <span className="tabular text-[15px] font-bold">{e.result}</span>
                  <span
                    className={`text-caption tabular ${e.correctPick ? "text-[var(--up)]" : "text-[var(--down)]"}`}
                  >
                    {pickLabel(e)} {e.correctPick ? "✓" : "✗"} · RPS{" "}
                    {e.modelRps!.toFixed(3)}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        <section>
          <h2 className="text-label mb-4">Open calls ({open.length})</h2>
          <div className="space-y-2">
            {open.slice(0, 20).map((e) => (
              <div
                key={e.slug}
                className="grid grid-cols-[1fr_auto] items-center gap-4 rounded-xl bg-[var(--surface)] px-4 py-3 dark:border dark:border-[var(--hairline)]"
              >
                <span className="truncate text-[15px]">{matchLabel(e)}</span>
                <span className="text-caption tabular">
                  <span className="text-[var(--up)]">{e.split.home}</span> /{" "}
                  {e.split.draw} / <span className="text-[var(--down)]">{e.split.away}</span>
                  {e.market ? " · 📈 market locked" : ""}
                </span>
              </div>
            ))}
            {open.length > 20 && (
              <p className="text-caption">…and {open.length - 20} more, all locked.</p>
            )}
          </div>
        </section>

        <p className="text-caption">
          Methodology: Elo + Dixon-Coles, trained on ~49k internationals — see the
          project README and audit ledger. RPS = ranked probability score over the
          ordered win/draw/loss outcome.
        </p>
      </main>
    </>
  );
}
