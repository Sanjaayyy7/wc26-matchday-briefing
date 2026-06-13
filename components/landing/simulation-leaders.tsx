import Link from "next/link";
import { Crest } from "@/components/crest";
import { NumberTicker } from "@/components/number-ticker";
import type { Club } from "@/lib/data";

export function SimulationLeaders({
  leaders,
}: {
  leaders: Array<{ club: Club; champion: number; final: number }>;
}) {
  return (
    <div className="grid gap-3 md:grid-cols-2">
      {leaders.map(({ club, champion, final }, index) => (
        <Link
          key={club.id}
          href={`/team/${club.id}`}
          className="grid grid-cols-[auto_1fr_auto] items-center gap-4 rounded-2xl bg-[var(--surface)] p-4 transition-colors duration-300 hover:bg-[var(--elevated)] dark:border dark:border-[var(--hairline)]"
        >
          <span className="text-caption tabular w-6">{index + 1}</span>
          <div className="flex min-w-0 items-center gap-3">
            <Crest
              short={club.short}
              primary={club.primary}
              secondary={club.secondary}
              name={club.name}
              size={40}
            />
            <span className="text-title truncate">{club.name}</span>
          </div>
          <div className="text-right">
            <NumberTicker
              value={champion * 100}
              suffix="%"
              decimals={1}
              className="text-title text-[var(--up)]"
            />
            <p className="text-caption tabular">
              final <NumberTicker value={final * 100} suffix="%" decimals={1} />
            </p>
          </div>
        </Link>
      ))}
    </div>
  );
}
