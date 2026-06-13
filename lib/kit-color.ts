import type { CSSProperties } from "react";
import type { Fixture } from "./data";

/**
 * Kit-adaptive color helpers (design-language.md §2.2-§2.4).
 *
 * SSR + class-based dark mode means the server cannot know which theme the
 * client will render with. Every helper here is theme-agnostic: it either
 * returns a literal hex (only after verifying it is safe in BOTH themes) or
 * a `var(--token)` reference that resolves correctly via the CSS cascade
 * once `.dark` is (or isn't) present on the document.
 */

// ---------------------------------------------------------------------------
// Contrast guard (WCAG 2 relative luminance)
// ---------------------------------------------------------------------------

/** The two canvas colors a kit accent might be drawn against (§2.1). */
const LIGHT_CANVAS = "#f5f5f7";
const DARK_CANVAS = "#0b0b0c";

const MIN_CONTRAST = 3;

function hexToRgb(hex: string): [number, number, number] {
  const normalized = hex.replace("#", "");
  const value =
    normalized.length === 3
      ? normalized
          .split("")
          .map((c) => c + c)
          .join("")
      : normalized;
  const r = parseInt(value.slice(0, 2), 16);
  const g = parseInt(value.slice(2, 4), 16);
  const b = parseInt(value.slice(4, 6), 16);
  return [r, g, b];
}

/** sRGB 8-bit channel -> linear-light channel (WCAG formula). */
function channelToLinear(channel: number): number {
  const c = channel / 255;
  return c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
}

/** WCAG relative luminance of a hex color, 0 (black) - 1 (white). */
function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex);
  return (
    0.2126 * channelToLinear(r) +
    0.7152 * channelToLinear(g) +
    0.0722 * channelToLinear(b)
  );
}

/** WCAG contrast ratio between two hex colors, always >= 1. */
function contrastRatio(hexA: string, hexB: string): number {
  const lA = relativeLuminance(hexA);
  const lB = relativeLuminance(hexB);
  const lighter = Math.max(lA, lB);
  const darker = Math.min(lA, lB);
  return (lighter + 0.05) / (darker + 0.05);
}

// ---------------------------------------------------------------------------
// kitAccent — §2.2
// ---------------------------------------------------------------------------

/**
 * Returns a kit color safe to use as an accent in either theme, or a
 * `var(--up)` / `var(--down)` fallback if the kit color would be too low
 * contrast against either canvas.
 *
 * SSR-safe "both canvases" guard: a kit color is only returned as-is if it
 * clears `MIN_CONTRAST` (3:1) against BOTH the light canvas (#f5f5f7) AND
 * the dark canvas (#0b0b0c). If it fails against either, the fallback
 * (`var(--up)` or `var(--down)`, per `fallback`) is returned instead — these
 * tokens themselves flip safely per theme, so the result is never invisible
 * regardless of which theme actually renders. Most saturated team kits clear
 * both; only near-black or near-white kits fall back, which is exactly the
 * case this guard exists for.
 */
export function kitAccent(kitHex: string, fallback: "up" | "down"): string {
  const clearsLight = contrastRatio(kitHex, LIGHT_CANVAS) >= MIN_CONTRAST;
  const clearsDark = contrastRatio(kitHex, DARK_CANVAS) >= MIN_CONTRAST;

  if (clearsLight && clearsDark) {
    return kitHex;
  }

  return fallback === "up" ? "var(--up)" : "var(--down)";
}

/**
 * Optional helper for the kit-wash inline-style pattern (§2.2):
 *
 *   <div style={kitWashStyle(club.primary)} className="kit-wash">
 *
 * Sets the `--kit` custom property consumed by the `.kit-wash` utility's
 * `color-mix(in oklab, var(--kit, var(--neutral-fill)) ..., var(--canvas))`.
 */
export function kitWashStyle(kitHex: string): CSSProperties {
  return { "--kit": kitHex } as CSSProperties;
}

// ---------------------------------------------------------------------------
// stageVar — §2.3
// ---------------------------------------------------------------------------

type Stage = NonNullable<Fixture["stage"]>;

const STAGE_VAR: Record<Stage, string> = {
  group: "var(--stage-group)",
  "round-of-32": "var(--stage-r32)",
  "round-of-16": "var(--stage-r16)",
  "quarter-final": "var(--stage-qf)",
  "semi-final": "var(--stage-sf)",
  final: "var(--stage-final)",
};

const DEFAULT_STAGE_VAR = STAGE_VAR.group;

/**
 * Returns the CSS var reference for a fixture's stage ramp color (§2.3).
 * Falls back to the group-stage token for unknown/undefined stages so a
 * missing value never renders as missing color.
 */
export function stageVar(stage: Fixture["stage"] | string | undefined): string {
  if (stage && stage in STAGE_VAR) {
    return STAGE_VAR[stage as Stage];
  }
  return DEFAULT_STAGE_VAR;
}

// ---------------------------------------------------------------------------
// verdictVar — §2.4
// ---------------------------------------------------------------------------

export type Verdict = "hit" | "close" | "miss";

const VERDICT_VAR: Record<Verdict, string> = {
  hit: "var(--verdict-hit)",
  close: "var(--verdict-close)",
  miss: "var(--verdict-miss)",
};

/** Returns the CSS var reference for a settled prediction's verdict ramp color (§2.4). */
export function verdictVar(verdict: Verdict): string {
  return VERDICT_VAR[verdict];
}
