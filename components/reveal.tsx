"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Scroll choreography: fades + rises its children the first time they enter the
 * viewport. SSR-safe — content renders visible by default, so it is never hidden
 * without JS and never flashes. Only elements that start below the fold are
 * armed (hidden while off-screen, revealed on scroll-in); anything already in
 * view, or under prefers-reduced-motion, stays shown. One quiet, deliberate
 * motion — not twenty random micro-interactions.
 */
export function Reveal({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Only arm elements that are below the fold; in-view content stays shown.
    if (el.getBoundingClientRect().top < window.innerHeight * 0.9) return;

    setShown(false);
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setShown(true);
          io.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <div ref={ref} data-reveal={shown ? "in" : "out"} className={className}>
      {children}
    </div>
  );
}
