import Link from "next/link";
import GlassHeader from "./glass-header";
import type { SystemHealth } from "@/lib/command-data";

export type NavItem = { label: string; href: string; routeKey: string };

export const WC26_NAV: NavItem[] = [
  { label: "Ledger", href: "/", routeKey: "home" },
  { label: "Forecasts", href: "/matches", routeKey: "matches" },
  { label: "Command", href: "/command", routeKey: "command" },
  { label: "Teams", href: "/teams", routeKey: "teams" },
  { label: "Simulate", href: "/simulator", routeKey: "simulator" },
  { label: "Parlays", href: "/parlay", routeKey: "parlay" },
  { label: "Methodology", href: "/methodology", routeKey: "methodology" },
];

function statusDot(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "var(--up)";
  if (status === "WARNING") return "var(--warn)";
  return "var(--down)";
}
function statusTextCls(status: SystemHealth["status"]) {
  if (status === "NOMINAL") return "text-[var(--up)]";
  if (status === "WARNING") return "text-[var(--warn)]";
  return "text-[var(--down)]";
}

export function WC26ShellHeader({
  route,
  systemHealth,
  extra,
}: {
  route: string;
  systemHealth: SystemHealth;
  extra?: React.ReactNode;
}) {
  const dotColor = statusDot(systemHealth.status);
  const textCls = statusTextCls(systemHealth.status);

  return (
    <GlassHeader className="bg-[color-mix(in_oklab,var(--canvas)_72%,transparent)] border-[var(--hairline)]">
      <nav className="mx-auto flex h-14 w-full max-w-7xl items-center gap-6 px-6">
        <Link href="/" className="shrink-0 text-label font-bold tracking-tight text-[var(--ink)]">
          WC<span className="text-[var(--accent)]">26</span>
        </Link>
        <div className="hidden flex-1 items-center justify-center gap-7 md:flex">
          {WC26_NAV.map((tab) => {
            const active = tab.routeKey === route;
            return (
              <Link
                key={tab.href}
                href={tab.href}
                className={[
                  "ix-link text-label",
                  active ? "text-[var(--ink)]" : "text-[var(--ink-muted)]",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            );
          })}
        </div>
        {extra && <div className="hidden items-center gap-2 lg:flex">{extra}</div>}
        <div className="ml-auto flex shrink-0 items-center gap-3 md:ml-0">
          <span className="ix-chip inline-flex items-center gap-1.5 rounded-[var(--radius-pill)] px-3 py-1 text-fine">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
          </span>
          <Link
            href="/matches"
            className="hidden rounded-[var(--radius-pill)] bg-[var(--ink)] px-4 py-1.5 text-label font-semibold text-[var(--canvas)] transition-opacity duration-300 hover:opacity-90 sm:inline-block"
          >
            Today&apos;s slate →
          </Link>
        </div>
      </nav>
    </GlassHeader>
  );
}
