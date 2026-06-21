// WC26 Execution-Discipline Inspector
//
// Sibling to design-inspector.mts: that guards DESIGN, this guards WORKFLOW.
// Enforces the WC26 Execution Contract (docs/WC26-EXECUTION-CONTRACT.md) on every run:
// branch discipline, presence of quality gates, and a standing reminder of the
// mandated skill workflow + data-safety rules. Exits non-zero on hard violations.
//
//   npm run inspect:execution
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");

type Level = "FAIL" | "WARN" | "OK";
type Check = { level: Level; rule: string; message: string };

// execFile (no shell) — args passed as an array, never interpolated into a command string.
function git(args: string[]): string {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"] }).trim();
  } catch {
    return "";
  }
}

const checks: Check[] = [];

// ── 1. Branch discipline — never implement on main/master ──────────────────
const branch = git(["rev-parse", "--abbrev-ref", "HEAD"]) || "(unknown)";
const dirty = git(["status", "--porcelain"]) !== "";
if (branch === "main" || branch === "master") {
  checks.push(
    dirty
      ? { level: "FAIL", rule: "branch", message: `Uncommitted changes on '${branch}'. Create a feature branch — never implement on ${branch}.` }
      : { level: "OK", rule: "branch", message: `On ${branch}, clean. Branch before editing.` },
  );
} else {
  checks.push({ level: "OK", rule: "branch", message: `On feature branch '${branch}'.` });
}

// ── 2. Staging hygiene — flag a fully-staged tree (proxy for `git add -A`) ──
const stagedAll = git(["diff", "--cached", "--name-only"]);
if (stagedAll) {
  checks.push({ level: "WARN", rule: "staging", message: `Staged: ${stagedAll.split("\n").length} path(s). Confirm these were added by explicit path, never \`git add -A\`.` });
}

// ── 3. Quality gates present ───────────────────────────────────────────────
let scripts: Record<string, string> = {};
try {
  scripts = (JSON.parse(readFileSync(join(ROOT, "package.json"), "utf8")).scripts ?? {}) as Record<string, string>;
} catch {
  checks.push({ level: "FAIL", rule: "gates", message: "Cannot read package.json." });
}
for (const g of ["build", "test"]) {
  checks.push(
    scripts[g]
      ? { level: "OK", rule: "gates", message: `Gate present: npm run ${g}` }
      : { level: "FAIL", rule: "gates", message: `Missing quality gate: '${g}' script.` },
  );
}
checks.push(
  existsSync(join(ROOT, "scripts/design-inspector.mts"))
    ? { level: "OK", rule: "gates", message: "design-inspector present." }
    : { level: "WARN", rule: "gates", message: "design-inspector.mts not found." },
);

// ── 4. Plan/spec exists for feature work (soft) ────────────────────────────
if (branch !== "main" && branch !== "master" && branch !== "(unknown)") {
  const planDir = join(ROOT, "docs/superpowers/plans");
  const specDir = join(ROOT, "docs/superpowers/specs");
  const count = [planDir, specDir].reduce((n, d) => n + (existsSync(d) ? readdirSync(d).filter((f) => f.endsWith(".md")).length : 0), 0);
  checks.push(
    count > 0
      ? { level: "OK", rule: "plan", message: `${count} plan/spec doc(s) on record. Ensure this branch's work is planned (brainstorming → writing-plans → executing-plans).` }
      : { level: "WARN", rule: "plan", message: "No plan/spec docs found. Route feature work through brainstorming → writing-plans before implementing." },
  );
}

// ── Output ─────────────────────────────────────────────────────────────────
const ICON: Record<Level, string> = { FAIL: "✗", WARN: "⚠", OK: "✓" };
console.log("\nWC26 Execution-Discipline Inspector");
console.log("───────────────────────────────────");
for (const c of checks) console.log(`  ${ICON[c.level]} [${c.rule}] ${c.message}`);

console.log("\nStanding rules (docs/WC26-EXECUTION-CONTRACT.md):");
console.log("  • Skills: brainstorming → writing-plans → executing-plans → TDD → verification → finishing-branch.");
console.log("  • Gates before commit: build · vitest · design-inspector · eslint.");
console.log("  • Never `git add -A`; never implement on main; one PR per change.");
console.log("  • Never `ml:fetch`/`matchday` to refresh results (wipes seeded data). Settle from sourced finals only.");
console.log("  • Never fabricate results/metrics. Predictions immutable. Single-source numbers. BREACH shown honestly.");

const fails = checks.filter((c) => c.level === "FAIL");
if (fails.length) {
  console.error(`\n✗ Execution inspector: ${fails.length} violation(s). Fix before proceeding.`);
  process.exit(1);
}
console.log("\n✓ Execution inspector passed.");
