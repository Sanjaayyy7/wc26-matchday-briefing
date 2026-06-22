"use client";

import dynamic from "next/dynamic";
import type { GlobeNation } from "@/lib/wc26-globe-data";

/** Static stand-in shown while the 3D bundle loads — no blank flash. */
function GlobeFallback() {
  return (
    <div className="absolute inset-0 grid place-items-center" aria-hidden>
      <div
        className="h-[78%] aspect-square rounded-full border border-[var(--hairline)]"
        style={{
          background:
            "radial-gradient(38% 34% at 36% 30%, color-mix(in oklab, var(--ink) 6%, transparent), transparent 60%), radial-gradient(120% 120% at 70% 72%, var(--elevated), var(--canvas) 80%)",
        }}
      />
    </div>
  );
}

/** Client-only globe — `ssr:false` is permitted because this wrapper is a Client Component. */
const WC26Globe = dynamic(() => import("./wc26-globe").then((m) => m.WC26Globe), {
  ssr: false,
  loading: () => <GlobeFallback />,
});

export function WC26GlobeMount({ nations }: { nations: GlobeNation[] }) {
  return <WC26Globe nations={nations} />;
}
