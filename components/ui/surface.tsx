import * as React from "react";
import { cn } from "@/lib/utils";

interface SurfaceProps {
  as?: React.ElementType;
  interactive?: boolean;
  className?: string;
  children?: React.ReactNode;
}

export function Surface({
  as: Tag = "div",
  interactive,
  className,
  children,
}: SurfaceProps) {
  return React.createElement(
    Tag,
    {
      className: cn(
        "bg-[var(--surface)] border border-[var(--hairline)] rounded-[var(--radius-card)]",
        interactive && "interactive",
        className,
      ),
    },
    children,
  );
}
