import { brierBar, BRIER_BASELINE_PCT } from "@/lib/brier-bar";

export function BrierBar({ brier }: { brier: number }) {
  const { widthPct, colorVar } = brierBar(brier);
  return (
    <span className="relative inline-block h-1 w-16 rounded-full bg-[var(--hairline)] align-middle">
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${widthPct}%`, background: colorVar }}
      />
      {/* chance baseline (Brier 0.667) — fills left of it beat chance */}
      <span
        className="absolute inset-y-0 w-px bg-[var(--ink-faint)]"
        style={{ left: `${BRIER_BASELINE_PCT}%` }}
      />
    </span>
  );
}
