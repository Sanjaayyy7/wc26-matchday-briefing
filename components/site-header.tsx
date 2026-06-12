import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-3 z-50 px-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border border-[var(--hairline)] bg-[var(--glass)] px-5 py-2.5 backdrop-blur-[10px] backdrop-saturate-150">
        <Link href="/" className="shrink-0 text-[15px] font-semibold tracking-[-0.01em]">
          Matchday Briefing
        </Link>
        <nav className="flex items-center gap-1 overflow-x-auto text-[13px] font-medium text-[var(--ink-muted)]">
          {[
            ["Matches", "/matches"],
            ["Groups", "/groups"],
            ["Teams", "/teams"],
            ["Record", "/record"],
            ["Simulator", "/simulator"],
          ].map(([label, href]) => (
            <Link
              key={href}
              href={href}
              className="shrink-0 rounded-full px-3 py-1.5 transition-colors duration-300 hover:bg-[var(--neutral-fill)] hover:text-[var(--ink)]"
            >
              {label}
            </Link>
          ))}
        </nav>
        <ThemeToggle />
      </div>
    </header>
  );
}
