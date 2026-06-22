import Link from "next/link";
import { WCS26Shell } from "@/components/wc26-shell";
import { RouteStack, CanvasSection } from "@/components/cinematic";
import { IntelligenceCard } from "@/components/intelligence-card";
import { SettlementRow } from "@/components/settlement-row";
import { CalibrationDiagram } from "@/components/calibration-diagram";
import { ForecastPulse } from "@/components/forecast-pulse";
import { MatchdayToday, type TodaysMatch } from "@/components/matchday-today";
import { Reveal } from "@/components/reveal";
import { allMatchViews } from "@/lib/match-view";
import { selectUpcomingLocks } from "@/lib/upcoming-locks";
import { fixtureBySlug, clubById, allClubs } from "@/lib/data";
import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import predictionsJson from "@/data/predictions.json";
import learningSignalsJson from "@/data/learning-signals.json";
import simulationJson from "@/data/simulation.json";

export const metadata = { title: "WC26 Forecasting Intelligence Platform" };

const accountability = accountabilityJson as AccountabilityOutput;
const agg = accountability.official.aggregates;

/** Settled-prediction quality grade from Brier score (lower is better). */
function gradeFrom(brier: number): "SURPRISE" | "MISS" | "CLOSE" | "SOLID" | "SHARP" {
  if (brier < 0.35) return "SHARP";
  if (brier < 0.55) return "SOLID";
  if (brier < 0.75) return "CLOSE";
  if (brier < 0.9) return "MISS";
  return "SURPRISE";
}

/** Three-state verdict for the shared SettlementRow / VerdictChip primitives. */
function LockRow({
  label,
  kickoff,
  split,
}: {
  label: string;
  kickoff: string;
  split?: { home: number; draw: number; away: number };
}) {
  return (
    <div className="flex items-center justify-between gap-4 py-3 border-b border-[var(--hairline)] last:border-0">
      <div className="min-w-0">
        <div className="text-label text-[var(--ink)] truncate">{label}</div>
        <div className="text-slight text-[var(--ink-faint)]">{kickoff}</div>
      </div>
      {split && (
        <div className="text-slight text-[var(--ink-muted)] tabular-nums font-mono shrink-0">
          {split.home}/{split.draw}/{split.away}
        </div>
      )}
    </div>
  );
}

function RailSection({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label">{title}</h3>
      <div>{children}</div>
    </div>
  );
}

function RailMetric({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 py-1.5 border-b border-[var(--hairline)] last:border-0">
      <span className="text-caption text-[var(--ink-faint)]">{label}</span>
      <span className="text-mono data-mono tabular" style={{ color: accent ?? "var(--ink)" }}>
        {value}
      </span>
    </div>
  );
}

