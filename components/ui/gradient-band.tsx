import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Full-bleed cinematic gradient band — the Codex bookend.
 * `hero` opens the page; `cta` closes it. Content should provide its own
 * centered max-width wrapper; the band spans the full viewport width.
 */
export function GradientBand({
  variant,
  className,
  children,
}: {
  variant: "hero" | "cta";
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <section
      className={cn(
        "full-bleed relative isolate overflow-hidden",
        variant === "hero" ? "gradient-hero" : "gradient-cta",
        className,
      )}
    >
      {children}
    </section>
  );
}
