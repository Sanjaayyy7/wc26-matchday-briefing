import { AppChrome } from "@/components/app-chrome";
import { RouteStack, CanvasSection, DataPlane, SignalLine } from "@/components/cinematic";
import { allMatchViews } from "@/lib/match-view";
import { fixtureBySlug, clubById } from "@/lib/data";
import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import predictionsJson from "@/data/predictions.json";
import learningSignalsJson from "@/data/learning-signals.json";

export const metadata = { title: "WC26 Forecasting Intelligence Platform" };

const accountability = accountabilityJson as AccountabilityOutput;
const agg = accountability.official.aggregates;

function StatusBadge({ status }: { status: "NOMINAL" | "WARNING" | "BREACH" }) {
  const color = status === "NOMINAL" ? "var(--up)" : status === "WARNING" ? "var(--warn)" : "var(--down)";
  return (
    <span
      className="inline-flex items-center gap-1.5 text-fine font-bold uppercase tracking-widest px-2 py-1 rounded-sm"
      style={{ color, backgroundColor: `${color}18`, border: `1px solid ${color}30` }}
    >
      <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: color }} />
      {status}
    </span>
  );
}

function HealthKpi({
  label,
  value,
  sub,
  accent,
  gate,
}: {
  label: string;
  value: string;
  sub?: string;
  accent?: string;
  gate?: string;
}) {
  return (
    <div className="border border-[var(--line)] rounded p-4">
      <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-2">{label}</div>
      <div
        className="text-2xl font-bold tabular-nums leading-none"
        style={{ color: accent ?? "var(--ink)" }}
      >
        {value}
      </div>
      {sub && <div className="text-slight text-[var(--ink-faint)] mt-1.5">{sub}</div>}
      {gate && (
        <div className="text-fine text-[var(--down)] mt-1 font-medium">Gate: {gate}</div>
      )}
    </div>
  );
}

function SettlementRow({
  rank,
  label,
  result,
  split,
  brier,
  grade,
}: {
  rank: string;
  label: string;
  result: string;
  split: { home: number; draw: number; away: number };
  brier: number;
  grade: "SURPRISE" | "MISS" | "CLOSE" | "SOLID" | "SHARP";
}) {
  const gradeColor: Record<string, string> = {
    SURPRISE: "var(--down)",
    MISS: "var(--warn)",
    CLOSE: "var(--ink-muted)",
    SOLID: "var(--up)",
    SHARP: "var(--up)",
  };
  return (
    <div className="flex items-center gap-4 py-3 border-b border-[var(--hairline)] last:border-0">
      <span className="text-slight font-mono text-[var(--ink-faint)] w-4 shrink-0">{rank}</span>
      <div className="flex-1 min-w-0">
        <div className="text-label text-[var(--ink)] font-medium truncate">{label}</div>
        <div className="text-slight text-[var(--ink-faint)] mt-0.5">
          H:{split.home}% D:{split.draw}% A:{split.away}% → {result}
        </div>
      </div>
      <div className="text-right shrink-0">
        <div className="text-slight font-semibold tabular-nums" style={{ color: gradeColor[grade] }}>
          {grade}
        </div>
        <div className="text-fine text-[var(--ink-faint)] tabular-nums">{brier.toFixed(3)}</div>
      </div>
    </div>
  );
}

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
      <div>
        <div className="text-label text-[var(--ink)]">{label}</div>
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

function gradeFrom(brier: number): "SURPRISE" | "MISS" | "CLOSE" | "SOLID" | "SHARP" {
  if (brier < 0.35) return "SHARP";
  if (brier < 0.55) return "SOLID";
  if (brier < 0.75) return "CLOSE";
  if (brier < 0.90) return "MISS";
  return "SURPRISE";
}