export default function HomePage() {
  // ── Data layer (reused verbatim from the verified ledger plumbing) ──
  const entries = (predictionsJson as { entries: LockedEntry[] }).entries;
  const views = allMatchViews();

  const bins = accountability.official.calibrationBins ?? [];
  const totalBinN = bins.reduce((s, b) => s + b.n, 0);
  const ece =
    totalBinN > 0
      ? bins.reduce((s, b) => s + (b.n / totalBinN) * Math.abs(b.predicted - b.observed), 0)
      : null;

  const brier = agg.meanBrier ?? 0;
  const status: "NOMINAL" | "WARNING" | "BREACH" =
    brier >= 0.55 || (ece !== null && ece >= 0.03)
      ? "BREACH"
      : brier >= 0.45 || (ece !== null && ece >= 0.015)
        ? "WARNING"
        : "NOMINAL";
  const statusColor =
    status === "NOMINAL" ? "var(--up)" : status === "WARNING" ? "var(--warn)" : "var(--down)";

  const settled = entries
    .filter((e) => e.modelBrier !== undefined && e.result !== undefined)
    .sort((a, b) => b.modelBrier! - a.modelBrier!);

  const correct = settled.filter((e) => e.correctPick).length;
  const openLocks = entries.filter((e) => e.result === undefined).length;

  const gradeCounts = { SURPRISE: 0, MISS: 0, CLOSE: 0, SOLID: 0, SHARP: 0 };
  for (const e of settled) gradeCounts[gradeFrom(e.modelBrier!)]++;
  const hits = gradeCounts.SHARP + gradeCounts.SOLID;
  const misses = gradeCounts.MISS + gradeCounts.SURPRISE;

  // Largest single miss (settled is sorted Brier desc → index 0 is the worst).
  const worst = settled[0];
  const worstFixture = worst ? fixtureBySlug(worst.slug) : undefined;
  const worstName = worstFixture
    ? `${clubById(worstFixture.homeId).short} vs ${clubById(worstFixture.awayId).short}`
    : "—";

  const learningSignals = (
    learningSignalsJson as {
      signals: Array<{ id: string; status: string }>;
    }
  ).signals;
  const activeSignals = learningSignals.filter(
    (s) => s.status === "monitoring" || s.status === "action_required",
  );

  // ── Settlement feed (newest-first, 4) → shared SettlementRow shape ──
  // Verdict is the canonical, rank-based official verdict (classifyVerdict),
  // matching /record and /fixture — never a divergent local Brier mapping.
  const verdictBySlug = new Map(
    accountability.official.rows.map((r) => [r.slug, r.verdict] as const),
  );
  const settlementFeed = [...settled]
    .sort((a, b) => new Date(b.lockedAt).getTime() - new Date(a.lockedAt).getTime())
    .slice(0, 4)
    .map((e) => {
      const f = fixtureBySlug(e.slug);
      const home = f ? clubById(f.homeId).short : "?";
      const away = f ? clubById(f.awayId).short : "?";
      const stage = f?.group ? `Group ${f.group}` : (f?.stage ?? "Tournament");
      const date = f
        ? new Date(f.kickoffISO).toLocaleDateString("en-US", { month: "short", day: "numeric" })
        : "—";
      // What the model called pre-kickoff: money-line pick + most-likely scoreline.
      const favPct = Math.max(e.split.home, e.split.draw, e.split.away);
      const favLabel =
        e.split.home === favPct ? home : e.split.away === favPct ? away : "Draw";
      return {
        slug: e.slug,
        matchName: `${home} vs ${away}`,
        context: `${stage} · ${date} · ${e.split.home} / ${e.split.draw} / ${e.split.away}`,
        score: e.result!,
        brier: e.modelBrier!,
        verdict: verdictBySlug.get(e.slug) ?? "miss",
        predicted: { call: `${favLabel} ${favPct}%`, scoreline: `${e.mostLikely.home}-${e.mostLikely.away}` },
      };
    });

  // ── Championship projections (top 7) from the Monte-Carlo simulation ──
  const simTeams = (simulationJson as { teams: Record<string, { champion: number }> }).teams;
  const clubByDataset = new Map(
    allClubs()
      .filter((c) => c.datasetName)
      .map((c) => [c.datasetName!, c]),
  );
  const champions = Object.entries(simTeams)
    .sort(([, a], [, b]) => b.champion - a.champion)
    .slice(0, 7)
    .map(([name, d]) => {
      const club = clubByDataset.get(name);
      return { id: club?.id ?? "", name: club?.short ?? name, pct: d.champion * 100 };
    });
  const topChampionPct = champions[0]?.pct ?? 1;

  // ── Upcoming locks (next 3, future kickoffs only — no stale past matches) ──
  const upcomingLocks = selectUpcomingLocks(views, new Date(), 3);

  const nextLock = upcomingLocks[0];
  const nextHome = nextLock ? clubById(nextLock.fixture.homeId).short : "";
  const nextAway = nextLock ? clubById(nextLock.fixture.awayId).short : "";
  const nextKick = nextLock
    ? new Date(nextLock.fixture.kickoffISO).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        hour: "numeric",
        minute: "2-digit",
        timeZone: "America/New_York",
      })
    : "";

  // ── Today's locked slate (by ET date) with the model's pre-kickoff read ──
  const todayET = new Date().toLocaleDateString("en-US", { timeZone: "America/New_York" });
  const todaysMatches: TodaysMatch[] = views
    .filter((v) => !verdictBySlug.has(v.fixture.slug))
    .filter(
      (v) =>
        new Date(v.fixture.kickoffISO).toLocaleDateString("en-US", {
          timeZone: "America/New_York",
        }) === todayET,
    )
    .map((v) => {
      const entry = entries.find((e) => e.slug === v.fixture.slug);
      return {
        slug: v.fixture.slug,
        home: clubById(v.fixture.homeId).short,
        away: clubById(v.fixture.awayId).short,
        koET:
          new Date(v.fixture.kickoffISO).toLocaleTimeString("en-US", {
            hour: "numeric",
            minute: "2-digit",
            timeZone: "America/New_York",
          }) + " ET",
        split: entry?.split ?? { home: 0, draw: 0, away: 0 },
      };
    })
    .filter((m) => m.split.home + m.split.draw + m.split.away > 0);

  // Pre-stringified numerics keep numeric formatting off JSX call sites.
  const brierStr = brier.toFixed(3);
  const eceStr = ece !== null ? `${(ece * 100).toFixed(1)}%` : "—";
  const rpsStr = (agg.meanRps ?? 0).toFixed(3);
  const accuracyStr = `${Math.round((agg.accuracy ?? 0) * 100)}%`;

  return (
    <WCS26Shell route="home">
      <RouteStack>
        {/* ── SCOREBOARD HERO — the score, with the forecast pulse ── */}
        <section className="route-section animate-rise relative border-t border-[var(--line)] pt-8">
          <div className="chroma-rule absolute left-0 top-0 h-px w-36" />
          <div className="grid items-center gap-12 py-10 lg:min-h-[60vh] lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
            <div className="relative z-10 max-w-2xl">
            <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
              Live tournament · 48 nations · one ledger
            </span>
            <div className="text-hero tabular mt-5">
              {correct}/{agg.n} <span className="text-[var(--ink-muted)]">correct picks</span>
            </div>
            <div className="text-title tabular mt-4 text-[var(--ink-muted)]">
              Brier {brierStr} · {accuracyStr} accuracy
            </div>
            <p className="text-body mt-6 max-w-md">
              Locked before kickoff. Graded in public. A public record of what one model believed —
              Elo · Dixon-Coles · Platt — and what actually happened.
            </p>
            {nextLock && (
              <div className="mt-9 inline-flex flex-wrap items-center gap-4 border-t border-[var(--hairline)] pt-5 md:ml-16">
                <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
                  Next · locked
                </span>
                <span className="text-label text-[var(--ink)]">
                  {nextHome} vs {nextAway}
                </span>
                <span className="text-slight data-mono text-[var(--ink-muted)]">{nextKick}</span>
              </div>
            )}
            </div>
            <div className="relative z-10 hidden lg:block">
              <ForecastPulse />
            </div>
          </div>
        </section>

        {todaysMatches.length > 0 && (
          <Reveal>
          <CanvasSection eyebrow="Matchday" title="Today's slate">
            <div className="flex flex-col gap-6">
              <p className="text-caption max-w-md text-[var(--ink-muted)]">
                Locked before kickoff — the model&apos;s pre-match read. Graded at full-time, never
                edited after lock.
              </p>
              <MatchdayToday matches={todaysMatches} />
            </div>
          </CanvasSection>
          </Reveal>
        )}

        <Reveal>
        <CanvasSection eyebrow="Live ledger" title="The Reckoning">
          <div className="grid animate-rise gap-12 lg:grid-cols-[2fr_320px]">
            {/* ── MAIN COLUMN ── */}
            <div className="flex flex-col gap-16">
              {/* Signature artifact — calibration reliability diagram */}
              <div className="flex flex-col gap-3">
                <h2 className="text-label">Calibration — the model, audited</h2>
                <p className="text-caption max-w-md text-[var(--ink-muted)]">
                  On the diagonal = calibrated. Off it = miscalibrated. We publish both.
                </p>
                <CalibrationDiagram
                  bins={accountability.official.calibrationBins ?? []}
                  caption={`${agg.n} graded · ECE ${eceStr} vs 3.0% target`}
                />
                <Link
                  href="/methodology"
                  className="text-caption text-[var(--ink-faint)] underline underline-offset-2 transition-colors duration-300 hover:text-[var(--ink)]"
                >
                  How we grade ourselves →
                </Link>
              </div>

              {/* IntelligenceSection — 2×2 analytical briefing */}
              <div className="flex flex-col gap-3">
                <h2 className="text-label">Intelligence briefing</h2>
                <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                  <IntelligenceCard
                    category="Performance assessment"
                    accent={status === "NOMINAL" ? "up" : status === "WARNING" ? "warn" : "down"}
                  >
                    Mean Brier sits at {brierStr} over {agg.n} settled predictions against a 0.667
                    uniform baseline
                    {agg.n < 30
                      ? "; with fewer than 30 matches the figure carries wide error bars."
                      : "."}
                  </IntelligenceCard>

                  <IntelligenceCard
                    category="Calibration signal"
                    accent={
                      ece === null ? undefined : ece >= 0.03 ? "down" : ece >= 0.015 ? "warn" : "up"
                    }
                  >
                    Expected calibration error is {eceStr} against a 3.0% target. Lower means stated
                    probabilities track observed outcomes more closely.
                  </IntelligenceCard>

                  <IntelligenceCard category="Notable variance" accent="warn">
                    Largest miss: {worstName} settled {worst?.result ?? "—"}; the model split
                    {worst ? ` ${worst.split.home}/${worst.split.draw}/${worst.split.away}` : " —"}{" "}
                    (Brier {worst ? worst.modelBrier!.toFixed(3) : "—"}).
                  </IntelligenceCard>

                  <IntelligenceCard category="Operational status">
                    {openLocks} predictions locked and awaiting settlement ·{" "}
                    {activeSignals.length} active calibration investigations underway.
                  </IntelligenceCard>
                </div>
              </div>

              {/* SettlementFeed — shared SettlementRow, newest first */}
              <div className="flex flex-col gap-3">
                <h2 className="text-label">Recent settlements</h2>
                <div>
                  {settlementFeed.map((s) => (
                    <Link key={s.slug} href={`/fixture/${s.slug}`} className="block">
                      <SettlementRow
                        matchName={s.matchName}
                        context={s.context}
                        score={s.score}
                        brier={s.brier}
                        verdict={s.verdict}
                        predicted={s.predicted}
                      />
                    </Link>
                  ))}
                </div>
              </div>

              {/* UpcomingLocks */}
              <div className="flex flex-col gap-3">
                <h2 className="text-label">Next locks</h2>
                {upcomingLocks.length > 0 ? (
                  <div>
                    {upcomingLocks.map((v) => {
                      const home = clubById(v.fixture.homeId).short;
                      const away = clubById(v.fixture.awayId).short;
                      const entry = entries.find((e) => e.slug === v.fixture.slug);
                      const kickoff = new Date(v.fixture.kickoffISO).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        hour: "numeric",
                        minute: "2-digit",
                        timeZone: "America/New_York",
                      });
                      return (
                        <LockRow
                          key={v.fixture.slug}
                          label={`${home} vs ${away}`}
                          kickoff={kickoff}
                          split={entry?.split}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <p className="text-fine text-[var(--ink-faint)]">
                    No upcoming locks — awaiting next matchday.
                  </p>
                )}
              </div>
            </div>

            {/* ── RAIL ── */}
            <aside className="flex flex-col gap-10">
              <RailSection title="Model health">
                <RailMetric label="Status" value={status} accent={statusColor} />
                <RailMetric label="Brier" value={brierStr} />
                <RailMetric label="Baseline" value="0.667" />
                <RailMetric label="RPS" value={rpsStr} />
                <RailMetric label="ECE" value={eceStr} />
                <RailMetric label="Accuracy" value={accuracyStr} />
              </RailSection>

              <RailSection title="Championship probability">
                <div className="flex flex-col gap-3.5">
                  {champions.map((c) => (
                    <Link key={c.name} href={`/team/${c.id}`} className="group block">
                      <div className="flex items-baseline justify-between gap-2">
                        <span className="text-caption truncate text-[var(--ink)] transition-colors duration-300 group-hover:text-[var(--up)]">
                          {c.name}
                        </span>
                        <span className="text-mono data-mono tabular text-[var(--ink-muted)]">
                          {`${c.pct.toFixed(1)}%`}
                        </span>
                      </div>
                      <span className="mt-1.5 block h-1.5 w-full overflow-hidden bg-[var(--hairline)]">
                        <span
                          className="block h-full"
                          style={{ width: `${(c.pct / topChampionPct) * 100}%`, background: "var(--up)" }}
                        />
                      </span>
                    </Link>
                  ))}
                </div>
              </RailSection>

              <RailSection title="Forecast record">
                <RailMetric label="Settled" value={String(agg.n)} />
                <RailMetric label="Correct" value={String(correct)} accent="var(--up)" />
                <RailMetric label="Open locks" value={String(openLocks)} accent="var(--warn)" />
                <RailMetric label="Hits" value={String(hits)} accent="var(--up)" />
                <RailMetric label="Close" value={String(gradeCounts.CLOSE)} />
                <RailMetric label="Misses" value={String(misses)} accent="var(--down)" />
              </RailSection>
            </aside>
          </div>
        </CanvasSection>
        </Reveal>
      </RouteStack>
    </WCS26Shell>
  );
}
