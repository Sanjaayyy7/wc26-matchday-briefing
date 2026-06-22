import { WC26ShellHeader } from "./wc26-shell-header";
import { buildSystemHealth } from "@/lib/command-data";
import type { AccountabilityOutput } from "@/lib/accountability";
import type { LockedEntry } from "@/lib/predictions-ledger";
import predictionsData from "@/data/predictions.json";
import accountabilityData from "@/data/backtest/wc26-accountability.json";

const predictions = (predictionsData as { entries: LockedEntry[] }).entries;
const accountability = accountabilityData as AccountabilityOutput;

export function WCS26Shell({
  children,
  route,
  eyebrow = "World Cup 2026",
  title,
  rail,
  fullBleed = false,
}: {
  children: React.ReactNode;
  route: string;
  eyebrow?: string;
  title?: string;
  rail?: React.ReactNode;
  fullBleed?: boolean;
}) {
  const systemHealth = buildSystemHealth(accountability, predictions.length);

  return (
    <div className="relative min-h-screen flex flex-col">
      <WC26ShellHeader route={route} systemHealth={systemHealth} />

      {(title || rail) && (
        <div className="mx-auto w-full max-w-7xl px-6 pt-10">
          <div className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-label">{eyebrow}</p>
              {title && <h1 className="text-hero mt-3">{title}</h1>}
              {title && <div className="mt-5 h-px w-40 bg-[var(--line)]" />}
            </div>
            {rail && <div className="min-w-0">{rail}</div>}
          </div>
        </div>
      )}

      {fullBleed ? (
        <main className="flex-1">{children}</main>
      ) : (
        <main className="mx-auto w-full max-w-7xl px-6 py-10 md:py-14">{children}</main>
      )}
    </div>
  );
}
