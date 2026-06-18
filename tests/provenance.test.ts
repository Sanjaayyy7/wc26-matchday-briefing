import { describe, it, expect } from "vitest";
import { assertProvenance, type Provenance } from "@/lib/provenance";

const verified: Provenance = {
  source: "https://example.com/match/123",
  confidence: 0.9,
  verificationDate: "2026-06-17",
  originType: "verified",
};

describe("assertProvenance", () => {
  it("throws when _prov is missing", () => {
    expect(() => assertProvenance({})).toThrow(/provenance missing/);
  });

  it("throws when a seeded row claims confidence above 0.3", () => {
    expect(() =>
      assertProvenance({ _prov: { ...verified, originType: "seeded", confidence: 0.9 } }),
    ).toThrow(/seeded/);
  });

  it("passes for a valid verified row", () => {
    expect(() => assertProvenance({ _prov: verified })).not.toThrow();
  });

  it("passes for a low-confidence seeded row", () => {
    expect(() =>
      assertProvenance({ _prov: { ...verified, originType: "seeded", confidence: 0.2 } }),
    ).not.toThrow();
  });
});
