import { brierBar } from "@/lib/brier-bar";

export function BrierBar({ brier }: { brier: number }) {
  const { widthPct, colorVar } = brierBar(brier);
  return (
    <span className="inline-block h-0.5 w-16 rounded-full bg-[var(--hairline)] overflow-hidden align-middle">
      <span
        className="block h-full rounded-full"
        style={{ width: `${widthPct}%`, background: colorVar }}
      />
    </span>
  );
}
