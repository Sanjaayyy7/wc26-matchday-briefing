import { cn } from "@/lib/utils";
import { flagForShort } from "@/lib/flags";

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
  const flag = flagForShort(short);
  const fontSize = Math.round(size * (flag ? 0.58 : 0.3));
  return (
    <div
      role="img"
      aria-label={`${name} national flag`}
      className={cn(
        "grid place-items-center overflow-hidden rounded-full border border-[var(--hairline)] bg-[var(--canvas)] font-semibold",
        className,
      )}
      style={{
        width: size,
        height: size,
        color: flag ? undefined : secondary ?? "var(--canvas)",
        fontSize,
      }}
    >
      {flag ? (
        <span aria-hidden className="leading-none">
          {flag}
        </span>
      ) : (
        <span
          className="grid h-full w-full place-items-center"
          style={{ background: primary }}
        >
          {short}
        </span>
      )}
    </div>
  );
}
