"use client";

import dynamic from "next/dynamic";
import { useSyncExternalStore } from "react";

// Client-only — `ssr:false` is permitted because this wrapper is a Client
// Component. The R3F bundle never ships to the server render.
const AuroraField = dynamic(() => import("./aurora-field").then((m) => m.AuroraField), {
  ssr: false,
  loading: () => null,
});

const REDUCED_QUERY = "(prefers-reduced-motion: reduce)";

/** Reactive prefers-reduced-motion via an external store (SSR snapshot = no
 *  reduction; lint-clean, no setState-in-effect). */
function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(
    (onChange) => {
      const mq = window.matchMedia(REDUCED_QUERY);
      mq.addEventListener("change", onChange);
      return () => mq.removeEventListener("change", onChange);
    },
    () => window.matchMedia(REDUCED_QUERY).matches,
    () => false,
  );
}

/** Faint full-bleed signature backdrop. Honors prefers-reduced-motion by
 *  rendering nothing (the hero is then pure jet black). */
export function AuroraFieldMount({ className = "" }: { className?: string }) {
  if (usePrefersReducedMotion()) return null;

  return (
    <div aria-hidden className={`pointer-events-none absolute inset-0 ${className}`}>
      <AuroraField />
    </div>
  );
}
