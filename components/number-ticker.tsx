"use client";

import { useEffect } from "react";
import { motion, useReducedMotion, useSpring, useTransform } from "framer-motion";

/** Robinhood-style odometer: the number rolls to its target on mount/change. */
export function NumberTicker({
  value,
  suffix = "",
  className,
}: {
  value: number;
  suffix?: string;
  className?: string;
}) {
  const reduceMotion = useReducedMotion();
  const spring = useSpring(0, { stiffness: 80, damping: 24 });
  const display = useTransform(spring, (v) => `${Math.round(v)}${suffix}`);

  useEffect(() => {
    spring.set(value);
  }, [value, spring]);

  if (reduceMotion) {
    return (
      <span className={`tabular ${className ?? ""}`}>
        {Math.round(value)}
        {suffix}
      </span>
    );
  }
  return <motion.span className={`tabular ${className ?? ""}`}>{display}</motion.span>;
}
