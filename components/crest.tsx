import { cn } from "@/lib/utils";

export function Crest({
  short,
  primary,
  secondary,
  name,
  size = 56,
  className,
}: {
  short: string;
  primary: string;
  secondary?: string;
  name: string;
  size?: number;
  className?: string;
}) {
  const fontSize = Math.round(size * 0.3);
  return (
    <div
      role="img"
      aria-label={`${name} crest`}
      className={cn(
        "grid place-items-center rounded-full border border-[var(--hairline)] font-semibold tracking-[-0.01em]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: primary,
        color: secondary ?? "#ffffff",
        fontSize,
      }}
    >
      {short}
    </div>
  );
}
