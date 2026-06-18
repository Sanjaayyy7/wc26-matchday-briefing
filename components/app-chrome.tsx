import Link from "next/link";
import {
  Activity,
  BarChart3,
  CalendarDays,
  ShieldCheck,
  Table2,
  Trophy,
  Users,
} from "lucide-react";
import { ThemeToggle } from "./theme-toggle";

const NAV = [
  { label: "Matches", href: "/matches", icon: CalendarDays },
  { label: "Groups", href: "/groups", icon: Table2 },
  { label: "Teams", href: "/teams", icon: Users },
  { label: "Record", href: "/record", icon: ShieldCheck },
  { label: "Simulator", href: "/simulator", icon: BarChart3 },
  { label: "Players", href: "/players", icon: Trophy },
  { label: "Sentiment", href: "/sentiment", icon: Activity },
] as const;

export function AppChrome({
  children,
  route,
  eyebrow = "World Cup 2026",
  title,
  rail,
}: {
  children: React.ReactNode;
  route: string;
  eyebrow?: string;
  title?: string;
  rail?: React.ReactNode;
}) {
  return (
    <div className="relative min-h-screen pb-24 md:pb-0">
      <CinematicBackdrop />
      <header className="sticky top-0 z-50">
        <div className="glass-rail mx-auto flex max-w-7xl items-center gap-4 px-6 py-4">
          <Link href="/" className="flex min-w-0 items-center gap-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-[var(--line)] text-[var(--stage-final)]">
              <Trophy className="h-4 w-4" />
            </span>
            <span className="min-w-0">
              <span className="text-caption block">Matchday Briefing</span>
              <span className="text-title chroma-text block truncate">Tournament command</span>
            </span>
          </Link>

          <nav className="hidden flex-1 items-center justify-center gap-1 md:flex">
            {NAV.map(({ label, href }) => {
              const active = route === label.toLowerCase();
              return (
                <Link
                  key={href}
                  href={href}
                  className={`border-b px-3 py-2 text-sm transition-colors duration-300 ${
                    active
                      ? "border-[var(--stage-final)] text-[var(--ink)]"
                      : "border-transparent text-[var(--ink-muted)] hover:border-[var(--line)] hover:text-[var(--ink)]"
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto hidden items-center gap-3 md:flex">
            <span className="text-caption inline-flex items-center gap-2 border-l border-[var(--line)] pl-3">
              <Activity className="h-3.5 w-3.5 text-[var(--up)]" />
              Local model
            </span>
            <ThemeToggle />
          </div>
          <div className="ml-auto md:hidden">
            <ThemeToggle />
          </div>
        </div>
      </header>

      {(title || rail) && (
        <div className="mx-auto max-w-7xl px-6 pt-10">
          <div className="grid gap-6 border-b border-[var(--line)] pb-8 lg:grid-cols-[1fr_auto] lg:items-end">
            <div>
              <p className="text-label">{eyebrow}</p>
              {title && <h1 className="text-display mt-3 text-5xl md:text-7xl">{title}</h1>}
              {title && <div className="chroma-rule mt-5 h-px w-40" />}
            </div>
            {rail && <div className="min-w-0">{rail}</div>}
          </div>
        </div>
      )}

      <main className="mx-auto max-w-7xl px-6 py-10 md:py-14">{children}</main>
      <MobileTabBar route={route} />
    </div>
  );
}

function CinematicBackdrop() {
  return (
    <div aria-hidden className="app-stage">
      <div className="velvet-depth absolute inset-0" />
      <div className="signal-sheen absolute inset-0 opacity-70" />
      <div className="premium-sweep absolute inset-0 opacity-70" />
      <div className="cinema-vignette absolute inset-0" />
    </div>
  );
}

function MobileTabBar({ route }: { route: string }) {
  return (
    <nav className="glass-rail fixed inset-x-0 bottom-0 z-50 grid grid-cols-5 px-2 py-2 md:hidden">
      {NAV.map(({ label, href, icon: Icon }) => {
        const active = route === label.toLowerCase();
        return (
          <Link
            key={href}
            href={href}
            className={`text-caption flex flex-col items-center gap-1 border-t px-2 py-2 transition-colors duration-300 ${
              active
                ? "border-[var(--stage-final)] text-[var(--ink)]"
                : "border-transparent text-[var(--ink-muted)]"
            }`}
          >
            <Icon className="h-4 w-4" />
            {label}
          </Link>
        );
      })}
    </nav>
  );
}
