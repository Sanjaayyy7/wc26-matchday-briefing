"use client";

import { Surface } from "@/components/ui/surface";

interface LearningSignal {
  id: string;
  status: "monitoring" | "resolved" | "action_required";
  category: string;
  title: string;
  issueDate: string;
  issue: string;
  evidence: string;
  action: string;
  result: string;
  promotionDecision: "DENIED" | "APPROVED" | "PENDING";
  promotionRationale: string;
  revisitDate: string;
  revisitTrigger: string;
  promotionRequiredN: number;
  currentN: number;
  drawGapObserved?: number;
  drawGapChallenger?: number;
}

const STATUS_LABEL: Record<LearningSignal["status"], string> = {
  monitoring: "MONITORING",
  resolved: "RESOLVED",
  action_required: "ACTION REQUIRED",
};

const STATUS_COLOR: Record<LearningSignal["status"], string> = {
  monitoring: "var(--warn)",
  resolved: "var(--up)",
  action_required: "var(--down)",
};

const DECISION_COLOR: Record<LearningSignal["promotionDecision"], string> = {
  DENIED: "var(--down)",
  APPROVED: "var(--up)",
  PENDING: "var(--warn)",
};

function ProgressBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(100, (value / max) * 100);
  return (
    <div className="h-1 w-full rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
      <div className="h-full rounded-full transition-all" style={{ width: `${pct}%`, backgroundColor: color }} />
    </div>
  );
}

function Row({ label, value, accent }: { label: string; value: string; accent?: string }) {
  return (
    <div className="flex items-baseline justify-between gap-4 py-1.5 border-b border-[rgba(255,255,255,0.04)] last:border-0">
      <span className="text-slight text-[var(--ink-faint)] uppercase tracking-wide shrink-0">{label}</span>
      <span className="text-caption text-right leading-snug" style={{ color: accent ?? "var(--ink-muted)" }}>{value}</span>
    </div>
  );
}

export function LearningSig({ signal }: { signal: LearningSignal }) {
  const statusColor = STATUS_COLOR[signal.status];
  const decisionColor = DECISION_COLOR[signal.promotionDecision];
  const evidenceProgress = Math.min(100, (signal.currentN / signal.promotionRequiredN) * 100);

  return (
    <Surface className="overflow-hidden">
      {/* Header */}
      <div className="px-4 py-3 border-b border-[var(--hairline)] flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <span
              className="text-tiny font-bold tracking-widest uppercase px-1.5 py-0.5 rounded-sm"
              style={{ color: statusColor, backgroundColor: `${statusColor}18` }}
            >
              {STATUS_LABEL[signal.status]}
            </span>
            <span className="text-fine text-[var(--ink-faint)] font-mono">{signal.id}</span>
          </div>
          <h3 className="text-label font-semibold text-[var(--ink)] leading-tight">{signal.title}</h3>
          <div className="text-fine text-[var(--ink-faint)] mt-0.5">{signal.issueDate} · {signal.category}</div>
        </div>
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-4">
        <div>
          <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-1.5">Issue</div>
          <p className="text-slight text-[var(--ink-muted)] leading-relaxed">{signal.issue}</p>
        </div>

        <div>
          <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-1.5">Action Taken</div>
          <p className="text-slight text-[var(--ink-muted)] leading-relaxed">{signal.action}</p>
        </div>

        <div>
          <div className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest mb-1.5">Result</div>
          <p className="text-slight text-[var(--ink-muted)] leading-relaxed">{signal.result}</p>
        </div>

        {/* Governance decision */}
        <div className="rounded-[var(--radius-card)] bg-[var(--canvas)] border border-[var(--hairline)] px-3 py-2.5">
          <div className="flex items-center justify-between mb-2">
            <span className="text-fine font-semibold text-[var(--ink-faint)] uppercase tracking-widest">Promotion Decision</span>
            <span
              className="text-fine font-bold tracking-wider uppercase"
              style={{ color: decisionColor }}
            >
              {signal.promotionDecision}
            </span>
          </div>
          <p className="text-slight text-[var(--ink-faint)] leading-relaxed mb-3">{signal.promotionRationale}</p>

          {/* Evidence accumulation */}
          <div className="space-y-1.5">
            <div className="flex justify-between">
              <span className="text-fine text-[var(--ink-faint)]">Evidence: {signal.currentN} / {signal.promotionRequiredN} required</span>
              <span className="text-fine font-mono" style={{ color: evidenceProgress < 50 ? "var(--down)" : "var(--warn)" }}>
                {evidenceProgress.toFixed(0)}%
              </span>
            </div>
            <ProgressBar
              value={signal.currentN}
              max={signal.promotionRequiredN}
              color={evidenceProgress < 50 ? "var(--down)" : "var(--warn)"}
            />
          </div>
        </div>

        {/* Metrics if available */}
        {(signal.drawGapObserved !== undefined || signal.drawGapChallenger !== undefined) && (
          <div className="space-y-0">
            {signal.drawGapObserved !== undefined && (
              <Row label="Draw gap (observed)" value={`+${signal.drawGapObserved}pp`} accent="var(--down)" />
            )}
            {signal.drawGapChallenger !== undefined && (
              <Row label="Draw gap (challenger)" value={`+${signal.drawGapChallenger}pp`} accent="var(--warn)" />
            )}
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="px-4 py-2.5 border-t border-[var(--hairline)] bg-[var(--canvas)]">
        <div className="text-fine text-[var(--ink-faint)]">
          Next review: <span className="text-[var(--warn)]">{signal.revisitDate}</span>
          <span className="mx-2 opacity-40">·</span>
          {signal.revisitTrigger}
        </div>
      </div>
    </Surface>
  );
}

export function LearningSignals({ signals }: { signals: LearningSignal[] }) {
  if (signals.length === 0) return null;
  return (
    <section className="border-t border-[var(--line)] px-6 py-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="text-label font-semibold text-[var(--ink)]">
          Learning Signals
        </div>
        <div className="flex-1 h-px bg-[var(--hairline)]" />
        <div className="text-fine text-[var(--ink-faint)]">{signals.length} active</div>
      </div>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
        {signals.map((s) => (
          <LearningSig key={s.id} signal={s} />
        ))}
      </div>
    </section>
  );
}
