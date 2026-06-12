"use client";

import { useTheme } from "next-themes";
import { Moon, Sun } from "lucide-react";

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  return (
    <button
      type="button"
      aria-label="Toggle theme"
      onClick={() => setTheme(resolvedTheme === "dark" ? "light" : "dark")}
      className="grid h-9 w-9 place-items-center rounded-full text-[var(--ink-muted)] transition-colors duration-300 hover:bg-[var(--neutral-fill)] hover:text-[var(--ink)]"
    >
      {/* Theme class lands before paint (next-themes script), so CSS picks the icon — no mounted-state dance. */}
      <Sun className="hidden h-4 w-4 dark:block" />
      <Moon className="h-4 w-4 dark:hidden" />
    </button>
  );
}
