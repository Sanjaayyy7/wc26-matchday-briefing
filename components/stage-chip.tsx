import { stageVar } from "@/lib/kit-color";
import type { Fixture } from "@/lib/data";

const STAGE_LABELS: Record<NonNullable<Fixture["stage"]>, string> = {
  group: "Group",
  "round-of-32": "R32",
  "round-of-16": "R16",
  "quarter-final": "QF",
  "semi-final": "SF",
  final: "Final",
};

export function StageChip({ stage }: { stage: Fixture["stage"] | string | undefined }) {
  const color = stageVar(stage);
  const label =
    stage && stage in STAGE_LABELS
      ? STAGE_LABELS[stage as NonNullable<Fixture["stage"]>]
      : STAGE_LABELS.group;
  return (
    <span
      className="text-label inline-flex items-center rounded-sm border px-2 py-0.5"
      style={{
        color,
        borderColor: `color-mix(in oklab, ${color} 48%, transparent)`,
        background: `color-mix(in oklab, ${color} 16%, var(--surface))`,
      }}
    >
      {label}
    </span>
  );
}
