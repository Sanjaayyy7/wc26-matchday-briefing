import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import { Surface } from "@/components/ui/surface";
import GlassHeader from "@/components/glass-header";
import Hero from "@/components/hero";

describe("Surface", () => {
  it("renders children inside a surface+radius card", () => {
    const html = renderToStaticMarkup(<Surface>hi</Surface>);
    expect(html).toContain("hi");
    expect(html).toMatch(/--surface/);
    expect(html).toMatch(/--radius-card/);
  });

  it("applies interactive utility when prop is set", () => {
    const html = renderToStaticMarkup(<Surface interactive>click me</Surface>);
    expect(html).toMatch(/interactive/);
  });

  it("renders as a custom element when as prop is provided", () => {
    const html = renderToStaticMarkup(<Surface as="article">body</Surface>);
    expect(html).toMatch(/^<article/);
  });
});

describe("GlassHeader", () => {
  it("renders children with sticky position and blur-glass token", () => {
    const html = renderToStaticMarkup(<GlassHeader>nav</GlassHeader>);
    expect(html).toContain("nav");
    expect(html).toMatch(/sticky/);
    expect(html).toMatch(/--blur-glass/);
  });
});

describe("Hero", () => {
  it("renders children with hero-glow wash class", () => {
    const html = renderToStaticMarkup(<Hero>content</Hero>);
    expect(html).toContain("content");
    expect(html).toMatch(/hero-glow/);
  });

  it("renders eyebrow text when provided", () => {
    const html = renderToStaticMarkup(<Hero eyebrow="BETA">content</Hero>);
    expect(html).toContain("BETA");
  });
});
