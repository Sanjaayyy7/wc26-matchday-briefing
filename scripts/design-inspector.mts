import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

export type DesignViolation = {
  file: string;
  line: number;
  rule: string;
  message: string;
};

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

// ── Codex constitution allowlist (informational) ──────────────────────────
// These class/token names are first-class and intentionally NOT flagged:
//   utilities: gradient-hero, gradient-cta, showcase-frame, showcase-frame-inner,
//              full-bleed
//   tokens:    --gradient-hero, --gradient-cta, --gradient-frame, --accent
// They are plain class names / CSS-resolved tokens (hex lives only in globals.css),
// so tokens-only, elevation, scale-only, and no-background-lines never fire on them.
// The single section accent (chroma-rule) + row-hover edge are violet --accent, not jade.

const FIRST_PARTY_DIRS = ["app", "components", "lib"] as const;
const PAGE_RE = /app(?:\/.+)?\/page\.tsx$/;
// Pages that use an alternative full-screen shell (CommandShell etc.) and are exempt from page-shell checks
const PAGE_SHELL_EXEMPT = new Set(["app/command/page.tsx"]);
const RAW_HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const ARBITRARY_RE =
  /\b(?:text|p|m|mt|mb|ml|mr|mx|my|gap|rounded|border)-\[(?!clamp\()[^\]]*(?:px|rem|%|calc|vh|vw)[^\]]*\]/;
const BAD_DURATION_RE = /\bduration-(?!300\b)\d+\b|duration:\s*(?!0\.3)\d*\.?\d+/;
const BAD_MOTION_RE = /y:\s*8|stiffness:\s*300|damping:\s*30/;
// Elevation: flag raw boxShadow, raw bg literals, and non-token shadow utilities.
// --shadow-hover and --shadow-pop are the two allowed elevation tokens.
// Comment lines (// …) are skipped at the call site so "shadow-" in a comment
// never false-positives here.
const BAD_ELEVATION_RE =
  /\bboxShadow\b|\bbg-(?:white|black|gray|slate|zinc)-?\b|(?<!--)(?<!hover:)\bshadow-(?!\[var\(--shadow-(?:hover|pop)\)\])/;
// Radius-token: route pages must use rounded-[var(--radius-card)] for large radii.
const RADIUS_TOKEN_RE = /\brounded-(?:2xl|3xl|4xl)\b/;
const NUMERIC_TEXT_RE = /\b(?:score|pct|prob|rating|elo|brier|rps|count|total|goals|locks|odds)\b/i;
const OLD_PRIMARY_PRIMITIVE_RE = /export function CommandPanel|export function CinematicSection|export function MarketTape|export function FixtureSurface|export function MatchMarketRow|export function DataRail/;
const AD_HOC_ROUTE_SPACE_RE = /className=["'][^"']*\bspace-y-16\b|style=\{\{\s*animationDelay:/;
const BACKGROUND_LINE_RE = /field-mesh|stadium-frame|hero-field|repeating-linear-gradient/;

function walk(dir: string, files: string[] = []): string[] {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    const rel = relative(ROOT, full);
    if (
      rel.includes("node_modules") ||
      rel.includes(".next") ||
      rel.startsWith("components/ui/")
    ) {
      continue;
    }
    if (statSync(full).isDirectory()) {
      walk(full, files);
    } else if (/\.(tsx|ts|css)$/.test(entry)) {
      files.push(full);
    }
  }
  return files;
}

function lineNumber(text: string, index: number): number {
  return text.slice(0, index).split("\n").length;
}

function pushMatches(
  violations: DesignViolation[],
  rel: string,
  text: string,
  regex: RegExp,
  rule: string,
  message: string,
) {
  const flags = regex.flags.includes("g") ? regex.flags : `${regex.flags}g`;
  const re = new RegExp(regex.source, flags);
  for (const match of text.matchAll(re)) {
    violations.push({
      file: rel,
      line: lineNumber(text, match.index ?? 0),
      rule,
      message,
    });
  }
}

