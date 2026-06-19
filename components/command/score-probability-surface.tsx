"use client";

import { compressGrid, topScorelines } from "@/lib/command-data";

type Props = {
  grid: number[][];
  homeTeam: string;
  awayTeam: string;
  lockExpiresISO?: string;
};

function cellType(row: number, col: number): "home" | "draw" | "away" {
  if (row > col) return "home";
  if (row === col) return "draw";
  return "away";
}

const CELL_BASE: Record<"home" | "draw" | "away", string> = {
  home:  "rgba(124,255,178,",
  draw:  "rgba(255,255,255,",
  away:  "rgba(255,103,77,",
};
const CELL_TEXT: Record<"home" | "draw" | "away", string> = {
  home:  "rgba(124,255,178,0.85)",
  draw:  "rgba(244,244,239,0.55)",
  away:  "rgba(255,103,77,0.8)",
};

function pctStr(p: number): string {
  const pct = Math.round(p * 100);
  return pct >= 1 ? `${pct}%` : "—";
}

function cellBg(type: "home" | "draw" | "away", prob: number): string {
  const alpha = Math.min(0.04 + prob * 4.5, 0.6).toFixed(2);
  return `${CELL_BASE[type]}${alpha})`;
}

export function ScoreProbabilitySurface({ grid, homeTeam, awayTeam, lockExpiresISO }: Props) {
  const grid6 = compressGrid(grid);
  const topK = topScorelines(grid6, 6);
  const bestCell = topK[0];

  const colLabels = ["0", "1", "2", "3", "4", "5+"];
  const rowLabels = ["0", "1", "2", "3", "4", "5+"];

  const hoursLeft = lockExpiresISO
    ? Math.max(0, (new Date(lockExpiresISO).getTime() - Date.now()) / 3_600_000)
    : undefined;
  const lockDisplay = hoursLeft !== undefined
    ? hoursLeft < 1
      ? `${Math.round(hoursLeft * 60)}m`
      : hoursLeft < 24
        ? `${Math.floor(hoursLeft)}h ${Math.round((hoursLeft % 1) * 60)}m`
        : `${Math.floor(hoursLeft / 24)}d ${Math.floor(hoursLeft % 24)}h`
    : null;

  return (
    <div>
      <div className="flex items-baseline justify-between mb-2.5">
        <span className="text-slight font-semibold text-[var(--ink-muted)]">Score probability surface</span>
        <span className="text-fine text-[var(--ink-faint)]">Dixon-Coles Poisson · full model output</span>
      </div>

      {/* Away axis labels */}
      <div className="flex pl-6 mb-0.5">
        {colLabels.map((l) => (
          <div key={l} className="flex-1 text-center text-tiny text-[var(--ink-faint)]">{l}</div>
        ))}
      </div>
      <div className="text-micro text-[var(--ink-faint)] pl-6 mb-0.5 tracking-wide">
        {awayTeam} goals →
      </div>

      {/* Grid rows */}
      {grid6.map((row, r) => (
        <div key={r} className="flex items-center mb-0.5">
          <div className="w-6 flex-shrink-0 text-tiny text-[var(--ink-faint)] text-right pr-1 tabular-nums">
            {rowLabels[r]}
          </div>
          <div className="flex flex-1 gap-0.5">
            {row.map((prob, c) => {
              const type = cellType(r, c);
              const isBest = bestCell && r === bestCell.home && c === bestCell.away;
              return (
                <div
                  key={c}
                  className="flex-1 h-6 flex items-center justify-center rounded-sm text-tiny font-semibold tabular-nums"
                  style={{
                    background: cellBg(type, prob),
                    color: CELL_TEXT[type],
                    outline: isBest ? "1px solid rgba(255,255,255,0.22)" : undefined,
                  }}
                >
                  {isBest ? <strong>{pctStr(prob)}</strong> : pctStr(prob)}
                </div>
              );
            })}
          </div>
        </div>
      ))}

      <div className="text-micro text-[var(--ink-faint)] mt-1 mb-2 tracking-wide">
        ↑ {homeTeam} goals
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 mb-2.5">
        {(["home", "draw", "away"] as const).map((t) => (
          <div key={t} className="flex items-center gap-1 text-fine text-[var(--ink-faint)]">
            <div className="w-2.5 h-2.5 rounded-sm" style={{ background: `${CELL_BASE[t]}0.25)` }} />
            {t === "home" ? `${homeTeam} win` : t === "away" ? `${awayTeam} win` : "Draw"}
          </div>
        ))}
        <div className="flex items-center gap-1 text-fine text-[var(--ink-faint)] ml-auto">
          <div className="w-2.5 h-2.5 rounded-sm" style={{ outline: "1px solid rgba(255,255,255,0.22)", background: "transparent" }} />
          Most likely
        </div>
      </div>

      {/* Top scorelines */}
      <div className="flex flex-wrap gap-1 mb-3">
        {topK.map((s, i) => {
          const label = s.home === s.away
            ? `${s.home}–${s.away}`
            : s.home > s.away
              ? `${homeTeam} ${s.home}–${s.away}`
              : `${awayTeam} ${s.away}–${s.home}`;
          return (
            <div
              key={i}
              className={[
                "flex items-center gap-1 px-2 py-1 rounded-full border text-slight tabular-nums",
                i === 0
                  ? "border-[rgba(124,255,178,0.28)] bg-[rgba(124,255,178,0.04)] text-[var(--up)]"
                  : "border-[var(--hairline)] text-[var(--ink-muted)]",
              ].join(" ")}
            >
              <span className="font-semibold">{label}</span>
              <span className="text-[var(--ink-faint)]">{pctStr(s.prob)}</span>
            </div>
          );
        })}
      </div>

      {/* Lock countdown */}
      {lockDisplay && (
        <div className="flex items-center justify-between px-3 py-2 border border-[rgba(255,196,107,0.22)] bg-[rgba(255,196,107,0.025)] rounded">
          <div>
            <div className="text-slight text-[var(--warn)] font-medium">Prediction lock expires</div>
            <div className="text-fine text-[var(--ink-faint)]">
              {lockExpiresISO ? new Date(lockExpiresISO).toUTCString().slice(0, 16) : ""} UTC
            </div>
          </div>
          <div className="text-sm font-bold text-[var(--warn)] tabular-nums tracking-wide">
            {lockDisplay}
          </div>
        </div>
      )}
    </div>
  );
}
