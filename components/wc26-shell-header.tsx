import Link from "next/link";
import type { SystemHealth } from "@/lib/command-data";

export type NavItem = { label: string; href: string; routeKey: string };

export const WC26_NAV: NavItem[] = [
  { label: "Ledger", href: "/", routeKey: "home" },
  { label: "Matches", href: "/matches", routeKey: "matches" },
  { label: "Record", href: "/record", routeKey: "record" },
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
    <>
      {/* Nav */}
      <nav className="flex-shrink-0 border-b border-[var(--line)] bg-[var(--canvas)]">
        <div className="flex h-12 items-center px-6 gap-0">
          <Link href="/" className="flex-shrink-0 text-label font-bold tracking-tight pr-5 border-r border-[var(--line)]">
            WC<span className="text-[var(--up)]">26</span>
          </Link>
          <div className="flex flex-1">
            {WC26_NAV.map((tab) => {
              const active = tab.routeKey === route;
              return (
                <Link
                  key={tab.href}
                  href={tab.href}
                  className={[
                    "flex h-12 items-center px-4 text-xs font-medium border-r border-[var(--hairline)] transition-colors duration-300",
                    active
                      ? "text-[var(--ink)] border-b-2 border-b-[var(--up)]"
                      : "text-[var(--ink-faint)] hover:text-[var(--ink-muted)]",
                  ].join(" ")}
                >
                  {tab.label}
                </Link>
              );
            })}
          </div>
          <div className="flex items-center gap-2 pl-4 border-l border-[var(--hairline)] text-slight">
            <span className="inline-block h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dotColor }} />
            <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
            <span className="text-[var(--ink-faint)]">· {systemHealth.graded} graded · 48 nations</span>
          </div>
        </div>
      </nav>

      {/* Status rail */}
      <div className="flex-shrink-0 flex h-8 items-center border-b border-[var(--hairline)] bg-[var(--canvas)] px-6 gap-0 text-fine">
        <div className="flex items-center gap-1.5 pr-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span className="data-mono tabular">{systemHealth.graded} of {systemHealth.total}</span>
          <span className="font-semibold text-[var(--ink-muted)]">graded</span>
        </div>
        <div className="flex items-center gap-1.5 px-4 border-r border-[var(--hairline)] text-[var(--ink-faint)]">
          <span>Calibration</span>
          <span className={`font-semibold ${textCls}`}>{systemHealth.status}</span>
        </div>
        <div className="flex items-center gap-1.5 px-4 text-[var(--ink-faint)]">
          <span>ECE</span>
          <span className={`font-semibold data-mono tabular ${textCls}`}>{(systemHealth.ece * 100).toFixed(1)}%</span>
        </div>
        {extra}
      </div>
    </>
  );
}
