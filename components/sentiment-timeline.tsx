"use client";

import dynamic from "next/dynamic";
import type { SentimentBucket, SentimentEventRow } from "@/lib/sentiment-view";

interface Props {
  timeline: SentimentBucket[];
  events: SentimentEventRow[];
}

// Load react-plotly.js only in the browser — never SSR.
// If the import fails (package not installed), we render the CSS/SVG fallback.
const PlotlyChart = dynamic(
  () =>
    import("react-plotly.js").then((mod) => {
      const Plot = mod.default;
      return function SentimentPlot({ timeline, events }: Props) {
        const minutes = timeline.map((b) => b.minuteBucket + 2.5); // centre of bucket
        const posPct = timeline.map((b) => b.posPct * 100);
        const negPct = timeline.map((b) => -b.negPct * 100); // negative axis for NEG

        // Resolve CSS custom properties at render time for Plotly (canvas can't read vars)
        const getVar = (name: string, fallback: string) => {
          if (typeof window === "undefined") return fallback;
          return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || fallback;
        };
        const colorUp = getVar("--up", "green");
        const colorDown = getVar("--down", "red");
        const colorMuted = getVar("--ink-muted", "gray");
        const colorLine = getVar("--line", "gray");
        const colorInk = getVar("--ink", "white");

        const shapes = events.map((ev) => ({
          type: "line" as const,
          x0: ev.minute,
          x1: ev.minute,
          y0: -100,
          y1: 100,
          line: {
            color:
              ev.type === "goal" ? colorUp : ev.type === "red" ? colorDown : colorMuted,
            width: 1,
            dash: "dot",
          },
        }));

        const annotations = events.map((ev) => ({
          x: ev.minute,
          y: ev.type === "goal" ? 90 : -90,
          text: ev.type === "goal" ? "GOAL" : ev.type === "red" ? "RED" : "YEL",
          showarrow: false,
          font: { size: 9, color: ev.type === "goal" ? colorUp : ev.type === "red" ? colorDown : colorMuted },
          xanchor: "center" as const,
          yanchor: "middle" as const,
        }));

        return (
          <Plot
            data={[
              {
                x: minutes,
                y: posPct,
                type: "scatter",
                mode: "lines",
                name: "Positive %",
                line: { color: colorUp, width: 2 },
                fill: "tozeroy",
                fillcolor: colorUp,
                opacity: 0.15,
              },
              {
                x: minutes,
                y: negPct,
                type: "scatter",
                mode: "lines",
                name: "Negative %",
                line: { color: colorDown, width: 2 },
                fill: "tozeroy",
                fillcolor: colorDown,
                opacity: 0.15,
              },
            ]}
            layout={{
              paper_bgcolor: "transparent",
              plot_bgcolor: "transparent",
              font: { color: colorInk, size: 11 },
              margin: { t: 16, r: 16, b: 40, l: 48 },
              xaxis: {
                title: { text: "Match minute" },
                gridcolor: colorLine,
                range: [0, 95],
                tickmode: "linear",
                tick0: 0,
                dtick: 15,
              },
              yaxis: {
                title: { text: "Sentiment %" },
                gridcolor: colorLine,
                range: [-100, 100],
                ticksuffix: "%",
              },
              legend: { orientation: "h", y: -0.2 },
              shapes,
              annotations,
              showlegend: true,
            }}
            config={{ displayModeBar: false, responsive: true }}
            style={{ width: "100%", height: 320 }}
          />
        );
      };
    }),
  { ssr: false, loading: () => <SvgFallback timeline={[]} events={[]} /> }
);

/** Pure CSS/SVG fallback rendered when Plotly isn't available or during SSR loading. */
function SvgFallback({ timeline, events }: Props) {
  if (!timeline.length) {
    return (
      <div className="flex items-center justify-center h-48 border border-dashed border-[var(--line)] rounded">
        <p className="text-caption text-[var(--ink-muted)]">Loading chart…</p>
      </div>
    );
  }
  const W = 600, H = 200, PAD = 40;
  const innerW = W - PAD * 2, innerH = H - PAD;
  const maxMinute = Math.max(...timeline.map((b) => b.minuteBucket)) + 5;
  const toX = (min: number) => PAD + (min / maxMinute) * innerW;
  const toY = (pct: number) => H - PAD - (pct / 100) * innerH;

  const posPoints = timeline.map((b) => `${toX(b.minuteBucket + 2.5)},${toY(b.posPct * 100)}`).join(" ");
  const negPoints = timeline.map((b) => `${toX(b.minuteBucket + 2.5)},${toY(b.negPct * 100)}`).join(" ");

  return (
    <div className="w-full overflow-x-auto">
      <svg viewBox={`0 0 ${W} ${H}`} className="w-full" aria-label="Sentiment timeline">
        {/* Grid line at midpoint */}
        <line x1={PAD} y1={toY(0)} x2={W - PAD} y2={toY(0)} stroke="var(--line)" strokeDasharray="2 4" />
        {/* Event lines */}
        {events.map((ev, i) => (
          <line
            key={i}
            x1={toX(ev.minute)}
            y1={toY(100)}
            x2={toX(ev.minute)}
            y2={toY(0)}
            stroke={ev.type === "goal" ? "var(--up)" : ev.type === "red" ? "var(--down)" : "var(--ink-muted)"}
            strokeDasharray="3 3"
            strokeWidth={1}
            opacity={0.7}
          />
        ))}
        {/* Positive polyline */}
        <polyline points={posPoints} fill="none" stroke="var(--up)" strokeWidth={2} />
        {/* Negative polyline */}
        <polyline points={negPoints} fill="none" stroke="var(--down)" strokeWidth={2} />
        {/* Axes */}
        <line x1={PAD} y1={PAD / 2} x2={PAD} y2={H - PAD} stroke="var(--line)" />
        <line x1={PAD} y1={H - PAD} x2={W - PAD} y2={H - PAD} stroke="var(--line)" />
        {/* Legend */}
        <rect x={PAD} y={4} width={10} height={4} fill="var(--up)" />
        <text x={PAD + 14} y={11} fontSize={9} fill="var(--ink)">Positive</text>
        <rect x={PAD + 70} y={4} width={10} height={4} fill="var(--down)" />
        <text x={PAD + 84} y={11} fontSize={9} fill="var(--ink)">Negative</text>
      </svg>
      <div className="flex flex-wrap gap-3 mt-2">
        {events.map((ev, i) => (
          <span key={i} className="text-caption">
            <span className={`inline-block w-2 h-2 rounded-full mr-1 ${ev.type === "goal" ? "bg-[var(--up)]" : ev.type === "red" ? "bg-[var(--down)]" : "bg-[var(--ink-muted)]"}`} />
            min {ev.minute} {ev.type}
          </span>
        ))}
      </div>
    </div>
  );
}

export function SentimentTimeline({ timeline, events }: Props) {
  return (
    <div className="w-full min-h-[200px]">
      <PlotlyChart timeline={timeline} events={events} />
    </div>
  );
}