export function inspectProject(root = ROOT): DesignViolation[] {
  const violations: DesignViolation[] = [];
  const files = FIRST_PARTY_DIRS.flatMap((dir) => {
    const full = join(root, dir);
    return existsSync(full) ? walk(full) : [];
  });

  for (const file of files) {
    const rel = relative(root, file);
    const text = readFileSync(file, "utf8");
    const isCss = rel.endsWith(".css");
    const isKitColor = rel === "lib/kit-color.ts";
    const isTsxOrTs = /\.(tsx|ts)$/.test(rel);

    if (isTsxOrTs && !isKitColor) {
      pushMatches(
        violations,
        rel,
        text,
        RAW_HEX_RE,
        "tokens-only",
        "Raw hex colors are only allowed in globals.css, data, or lib/kit-color.ts.",
      );
    }

    if (!isCss) {
      pushMatches(
        violations,
        rel,
        text,
        ARBITRARY_RE,
        "scale-only",
        "Avoid arbitrary pixel/rem/percent utilities; use tokens or Tailwind scale values.",
      );
      pushMatches(
        violations,
        rel,
        text,
        BAD_DURATION_RE,
        "motion-tokens",
        "Transitions should use duration-300 or var(--dur)/0.3s.",
      );
      pushMatches(
        violations,
        rel,
        text,
        BAD_MOTION_RE,
        "motion-pattern",
        "Entrance motion should use y: 4 with 0.3s timing; value springs are reserved for data animation.",
      );
      // Scan line-by-line for elevation violations.
      // Skip pure comment lines so "shadow-" in a // comment never false-positives.
      text.split("\n").forEach((line, idx) => {
        if (line.trimStart().startsWith("//")) return;
        if (BAD_ELEVATION_RE.test(line)) {
          violations.push({
            file: rel,
            line: idx + 1,
            rule: "elevation",
            message:
              "Use surface/elevated tokens and the --shadow-hover or --shadow-pop token.",
          });
        }
      });
    }

    if (BACKGROUND_LINE_RE.test(text)) {
      violations.push({
        file: rel,
        line: lineNumber(text, text.search(BACKGROUND_LINE_RE)),
        rule: "no-background-lines",
        message: "Do not use visible background grids, field meshes, stadium rails, or repeating line gradients.",
      });
    }

    if (PAGE_RE.test(rel) && !PAGE_SHELL_EXEMPT.has(rel)) {
      if (!text.includes("<RouteStack")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "page-shell",
          message: "Page shell is missing <RouteStack.",
        });
      }
      if (!text.includes("<WCS26Shell")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "page-shell",
          message: "Page must use WCS26Shell as its shell.",
        });
      }
      if (!text.includes("<CanvasSection")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "section-system",
          message: "Route pages must use CanvasSection for primary section rhythm.",
        });
      }
      if (AD_HOC_ROUTE_SPACE_RE.test(text)) {
        violations.push({
          file: rel,
          line: lineNumber(text, text.search(AD_HOC_ROUTE_SPACE_RE)),
          rule: "route-rhythm",
          message: "Route pages must use RouteStack and shared section rhythm instead of ad hoc spacing or delayed sections.",
        });
      }
      if (text.includes("<SiteHeader")) {
        violations.push({
          file: rel,
          line: 1,
          rule: "page-shell",
          message: "Pages must use WCS26Shell; SiteHeader is no longer the primary shell.",
        });
      }
      // Surface cards with rounded-[var(--radius-card)] are ALLOWED.
      // Raw large radius utilities on route pages are NOT — use the token.
      pushMatches(
        violations,
        rel,
        text,
        RADIUS_TOKEN_RE,
        "radius-token",
        "Route pages must use rounded-[var(--radius-card)] instead of raw large-radius utilities (rounded-2xl/3xl/4xl).",
      );
      const sectionCount = (text.match(/<section\b/g) ?? []).length;
      const labelCount =
        (text.match(/<h2 className="text-label/g) ?? []).length +
        (text.match(/<CanvasSection\b/g) ?? []).length;
      if (sectionCount > 1 && labelCount < sectionCount - 1) {
        violations.push({
          file: rel,
          line: 1,
          rule: "section-labels",
          message: "Top-level sections after the hero need text-label headings.",
        });
      }
    }

    if (rel === "components/cinematic.tsx" && OLD_PRIMARY_PRIMITIVE_RE.test(text)) {
      violations.push({
        file: rel,
        line: lineNumber(text, text.search(OLD_PRIMARY_PRIMITIVE_RE)),
        rule: "no-box-primitives",
        message: "Retired boxed primitives must not be exported from the primary cinematic system.",
      });
    }

    if (rel === "components/cinematic.tsx") {
      for (const required of ["route-stack", "route-section", "section-heading", "data-plane"]) {
        if (!text.includes(required)) {
          violations.push({
            file: rel,
            line: 1,
            rule: "layout-primitives",
            message: `Primary cinematic layout is missing the ${required} hook.`,
          });
        }
      }
    }

    if (rel === "app/groups/page.tsx") {
      const dataPlaneCount = (text.match(/<DataPlane\b/g) ?? []).length;
      if (dataPlaneCount !== 1) {
        violations.push({
          file: rel,
          line: 1,
          rule: "groups-board",
          message: "Groups must render as one continuous executive standings board, not one DataPlane per group.",
        });
      }
    }

    if (rel.endsWith(".tsx")) {
      const lines = text.split("\n");
      lines.forEach((line, idx) => {
        if (
          line.includes("<") &&
          NUMERIC_TEXT_RE.test(line) &&
          /\{[^}]*\d|\.toFixed|\.toLocaleString|Math\.round/.test(line) &&
          !line.includes("tabular") &&
          !line.includes("NumberTicker") &&
          !line.includes("<Stat") &&
          !line.includes("`")
        ) {
          violations.push({
            file: rel,
            line: idx + 1,
            rule: "tabular-numbers",
            message: "Numeric display should use NumberTicker or tabular.",
          });
        }
      });
    }
  }

  return violations;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const violations = inspectProject();
  if (violations.length > 0) {
    console.error("Design inspector found violations:\n");
    for (const v of violations) {
      console.error(`${v.file}:${v.line} [${v.rule}] ${v.message}`);
    }
    process.exit(1);
  }
  console.log("Design inspector passed.");
}
