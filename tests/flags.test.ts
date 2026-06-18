import { describe, expect, it } from "vitest";
import clubs from "@/data/clubs.json";
import { flagForShort } from "@/lib/flags";

describe("flagForShort", () => {
  it("maps every WC26 club short code to a national flag", () => {
    for (const club of clubs) {
      expect(flagForShort(club.short), club.short).toBeTruthy();
    }
  });

  it("handles ISO and subdivision flag cases", () => {
    expect(flagForShort("POR")).toBe("🇵🇹");
    expect(flagForShort("USA")).toBe("🇺🇸");
    expect(flagForShort("KOR")).toBe("🇰🇷");
    expect(flagForShort("ENG")).toBeTruthy();
    expect(flagForShort("SCO")).toBeTruthy();
  });
});
