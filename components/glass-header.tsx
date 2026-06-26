import * as React from "react";
import { cn } from "@/lib/utils";

interface GlassHeaderProps {
  className?: string;
  children?: React.ReactNode;
}

export default function GlassHeader({ className, children }: GlassHeaderProps) {
  return (
    <header
      className={cn(
        "sticky top-0 z-50 bg-[var(--rail)] backdrop-blur-[var(--blur-glass)] border-b border-[var(--line)]",
        className,
      )}
    >
      {children}
    </header>
  );
}
