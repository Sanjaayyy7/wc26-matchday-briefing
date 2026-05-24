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
  const fontSize = Math.round(size * 0.36);
  return (
    <div
      role="img"
      aria-label={`${name} crest`}
      className={cn(
        "grid place-items-center rounded-full font-display font-semibold tracking-tight",
        "shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_1px_10px_rgba(0,0,0,0.35)]",
        className,
      )}
      style={{
        width: size,
        height: size,
        background: primary,
        color: secondary ?? "#ffffff",
        border: "1px solid rgba(255,255,255,0.08)",
        fontSize,
        letterSpacing: "0.02em",
      }}
    >
      {short}
    </div>
  );
}
