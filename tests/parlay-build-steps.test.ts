import { describe, expect, it } from "vitest";
import { buildStep } from "../lib/parlay-build-steps";

describe("buildStep", () => {
  it("maps every series to its app category with strike and side", () => {
    expect(buildStep({ ticker: "KXWCTOTAL-26JUL10ESPBEL-6", side: "no", title: "Will over 5.5 goals be scored?" }))
      .toBe("Point Total → 5.5 → No");
    expect(buildStep({ ticker: "KXWCSPREAD-26JUL10ESPBEL-BEL3", side: "no", title: "Will Belgium win by more than 2.5 goals?" }))
      .toBe("Spread → BEL 2.5 → No");
    expect(buildStep({ ticker: "KXWC1HTOTAL-26JUL11NORENG-3", side: "no", title: "Over 2.5 1H goals scored?" }))
      .toBe("1st Half Total → 2.5 → No");
    expect(buildStep({ ticker: "KXWCGAME-26JUL10ESPBEL-ESP", side: "yes", title: "Spain vs Belgium Winner?" }))
      .toBe("Regulation Time Moneyline → ESP → Yes");
    expect(buildStep({ ticker: "KXWCADVANCE-26JUL10ESPBEL-ESP", side: "yes", title: "To Advance" }))
      .toBe("Full Match: To Advance → ESP → Yes");
    expect(buildStep({ ticker: "KXWCGOAL-26JUL10ESPBEL-ESPMOYARZ10-1", side: "yes", title: "Mikel Oyarzabal: 1+ goals" }))
      .toBe("Full Match: Goalscorers → Mikel Oyarzabal 1+ → Yes");
    expect(buildStep({ ticker: "KXWCBTTS-26JUL10ESPBEL-BTTS", side: "no", title: "Will both teams score?" }))
      .toBe("BTTS → Both score → No");
  });
});
