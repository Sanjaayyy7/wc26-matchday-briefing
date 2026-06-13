import { describe, it, expect } from "vitest";
import { readFileSync } from "node:fs";
import path from "node:path";
import { parseKalshiResolution } from "@/lib/kalshi";

const fx = (name: string) =>
  JSON.parse(
    readFileSync(path.resolve(__dirname, "fixtures", name), "utf8"),
  );

describe("parseKalshiResolution - settled (MEX vs RSA, finalized)", () => {
  const settled = fx("kalshi-settled.json");

  it("returns status=settled when all markets are finalized", () => {
    const result = parseKalshiResolution(settled, "mex", "rsa");
    expect(result.status).toBe("settled");
  });

  it("maps home=1, draw=0, away=0 when home team won (MEX)", () => {
    const result = parseKalshiResolution(settled, "mex", "rsa");
    expect(result.home).toBe(1);
    expect(result.draw).toBe(0);
    expect(result.away).toBe(0);
  });

  it("returns settledTime as an ISO string from settlement_ts", () => {
    const result = parseKalshiResolution(settled, "mex", "rsa");
    expect(result.settledTime).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});

describe("parseKalshiResolution - open/active (USA vs PAR)", () => {
  const open = fx("kalshi-open.json");

  it("returns status=open when markets are not finalized", () => {
    const result = parseKalshiResolution(open, "usa", "par");
    expect(result.status).toBe("open");
  });

  it("returns home=0, draw=0, away=0 for unresolved market", () => {
    const result = parseKalshiResolution(open, "usa", "par");
    expect(result.home).toBe(0);
    expect(result.draw).toBe(0);
    expect(result.away).toBe(0);
  });

  it("returns no settledTime for open market", () => {
    const result = parseKalshiResolution(open, "usa", "par");
    expect(result.settledTime).toBeUndefined();
  });
});

describe("parseKalshiResolution - empty markets list", () => {
  it("returns status=open and all zeros when no markets returned", () => {
    const result = parseKalshiResolution({ markets: [] }, "foo", "bar");
    expect(result.status).toBe("open");
    expect(result.home).toBe(0);
    expect(result.draw).toBe(0);
    expect(result.away).toBe(0);
  });
});
