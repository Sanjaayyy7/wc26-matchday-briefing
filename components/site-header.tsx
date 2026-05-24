import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-[var(--hairline)] backdrop-blur-md">
      <div className="absolute inset-0 -z-10 bg-[color:var(--canvas)]/75" />
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link href="/" className="font-display text-xl tracking-tight">
          Matchday Briefing
        </Link>
        <div className="flex items-center gap-3">
          <span className="font-mono text-[11px] uppercase tracking-[0.2em] text-[var(--ink-muted)]">
            MD-38 · 24 May 2026
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
