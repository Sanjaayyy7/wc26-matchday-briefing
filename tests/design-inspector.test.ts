import { describe, expect, it } from "vitest";
import { execFileSync } from "node:child_process";

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
