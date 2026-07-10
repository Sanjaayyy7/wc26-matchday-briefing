import Link from "next/link";
import type { ReactNode } from "react";
import { WCS26Shell } from "@/components/wc26-shell";
import { RouteStack, CanvasSection } from "@/components/cinematic";
import { IntelligenceCard } from "@/components/intelligence-card";
import { Surface } from "@/components/ui/surface";
import type { AccountabilityOutput } from "@/lib/accountability";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import learningSignalsJson from "@/data/learning-signals.json";

export const metadata = { title: "Methodology — How WC26 grades itself" };

const accountability = accountabilityJson as AccountabilityOutput;

function Principle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <Surface className="p-5 flex flex-col gap-2">
      <h3 className="text-title">{title}</h3>
      <p className="text-body">{children}</p>
    </Surface>
  );
}

export default function MethodologyPage() {
  const agg = accountability.official.aggregates;
  const bins = accountability.official.calibrationBins ?? [];
  const binN = bins.reduce((s, b) => s + b.n, 0);
  const ece = binN > 0 ? bins.reduce((s, b) => s + (b.n / binN) * Math.abs(b.predicted - b.observed), 0) : 0;
  const ecePct = (ece * 100).toFixed(1);
  const calibStatus = ece < 0.03 ? "NOMINAL" : ece < 0.05 ? "WARNING" : "BREACH";
  const graded = agg.n;

  const ls = learningSignalsJson as {
    signals: Array<{ id: string; title: string; status: string }>;
    champion: string;
  };
  const activeSignals = ls.signals.filter(
    (s) => s.status === "monitoring" || s.status === "action_required",
  );

  return (
    <WCS26Shell route="methodology">
      <RouteStack>
        <CanvasSection eyebrow="Operating procedures" title="How WC26 grades itself">
          <p className="max-w-2xl text-title leading-relaxed text-[var(--ink-muted)]">
            WC26 is an accountable forecasting engine. Every forecast is locked before kickoff,
            graded after the whistle, and audited in public — including where the model is wrong.
            These are the operating procedures behind the record.
          </p>
        </CanvasSection>

        <CanvasSection eyebrow="Protocol" title="Lock, settle, score">
          <div className="flex flex-col gap-4 max-w-3xl">
            <Principle title="Lock policy">
              Every prediction is committed before kickoff with a timestamp and stored in an
              immutable ledger. Locked probabilities are never edited after the fact — settlement
              only adds the result and its grades.
            </Principle>
            <Principle title="Settlement">
              Forecasts are graded against the full-time result. Matches played before a locked
              prediction existed are marked informational and excluded from the official record.
            </Principle>
            <Principle title="Scoring">
              The primary metric is the Brier score; we also report RPS, log-loss, and expected
              calibration error. Baselines are stated openly: a uniform one-third forecast scores
              Brier 0.667, and the model is only credible when it beats that line.
            </Principle>
            <Principle title="Parlay slips">
              Parlay legs come only from markets the Kalshi combo builder can combine into one
              ticket; goalscorer and corner markets are listed there but unmodeled, so the engine
              is structurally unable to select them. First-half legs are priced by a pre-registered
              binomial goal split on the model score grid (q = 0.45 — a tournament-wide constant,
              deliberately crude, refit only as a new dated registration). v2 floors are
              pre-registered at leg ≥ 75%, joint ≥ 60%, 2–4 legs; tight matches are expected to
              produce honest no-slip days. Combos allow at most one leg per market category;
              verified against the Kalshi collections API on 2026-07-09 — the engine was bumped to
              v2.1-combo that day to enforce the rule, and earlier v2-combo slips are marked legacy
              since they are not purchasable as one ticket under it. Later that day the v3 value
              engine replaced the hit-first profile: goalscorer markets joined the universe (priced
              as a Binomial share of team goals from World Cup goals + xG and the predicted lineup),
              regulation moneyline and to-advance were registered as mutually exclusive in one
              ticket, and selection now maximizes edge over the product of lock-time Kalshi mids
              under pre-registered bands (legs 50–90%, joint 30–60%, edge ≥ 3 pts) — a registered
              principle change: mids benchmark v3 selection while model probabilities stay pure
              model. Legs grade on the 90-minute score, half-time score, recorded scorers, or actual
              winner per market window. The extra-time share behind advancement pricing stays the
              simulator Elo logistic — consistency over false precision.
            </Principle>
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Definitions" title="Verdicts &amp; gates">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2 max-w-3xl">
            <IntelligenceCard category="Verdict — hit / close / miss">
              <strong className="text-[var(--ink)]">Hit:</strong> the model&rsquo;s most-likely
              outcome occurred. <strong className="text-[var(--ink)]">Close:</strong> the realized
              outcome was the model&rsquo;s 2nd pick or within one goal on the scoreline — and the
              model gave it at least 20%. <strong className="text-[var(--ink)]">Miss:</strong>{" "}
              anything else. A low-probability outcome is never counted as close.
            </IntelligenceCard>
            <IntelligenceCard
              category="Calibration gate"
              accent={calibStatus === "NOMINAL" ? "up" : calibStatus === "WARNING" ? "warn" : "down"}
            >
              Expected calibration error under 3% is NOMINAL, under 5% is WARNING, otherwise BREACH.
              Current calibration error is{" "}
              <span className="tabular-nums">{ecePct}%</span> over{" "}
              <span className="tabular-nums">{graded}</span> graded matches — status{" "}
              {calibStatus}, shown rather than hidden.
            </IntelligenceCard>
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Governance" title="Versioning &amp; model promotion">
          <div className="flex flex-col gap-4 max-w-3xl">
            <Principle title="Champion model">
              The live model is {ls.champion}. A version only changes when a challenger earns it.
            </Principle>
            <Principle title="Challenger program">
              Alternative configurations are evaluated against the champion on the settled sample
              using paired Brier differences and bootstrap confidence intervals. Promotion requires
              a stable, statistically significant improvement over a substantially larger sample —
              not a lead within run-to-run variance. The current decision is to hold.
            </Principle>
            <Principle title="Active investigations">
              {activeSignals.length > 0
                ? activeSignals.map((s) => `${s.id} — ${s.title}`).join("; ")
                : "None open."}
            </Principle>
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Validation" title="How we validate">
          <div className="flex flex-col gap-4 max-w-3xl">
            <Principle title="Tournament-holdout regime">
              The model is measured on the regime it actually runs in: finals-tournament
              matches — the World Cup, the Euros, Copa América, the Africa Cup of Nations, and
              the Asian Cup. A time split dominated by friendlies flatters a forecaster on
              matches that look nothing like a knockout summer, so it is not the yardstick we
              promote against.
            </Principle>
            <Principle title="Walk-forward, no leakage">
              Every variant is fit only on matches that finished strictly before the one it is
              scoring, and calibration is re-derived per tournament from prior data alone.
              Nothing from the future ever informs a past forecast, so the measured skill is
              the skill the model would have had live.
            </Principle>
            <Principle title="Confidence-gated promotion">
              A challenger replaces the champion only when its Brier improvement clears a
              pre-registered bootstrap confidence interval — the whole interval better than the
              incumbent, not a lead that fits inside run-to-run noise — while staying within the
              calibration gate. A win that could be variance is held, by rule.
            </Principle>
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Caveats" title="Sample size &amp; limits">
          <Surface className="p-5 max-w-2xl">
            <p className="text-body">
              The official sample is{" "}
              <span className="tabular-nums">{graded}</span> graded matches. Below roughly 30–50
              matches, all figures are provisional and carry wide error bars; they describe the
              record so far, not a settled conclusion. See the full{" "}
              <Link
                href="/"
                className="underline underline-offset-2 text-[var(--accent)] hover:opacity-80 transition-opacity duration-300"
              >
                accountability record →
              </Link>
              .
            </p>
          </Surface>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
