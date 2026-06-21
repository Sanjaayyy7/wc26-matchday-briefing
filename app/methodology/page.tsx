import Link from "next/link";
import type { ReactNode } from "react";
import { WCS26Shell } from "@/components/wc26-shell";
import { RouteStack, CanvasSection } from "@/components/cinematic";
import { IntelligenceCard } from "@/components/intelligence-card";
import type { AccountabilityOutput } from "@/lib/accountability";
import accountabilityJson from "@/data/backtest/wc26-accountability.json";
import learningSignalsJson from "@/data/learning-signals.json";

export const metadata = { title: "Methodology — How WC26 grades itself" };

const accountability = accountabilityJson as AccountabilityOutput;

function Principle({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-label">{title}</h3>
      <p className="max-w-2xl text-[var(--ink-muted)]">{children}</p>
    </div>
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
          <p className="max-w-2xl text-[var(--ink-muted)]">
            WC26 is an accountable forecasting engine. Every forecast is locked before kickoff,
            graded after the whistle, and audited in public — including where the model is wrong.
            These are the operating procedures behind the record.
          </p>
        </CanvasSection>

        <CanvasSection eyebrow="Protocol" title="Lock, settle, score">
          <div className="flex flex-col gap-8">
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
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Definitions" title="Verdicts & gates">
          <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
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
              Current calibration error is {ecePct}% over {graded} graded matches — status{" "}
              {calibStatus}, shown rather than hidden.
            </IntelligenceCard>
          </div>
        </CanvasSection>

        <CanvasSection eyebrow="Governance" title="Versioning & model promotion">
          <div className="flex flex-col gap-8">
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

        <CanvasSection eyebrow="Caveats" title="Sample size & limits">
          <p className="max-w-2xl text-[var(--ink-muted)]">
            The official sample is {graded} graded matches. Below roughly 30–50 matches, all figures
            are provisional and carry wide error bars; they describe the record so far, not a settled
            conclusion. See the full{" "}
            <Link href="/record" className="underline underline-offset-2">
              accountability record →
            </Link>
            .
          </p>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}
