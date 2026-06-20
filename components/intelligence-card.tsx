const ACCENT_BORDER: Record<"up" | "warn" | "down", string> = {
  up: "var(--up)",
  warn: "var(--warn)",
  down: "var(--down)",
};

export function IntelligenceCard({
  category,
  children,
  accent,
}: {
  category: string;
  children: React.ReactNode;
  accent?: "up" | "warn" | "down";
}) {
  return (
    <div
      className="flex flex-col gap-2 p-4 bg-[var(--surface)] border-b border-[var(--line)]"
      style={accent ? { borderBottomColor: ACCENT_BORDER[accent], borderBottomWidth: 2 } : undefined}
    >
      <span className="text-micro uppercase tracking-widest text-[var(--ink-faint)]">
        {category}
      </span>
      <p className="text-body">{children}</p>
    </div>
  );
}
