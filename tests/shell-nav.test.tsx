import { describe, it, expect } from "vitest";
import { WC26_NAV } from "@/components/wc26-shell-header";

describe("nav", () => {
  it("has 7 items and no Record route", () => {
    expect(WC26_NAV).toHaveLength(7);
    expect(WC26_NAV.find((n) => n.routeKey === "record")).toBeUndefined();
    expect(WC26_NAV[0].href).toBe("/");
  });

  it("exposes the parlay route", () => {
    expect(WC26_NAV.find((n) => n.routeKey === "parlay")?.href).toBe("/parlay");
  });
});
