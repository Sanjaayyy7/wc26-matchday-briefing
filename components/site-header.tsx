import Link from "next/link";
import { ThemeToggle } from "./theme-toggle";

export function SiteHeader() {
  return (
    <header className="sticky top-3 z-50 px-4">
      <div className="mx-auto flex max-w-6xl items-center justify-between rounded-full border border-[var(--hairline)] bg-[var(--glass)] px-5 py-2.5 backdrop-blur-[10px] backdrop-saturate-150">
        <Link href="/" className="text-[15px] font-semibold tracking-[-0.01em]">
          Matchday Briefing
        </Link>
        <div className="flex items-center gap-4">
          <span className="text-caption hidden sm:block">
            World Cup 2026 · Opening window
          </span>
          <ThemeToggle />
        </div>
      </div>
    </header>
  );
}