export default function HomePage() {
  const entries = (predictionsJson as { entries: LockedEntry[] }).entries;
  const views = allMatchViews();

  // Compute ECE from calibration bins
  const bins = accountability.official.calibrationBins ?? [];
  const totalBinN = bins.reduce((s, b) => s + b.n, 0);
  const ece = totalBinN > 0
    ? bins.reduce((s, b) => s + (b.n / totalBinN) * Math.abs(b.predicted - b.observed), 0)
    : null;

  const brier = agg.meanBrier ?? 0;
  const status: "NOMINAL" | "WARNING" | "BREACH" =
    brier >= 0.55 || (ece !== null && ece >= 0.03) ? "BREACH"
    : brier >= 0.45 || (ece !== null && ece >= 0.015) ? "WARNING"
    : "NOMINAL";

  // Settlement highlights — worst 3 misses + best 3
  const settled = entries
    .filter((e) => e.modelBrier !== undefined && e.result !== undefined)
    .sort((a, b) => b.modelBrier! - a.modelBrier!);

  const worstMisses = settled.slice(0, 3).map((e) => {
    const f = fixtureBySlug(e.slug);
    const home = f ? clubById(f.homeId).short : "?";
    const away = f ? clubById(f.awayId).short : "?";
    return { label: `${home} vs ${away}`, result: e.result!, split: e.split, brier: e.modelBrier!, grade: gradeFrom(e.modelBrier!) };
  });

  const sharpCalls = [...settled].reverse().slice(0, 3).map((e) => {
    const f = fixtureBySlug(e.slug);
    const home = f ? clubById(f.homeId).short : "?";
    const away = f ? clubById(f.awayId).short : "?";
    return { label: `${home} vs ${away}`, result: e.result!, split: e.split, brier: e.modelBrier!, grade: gradeFrom(e.modelBrier!) };
  });

  // Upcoming locks
  const upcomingLocks = views
    .filter((v) => v.status === "locked" || v.status === "upcoming")
    .slice(0, 5);

  // Open locks count
  const openLocks = entries.filter((e) => e.result === undefined).length;

  // Grade distribution
  const gradeCounts = { SURPRISE: 0, MISS: 0, CLOSE: 0, SOLID: 0, SHARP: 0 };
  for (const e of settled) gradeCounts[gradeFrom(e.modelBrier!)]++;

  // Active learning signals
  const learningSignals = (learningSignalsJson as { signals: Array<{ id: string; status: string; title: string; promotionDecision: string; currentN: number; promotionRequiredN: number }> }).signals;
  const activeSignals = learningSignals.filter((s) => s.status === "monitoring" || s.status === "action_required");

  return (
    <AppChrome route="home">
      <RouteStack>

        {/* ── EXECUTIVE BRIEFING HEADER ── */}
        <div className="border-b border-[var(--line)] px-6 py-5">
          <div className="flex items-start justify-between gap-6">
            <div>
              <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-2">
                WC26 Forecasting Intelligence Platform
              </div>
              <h1 className="text-display text-3xl font-bold leading-tight">
                Forecast Command Center
              </h1>
              <p className="text-label text-[var(--ink-muted)] mt-2 max-w-xl">
                Predictions locked pre-kickoff. Scored after the whistle. Never retroactively edited.
                Model performance tracked from first prediction to final whistle.
              </p>
            </div>
            <div className="shrink-0 text-right">
              <StatusBadge status={status} />
              <div className="text-fine text-[var(--ink-faint)] mt-2">
                Brier {brier.toFixed(3)} · n={agg.n} settled
              </div>
            </div>
          </div>
        </div>

        {/* ── STATUS RAIL ── */}
        <SignalLine
          signals={[
            { label: "Settled predictions", value: agg.n, detail: "official sample" },
            { label: "Open locks", value: openLocks, tone: "warn", detail: "frozen pre-kickoff" },
            { label: "Correct picks", value: Math.round((agg.accuracy ?? 0) * 100), suffix: "%", detail: "top-outcome accuracy" },
            { label: "Surprise rate", value: Math.round((gradeCounts.SURPRISE / Math.max(1, agg.n)) * 100), suffix: "%", tone: "warn", detail: "Brier ≥ 0.90" },
            { label: "Sharp calls", value: gradeCounts.SHARP, tone: "up", detail: "Brier ≤ 0.35" },
          ]}
        />

        {/* ── MODEL HEALTH METRICS ── */}
        <CanvasSection eyebrow="Model Health" title="Live accountability. Updated after every settled match.">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <HealthKpi
              label="Mean Brier Score"
              value={brier.toFixed(3)}
              sub={`n=${agg.n} · Uniform baseline: 0.667`}
              accent={brier >= 0.55 ? "var(--down)" : brier >= 0.45 ? "var(--warn)" : "var(--up)"}
              gate={brier >= 0.51 ? "≤ 0.51" : undefined}
            />
            <HealthKpi
              label="Calibration (ECE)"
              value={ece !== null ? `${(ece * 100).toFixed(1)}%` : "—"}
              sub="Expected calibration error · lower is better"
              accent={ece !== null && ece >= 0.03 ? "var(--down)" : ece !== null && ece >= 0.015 ? "var(--warn)" : "var(--up)"}
              gate={ece !== null && ece >= 0.03 ? "< 3.0%" : undefined}
            />
            <HealthKpi
              label="Mean RPS"
              value={(agg.meanRps ?? 0).toFixed(3)}
              sub="Ranked probability score · lower is better"
              accent={(agg.meanRps ?? 0) >= 0.22 ? "var(--down)" : "var(--ink-muted)"}
            />
            <HealthKpi
              label="Sharp + Solid Rate"
              value={`${Math.round(((gradeCounts.SHARP + gradeCounts.SOLID) / Math.max(1, agg.n)) * 100)}%`}
              sub={`${gradeCounts.SHARP} sharp · ${gradeCounts.SOLID} solid · ${gradeCounts.MISS + gradeCounts.SURPRISE} miss/surprise`}
              accent="var(--ink-muted)"
            />
          </div>
        </CanvasSection>

        {/* ── GRADE DISTRIBUTION ── */}
        <CanvasSection eyebrow="Forecast Grades" title="Accuracy distribution across all settled predictions.">
          <DataPlane>
            <div className="grid grid-cols-5 gap-2">
              {(["SHARP", "SOLID", "CLOSE", "MISS", "SURPRISE"] as const).map((grade) => {
                const count = gradeCounts[grade];
                const pct = agg.n > 0 ? (count / agg.n) * 100 : 0;
                const color = grade === "SURPRISE" || grade === "MISS" ? "var(--down)"
                  : grade === "CLOSE" ? "var(--ink-muted)"
                  : "var(--up)";
                const barColor = grade === "SURPRISE" ? "var(--down)"
                  : grade === "MISS" ? "var(--warn)"
                  : grade === "CLOSE" ? "var(--ink-faint)"
                  : "var(--up)";
                return (
                  <div key={grade} className="text-center">
                    <div className="text-2xl font-bold tabular-nums" style={{ color }}>{count}</div>
                    <div className="text-fine font-semibold uppercase tracking-wide mt-1" style={{ color }}>{grade}</div>
                    <div className="mt-2 h-1 w-full rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: barColor }} />
                    </div>
                    <div className="text-fine text-[var(--ink-faint)] mt-1 tabular-nums">{pct.toFixed(0)}%</div>
                  </div>
                );
              })}
            </div>
          </DataPlane>
        </CanvasSection>

        {/* ── SETTLEMENT HIGHLIGHTS ── */}
        <div className="grid gap-6 lg:grid-cols-2">
          <CanvasSection eyebrow="Largest Misses" title="Where the model was most wrong.">
            <DataPlane>
              {worstMisses.map((m, i) => (
                <SettlementRow
                  key={m.label}
                  rank={`${i + 1}.`}
                  label={m.label}
                  result={m.result}
                  split={m.split}
                  brier={m.brier}
                  grade={m.grade as "SURPRISE" | "MISS" | "CLOSE" | "SOLID" | "SHARP"}
                />
              ))}
            </DataPlane>
          </CanvasSection>

          <CanvasSection eyebrow="Sharpest Calls" title="Where the model performed best.">
            <DataPlane>
              {sharpCalls.map((m, i) => (
                <SettlementRow
                  key={m.label}
                  rank={`${i + 1}.`}
                  label={m.label}
                  result={m.result}
                  split={m.split}
                  brier={m.brier}
                  grade={m.grade as "SURPRISE" | "MISS" | "CLOSE" | "SOLID" | "SHARP"}
                />
              ))}
            </DataPlane>
          </CanvasSection>
        </div>

        {/* ── ACTIVE LEARNING SIGNALS ── */}
        {activeSignals.length > 0 && (
          <CanvasSection eyebrow="Learning Signals" title="Active investigations into model improvement.">
            <DataPlane>
              {activeSignals.map((s) => {
                const progress = Math.min(100, (s.currentN / s.promotionRequiredN) * 100);
                const statusColor = s.status === "action_required" ? "var(--down)" : "var(--warn)";
                return (
                  <div key={s.id} className="py-3 border-b border-[var(--hairline)] last:border-0">
                    <div className="flex items-start justify-between gap-4 mb-2">
                      <div>
                        <div className="flex items-center gap-2 mb-1">
                          <span className="text-fine font-mono text-[var(--ink-faint)]">{s.id}</span>
                          <span
                            className="text-tiny font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-sm"
                            style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
                          >
                            {s.status.toUpperCase().replace("_", " ")}
                          </span>
                        </div>
                        <div className="text-label font-medium text-[var(--ink)]">{s.title}</div>
                      </div>
                      <div className="text-right shrink-0">
                        <div
                          className="text-slight font-bold uppercase tracking-wide"
                          style={{ color: s.promotionDecision === "DENIED" ? "var(--down)" : s.promotionDecision === "APPROVED" ? "var(--up)" : "var(--warn)" }}
                        >
                          {s.promotionDecision}
                        </div>
                        <div className="text-fine text-[var(--ink-faint)]">n={s.currentN}/{s.promotionRequiredN}</div>
                      </div>
                    </div>
                    <div className="h-0.5 w-full rounded-full bg-[rgba(255,255,255,0.06)]">
                      <div
                        className="h-full rounded-full"
                        style={{ width: `${progress}%`, backgroundColor: progress < 30 ? "var(--down)" : "var(--warn)" }}
                      />
                    </div>
                    <div className="text-fine text-[var(--ink-faint)] mt-1.5">
                      {progress.toFixed(0)}% evidence accumulated · {s.promotionRequiredN - s.currentN} more matches required for promotion eligibility
                    </div>
                  </div>
                );
              })}
            </DataPlane>
          </CanvasSection>
        )}

        {/* ── UPCOMING LOCKS ── */}
        {upcomingLocks.length > 0 && (
          <CanvasSection eyebrow="Upcoming Locks" title="Next predictions to be evaluated. Locked before kickoff.">
            <DataPlane>
              {upcomingLocks.map((v) => {
                const home = clubById(v.fixture.homeId).short;
                const away = clubById(v.fixture.awayId).short;
                const entry = (predictionsJson as { entries: LockedEntry[] }).entries.find(e => e.slug === v.fixture.slug);
                return (
                  <LockRow
                    key={v.fixture.slug}
                    label={`${home} vs ${away}`}
                    kickoff={new Date(v.fixture.kickoffISO).toLocaleDateString("en-US", {
                      month: "short", day: "numeric", hour: "numeric", minute: "2-digit", timeZone: "America/New_York"
                    })}
                    split={entry?.split}
                  />
                );
              })}
            </DataPlane>
          </CanvasSection>
        )}

        {/* ── PLATFORM IDENTITY ── */}
        <CanvasSection eyebrow="How This Works" title="Forecast. Lock. Score. Learn.">
          <div className="grid gap-6 md:grid-cols-4">
            {[
              { step: "01", label: "Forecast", body: "Elo + Dixon-Coles Poisson model generates 3-way probabilities. Platt calibration applied. Every prediction includes a score probability surface." },
              { step: "02", label: "Lock", body: "Predictions frozen before kickoff. Stored in the immutable ledger. Never edited after the lock. The timestamp is the evidence." },
              { step: "03", label: "Score", body: "After the final whistle, Brier score and RPS computed. Grade assigned: Sharp / Solid / Close / Miss / Surprise. No retroactive changes." },
              { step: "04", label: "Learn", body: "Calibration gaps investigated. Challenger models evaluated. Promotion requires statistical significance (p < 0.05, bootstrap CI lower > 0, n ≥ 245)." },
            ].map(({ step, label, body }) => (
              <div key={step}>
                <div className="text-fine font-mono text-[var(--ink-faint)] mb-2">{step}</div>
                <div className="text-sm font-semibold text-[var(--ink)] mb-2">{label}</div>
                <p className="text-caption text-[var(--ink-muted)] leading-relaxed">{body}</p>
              </div>
            ))}
          </div>
        </CanvasSection>

      </RouteStack>
    </AppChrome>
  );
}
