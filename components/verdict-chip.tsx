import { verdictVar, type Verdict } from "@/lib/kit-color";
import { verdictDisplay } from "@/lib/verdict-display";

export function VerdictChip({ verdict }: { verdict: Verdict }) {
  const { label, icon } = verdictDisplay(verdict);
  const color = verdictVar(verdict);
  return (
    <span
      className="text-label inline-flex items-center gap-1 rounded-sm px-2 py-0.5"
      style={{
        color,
        background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
      }}
    >
      {icon} {label}
    </span>
  );
}
