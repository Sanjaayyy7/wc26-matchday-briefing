"use client";

import type { Prediction } from "@/lib/predict";

type ClubInfo = { short: string; venue: string };

type Props = {
  prediction: Prediction;
  homeClub: ClubInfo;
  awayClub: ClubInfo;
  neutral: boolean;
  kalshiHomePct?: number;
};

function DriverCell({
  label,
  value,
  edge,
  edgeColor,
}: {
  label: string;
  value: string;
  edge: string;
  edgeColor: "up" | "warn" | "neutral";
}) {
  const edgeColors = {
    up: "text-[var(--up)]",
    warn: "text-[var(--warn)]",
    neutral: "text-[var(--ink-faint)]",
  };
  return (
    <div className="p-2 bg-[var(--surface)] border border-[var(--hairline)]">
      <div className="text-tiny text-[var(--ink-faint)] mb-1">{label}</div>
      <div className="text-xs font-medium text-[var(--ink-muted)]">{value}</div>
      <div className={`text-fine font-semibold mt-0.5 ${edgeColors[edgeColor]}`}>{edge}</div>
    </div>
  );
}

export function ForecastDrivers({ prediction, homeClub, awayClub, neutral, kalshiHomePct }: Props) {
  const { elo, lambdas, form, split } = prediction;
  const eloDiff = elo.home - elo.away;
  const lambdaDiff = lambdas.home - lambdas.away;
  const modelHomePct = Math.round(split.home);

  function formSummary(f: { results: string }): string {
    return f.results.split("").slice(-5).join("") || "—";
  }

  const marketDev = kalshiHomePct !== undefined ? modelHomePct - kalshiHomePct : null;

  const primaryDrivers: Array<{ label: string; value: string; edge: string; edgeColor: "up" | "warn" | "neutral" }> = [
    {
      label: "Elo differential",
      value: `${homeClub.short} ${elo.home} · ${awayClub.short} ${elo.away}`,
      edge: eloDiff > 0 ? `+${eloDiff} ${homeClub.short} advantage` : eloDiff < 0 ? `+${Math.abs(eloDiff)} ${awayClub.short} advantage` : "Evenly matched",
      edgeColor: eloDiff > 0 ? "up" : eloDiff < 0 ? "warn" : "neutral",
    },
    {
      label: "Expected goals (λ)",
      value: `${homeClub.short} ${lambdas.home.toFixed(2)} · ${awayClub.short} ${lambdas.away.toFixed(2)}`,
      edge: lambdaDiff > 0 ? `+${lambdaDiff.toFixed(2)} ${homeClub.short} xG` : lambdaDiff < 0 ? `+${(-lambdaDiff).toFixed(2)} ${awayClub.short} xG` : "Even",
      edgeColor: lambdaDiff > 0 ? "up" : lambdaDiff < 0 ? "warn" : "neutral",
    },
    {
      label: "Market signal",
      value: kalshiHomePct !== undefined ? `Kalshi ${kalshiHomePct}% · Model ${modelHomePct}%` : `Model ${modelHomePct}% · No market data`,
      edge: marketDev !== null
        ? marketDev > 0
          ? `+${marketDev}pp model above market`
          : marketDev < 0
            ? `${marketDev}pp model below market`
            : "Model matches market"
        : "No Kalshi market",
      edgeColor: marketDev !== null && Math.abs(marketDev) > 5 ? "warn" : "neutral",
    },
  ];

  const secondaryDrivers: Array<{ label: string; value: string; edge: string; edgeColor: "up" | "warn" | "neutral" }> = [
    {
      label: "Venue",
      value: neutral ? "Neutral venue" : `${homeClub.venue} (home)`,
      edge: neutral ? "No home advantage applied" : "+100 Elo home advantage",
      edgeColor: "neutral",
    },
    {
      label: "Form (last 5)",
      value: `${homeClub.short} ${formSummary(form.home)} · ${awayClub.short} ${formSummary(form.away)}`,
      edge: "Factored into λ weights",
      edgeColor: "neutral",
    },
    {
      label: "Pattern flag",
      value: "Draw underestimation risk",
      edge: "Draw may be underweighted — +10pp vs historical",
      edgeColor: "warn",
    },
  ];

  return (
    <div>
      <div className="text-tiny font-semibold uppercase tracking-widest text-[var(--ink-faint)] mb-2.5">
        Forecast drivers
      </div>
      <div className="grid grid-cols-3 gap-px rounded-sm overflow-hidden mb-px">
        {primaryDrivers.map((d) => (
          <DriverCell key={d.label} {...d} />
        ))}
      </div>
      <div className="grid grid-cols-3 gap-px rounded-sm overflow-hidden">
        {secondaryDrivers.map((d) => (
          <DriverCell key={d.label} {...d} />
        ))}
      </div>
    </div>
  );
}
