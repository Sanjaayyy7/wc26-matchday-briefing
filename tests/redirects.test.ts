import { describe, it, expect } from "vitest";
import nextConfig from "@/next.config";

describe("next.config redirects", () => {
  it("permanently redirects /record to /", async () => {
    expect(typeof nextConfig.redirects).toBe("function");
    const redirects = await nextConfig.redirects!();
    const recordRedirect = redirects.find((r) => r.source === "/record");
    expect(recordRedirect).toBeDefined();
    expect(recordRedirect?.destination).toBe("/");
    expect(recordRedirect?.permanent).toBe(true);
  });
});
