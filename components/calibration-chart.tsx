"use client";

import dynamic from "next/dynamic";
import type { CalibrationBin } from "@/lib/accountability";

const Plot = dynamic(() => import("react-plotly.js"), { ssr: false });

export function CalibrationChart({ bins }: { bins: CalibrationBin[] }) {
  if (bins.length < 2) {
    return (
      <p className="text-caption py-8 text-center">
        Calibration chart available once ≥2 probability bins have settled matches.
      </p>
    );
  }

  const predicted = bins.map((b) => b.predicted);
  const observed = bins.map((b) => b.observed);
  const sizes = bins.map((b) => Math.max(8, Math.sqrt(b.n) * 4));

  const upColor =
    typeof window !== "undefined"
      ? getComputedStyle(document.documentElement).getPropertyValue("--up").trim() || "rgb(0,200,5)"
      : "rgb(0,200,5)";

  const trace = {
    x: predicted,
    y: observed,
    mode: "markers+lines" as const,
    name: "Model",
    marker: {
      size: sizes,
      color: upColor,
      opacity: 0.85,
    },
    line: { color: upColor, width: 1.5 },
    text: bins.map(
      (b) =>
        `n=${b.n}<br>pred=${(b.predicted * 100).toFixed(1)}%<br>obs=${(b.observed * 100).toFixed(1)}%`,
    ),
    hovertemplate: "%{text}<extra></extra>",
  };

  const diagonal = {
    x: [0, 1],
    y: [0, 1],
    mode: "lines" as const,
    name: "Perfect calibration",
    line: { color: "rgba(255,255,255,0.2)", width: 1, dash: "dash" as const },
    hoverinfo: "skip" as const,
  };

  const layout = {
    paper_bgcolor: "transparent",
    plot_bgcolor: "transparent",
    font: { color: "rgba(255,255,255,0.55)", size: 11 },
    margin: { t: 8, r: 16, b: 48, l: 52 },
    xaxis: {
      title: { text: "Predicted probability", font: { size: 11 } },
      range: [0, 1],
      gridcolor: "rgba(255,255,255,0.06)",
      tickformat: ".0%",
      zeroline: false,
    },
    yaxis: {
      title: { text: "Observed frequency", font: { size: 11 } },
      range: [0, 1],
      gridcolor: "rgba(255,255,255,0.06)",
      tickformat: ".0%",
      zeroline: false,
    },
    showlegend: false,
    height: 280,
  };

  return (
    <Plot
      data={[diagonal, trace]}
      layout={layout}
      config={{ displayModeBar: false, responsive: true }}
      style={{ width: "100%" }}
    />
  );
}
