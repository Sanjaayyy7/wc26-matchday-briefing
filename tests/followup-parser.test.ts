import { describe, it, expect } from "vitest";
import { parseFollowUp } from "@/lib/followup-parser";

const wellFormed = `**Short answer:** Around 38%, so leaning *against* BTTS. Arsenal scoring is near-certain; Burnley scoring at the Emirates is the bottleneck.

**The mechanism:** Burnley's away xG this season sits around 0.8 per game, and most of it comes from transition moments. Arsenal's midfield rest-defence under Rice has been the league's best at killing those exact moments.

**The number:** ~38%, range 32–45% depending on whether Saliba starts and how high Arsenal's line sits in the second half if they're already 2–0 up.

**Caveat for a teenager quoting his mates:** Football laughs at this stuff. One deflected free-kick and the "no BTTS" call looks silly. Tell them it's a lean, not a lock.`;

describe("parseFollowUp - well-formed reply", () => {
  const r = parseFollowUp(wellFormed);

  it("flags ok=true", () => expect(r.ok).toBe(true));

  it("extracts each section", () => {
    expect(r.shortAnswer).toMatch(/Around 38%/);
    expect(r.mechanism).toMatch(/Burnley's away xG/);
    expect(r.number).toMatch(/~38%/);
    expect(r.caveat).toMatch(/Football laughs/);
  });
});

describe("parseFollowUp - missing sections", () => {
  it("flags ok=false on partial reply", () => {
    const r = parseFollowUp("**Short answer:** Around 38%.");
    expect(r.ok).toBe(false);
    expect(r.shortAnswer).toMatch(/Around 38%/);
  });
});
