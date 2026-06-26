import * as React from "react";
import { cn } from "@/lib/utils";

/**
 * Codex device-frame: a panel floats inside a violet gradient bezel.
 * The Codex landing wraps its product screenshots in exactly this motif.
 */
export function ShowcaseFrame({
  className,
  children,
}: {
  className?: string;
  children?: React.ReactNode;
}) {
  return (
    <div className={cn("showcase-frame", className)}>
      <div className="showcase-frame-inner">{children}</div>
    </div>
  );
}
