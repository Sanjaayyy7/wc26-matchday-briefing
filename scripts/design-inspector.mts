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

const FIRST_PARTY_DIRS = ["app", "components", "lib"] as const;
const PAGE_RE = /app(?:\/.+)?\/page\.tsx$/;
const RAW_HEX_RE = /#[0-9a-fA-F]{3,8}\b/;
const ARBITRARY_RE =
  /\b(?:text|min-w|max-w|w|h|p|m|mt|mb|ml|mr|mx|my|gap|top|right|bottom|left|rounded|border)-\[(?!clamp\()[^\]]*(?:px|rem|%|calc|vh|vw)[^\]]*\]/;
const BAD_DURATION_RE = /\bduration-(?!300\b)\d+\b|duration:\s*(?!0\.3)\d*\.?\d+/;
const BAD_MOTION_RE = /y:\s*8|stiffness:\s*300|damping:\s*30/;
const BAD_ELEVATION_RE = /\bboxShadow\b|\bbg-(?:white|black|gray|slate|zinc)-?\b|(?<!hover:)\bshadow-(?!\[var\(--shadow-hover\)\])/;
const NUMERIC_TEXT_RE = /\b(?:score|pct|prob|rating|elo|brier|rps|count|total|goals|locks|odds)\b/i;

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
      text.split("\n").forEach((line, idx) => {
        if (line.includes("shadow-[var(--shadow-hover)]")) return;
        if (BAD_ELEVATION_RE.test(line)) {
          violations.push({
            file: rel,
            line: idx + 1,
            rule: "elevation",
            message: "Use surface/elevated tokens and the single --shadow-hover token.",
          });
        }
      });
    }

    if (PAGE_RE.test(rel)) {
      for (const required of ["<SiteHeader", "max-w-6xl", "px-6", "space-y-16"]) {
        if (!text.includes(required)) {
          violations.push({
            file: rel,
            line: 1,
            rule: "page-shell",
            message: `Page shell is missing ${required}.`,
          });
        }
      }
      const sectionCount = (text.match(/<section\b/g) ?? []).length;
      const labelCount = (text.match(/<h2 className="text-label/g) ?? []).length;
      if (sectionCount > 1 && labelCount < sectionCount - 1) {
        violations.push({
          file: rel,
          line: 1,
          rule: "section-labels",
          message: "Top-level sections after the hero need text-label headings.",
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
