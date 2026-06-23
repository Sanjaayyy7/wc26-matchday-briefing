"use client";

import type { CommandFixture, ForecastGrade } from "@/lib/command-data";

const GRADE_STYLES: Record<ForecastGrade, { bg: string; text: string; border?: string }> = {
  sharp:    { bg: "bg-[rgba(127,209,176,0.1)]",  text: "text-[var(--up)]" },
  solid:    { bg: "bg-[rgba(74,144,217,0.1)]",   text: "text-[var(--signal-1)]" },
  close:    { bg: "bg-[rgba(255,196,107,0.1)]",  text: "text-[var(--warn)]" },
  miss:     { bg: "bg-[rgba(224,101,79,0.1)]",   text: "text-[var(--down)]" },
  surprise: { bg: "bg-[rgba(224,101,79,0.15)]",  text: "text-[var(--down)]", border: "border border-[rgba(224,101,79,0.28)]" },
};

function GradeBadge({ grade }: { grade: ForecastGrade }) {
  const s = GRADE_STYLES[grade];
  return (
    <span className={`text-micro font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide ${s.bg} ${s.text} ${s.border ?? ""}`}>
      {grade}
    </span>
  );
}

function LockBadge() {
  return (
    <span className="text-micro font-bold px-1.5 py-0.5 rounded-sm uppercase tracking-wide bg-[rgba(255,255,255,0.05)] text-[var(--ink-faint)]">
      Locked
    </span>
  );
}

type Props = {
  fixtures: CommandFixture[];
  selectedSlug: string;
  onSelect: (slug: string) => void;
};

export function ForecastRecord({ fixtures, selectedSlug, onSelect }: Props) {
  const settled = fixtures.filter((f) => !f.isOperational);
  const operational = fixtures.filter((f) => f.isOperational);

  return (
    <div>
      <div className="flex items-baseline justify-between px-4 py-3 border-b border-[var(--hairline)]">
        <span className="text-slight font-semibold text-[var(--ink)]">Forecast Record</span>
        <span className="text-fine text-[var(--ink-faint)] tabular-nums">{fixtures.length} locks</span>
      </div>

      {settled.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1 text-tiny font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
            Settled
          </div>
          {settled.map((f) => (
            <button
              key={f.slug}
              onClick={() => onSelect(f.slug)}
              className={[
                "w-full flex items-center gap-2 px-4 py-1.5 border-b border-[var(--hairline)] text-left transition-colors",
                f.slug === selectedSlug
                  ? "bg-[rgba(127,209,176,0.04)]"
                  : "hover:bg-[rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">{f.homeTeam}</span>
                  <span className="mx-1 text-fine text-[var(--ink-faint)]">vs</span>
                  {f.awayTeam}
                </div>
                <div className="text-fine text-[var(--ink-faint)] mt-0.5">
                  {f.group ?? f.stage} · {f.result?.replace("-", "–")}
                </div>
              </div>
              {f.grade ? <GradeBadge grade={f.grade} /> : null}
            </button>
          ))}
        </>
      )}

      {operational.length > 0 && (
        <>
          <div className="px-4 pt-2 pb-1 text-tiny font-semibold uppercase tracking-widest text-[var(--ink-faint)]">
            Operational
          </div>
          {operational.map((f) => (
            <button
              key={f.slug}
              onClick={() => onSelect(f.slug)}
              className={[
                "w-full flex items-center gap-2 px-4 py-1.5 border-b border-[var(--hairline)] text-left transition-colors",
                f.slug === selectedSlug
                  ? "bg-[rgba(127,209,176,0.04)]"
                  : "hover:bg-[rgba(255,255,255,0.03)]",
              ].join(" ")}
            >
              <div className="flex-1 min-w-0">
                <div className="text-xs text-[var(--ink-muted)]">
                  <span className="font-medium text-[var(--ink)]">{f.homeTeam}</span>
                  <span className="mx-1 text-fine text-[var(--ink-faint)]">vs</span>
                  {f.awayTeam}
                </div>
                <div className="text-fine text-[var(--ink-faint)] mt-0.5">
                  {f.group ?? f.stage}
                  {f.hoursUntilKickoff !== undefined
                    ? ` · ${f.hoursUntilKickoff < 24
                        ? `${Math.round(f.hoursUntilKickoff)}h left`
                        : `${Math.round(f.hoursUntilKickoff / 24)}d left`}`
                    : ""}
                </div>
              </div>
              <LockBadge />
            </button>
          ))}
        </>
      )}
    </div>
  );
}
