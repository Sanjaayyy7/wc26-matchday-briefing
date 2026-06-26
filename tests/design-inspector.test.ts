import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { inspectProject } from "@/scripts/design-inspector.mts";

// ── helpers ──────────────────────────────────────────────────────────────────

function makeFixtureDir(): string {
  return mkdtempSync(join(tmpdir(), "design-inspector-"));
}

function writeFixturePage(root: string, name: string, content: string): void {
  const dir = join(root, "app", name);
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, "page.tsx"), content);
}

function writeFixtureLib(root: string, filename: string, content: string): void {
  const dir = join(root, "lib");
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, filename), content);
}

// ── existing smoke test ───────────────────────────────────────────────────────

describe("design inspector", () => {
  it("passes the current first-party app surface", () => {
    expect(() =>
      execFileSync(process.execPath, ["--import", "tsx", "scripts/design-inspector.mts"], {
        cwd: process.cwd(),
        stdio: "pipe",
      }),
    ).not.toThrow();
  });
});

// ── Linear constitution tests (TDD) ──────────────────────────────────────────

describe("design-inspector (Linear constitution)", () => {
  it("allows Surface card with --radius-card token on a route", () => {
    const root = makeFixtureDir();
    try {
      writeFixturePage(
        root,
        "test-surface",
        `export default function Page() {
  return (
    <WCS26Shell>
      <RouteStack>
        <CanvasSection eyebrow="Test">
          <div className="bg-[var(--surface)] rounded-[var(--radius-card)]">content</div>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}`,
      );
      const violations = inspectProject(root);
      expect(violations).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("flags raw rounded-3xl on a route as radius-token", () => {
    const root = makeFixtureDir();
    try {
      writeFixturePage(
        root,
        "test-radius",
        `export default function Page() {
  return (
    <WCS26Shell>
      <RouteStack>
        <CanvasSection eyebrow="Test">
          <div className="rounded-3xl">content</div>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}`,
      );
      const violations = inspectProject(root);
      expect(violations.some((v) => v.rule === "radius-token")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does NOT flag shadow-[var(--shadow-pop)] as elevation on a route page", () => {
    const root = makeFixtureDir();
    try {
      writeFixturePage(
        root,
        "test-shadow-pop",
        `export default function Page() {
  return (
    <WCS26Shell>
      <RouteStack>
        <CanvasSection eyebrow="Test">
          <div className="shadow-[var(--shadow-pop)]">content</div>
        </CanvasSection>
      </RouteStack>
    </WCS26Shell>
  );
}`,
      );
      const violations = inspectProject(root);
      const elevationViolations = violations.filter((v) => v.rule === "elevation");
      expect(elevationViolations).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("still flags shadow-lg as elevation (detection not disabled)", () => {
    const root = makeFixtureDir();
    try {
      writeFixtureLib(
        root,
        "test-shadow-lg.ts",
        `export const cardClass = "shadow-lg";`,
      );
      const violations = inspectProject(root);
      expect(violations.some((v) => v.rule === "elevation")).toBe(true);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });

  it("does NOT false-positive on shadow- inside a // comment", () => {
    const root = makeFixtureDir();
    try {
      writeFixtureLib(
        root,
        "test-shadow.ts",
        `// shadow-fit elevation note
export const foo = "bar";`,
      );
      const violations = inspectProject(root);
      const elevationViolations = violations.filter((v) => v.rule === "elevation");
      expect(elevationViolations).toHaveLength(0);
    } finally {
      rmSync(root, { recursive: true, force: true });
    }
  });
});
