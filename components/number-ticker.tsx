/**
 * Renders a formatted numeric value, server-side and statically.
 *
 * Previously this rolled up from 0 via a framer-motion spring, which meant the
 * server-rendered / no-JS / first-paint HTML showed "0" until hydration — bad
 * for SEO and credibility, and it misreads as broken data (a "0/0 correct
 * picks" hero before JS loads). The count-up communicated no state, so per the
 * institutional design ethos it is dropped in favour of the real value on first
 * paint. API is unchanged so every call site keeps working.
 */
export function NumberTicker({
  value,
  suffix = "",
  decimals = 0,
  className,
}: {
  value: number;
  suffix?: string;
  decimals?: number;
  className?: string;
}) {
  return (
    <span className={`tabular ${className ?? ""}`}>
      {value.toFixed(decimals)}
      {suffix}
    </span>
  );
}
