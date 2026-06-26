import * as React from "react";
import { cn } from "@/lib/utils";

interface HeroProps {
  eyebrow?: string;
  className?: string;
  children?: React.ReactNode;
}

export default function Hero({ eyebrow, className, children }: HeroProps) {
  return (
    <section className={cn("hero-glow relative", className)}>
      {eyebrow && (
        <p className="text-label mb-4">{eyebrow}</p>
      )}
      <div className="text-hero">{children}</div>
    </section>
  );
}
