import type { NextRequest } from "next/server";
import { readFileSync } from "node:fs";
import path from "node:path";
import { getSystemPrompt } from "@/lib/prompt-loader";
import { buildFirstUserMessage } from "@/lib/fixture-template";
import { streamMessages } from "@/lib/anthropic";
import { fixtureBySlug, clubById } from "@/lib/data";

export const runtime = "nodejs";

// Pipeline artifacts (scripts/build-facts.mts, scripts/fetch-kalshi.mts) land in
// pipeline-output/<slug>/; absence is normal — the prompt handles "none provided".
function readPipelineArtifact(slug: string, file: string): string | undefined {
  try {
    const text = readFileSync(
      path.resolve(process.cwd(), "pipeline-output", slug, file),
      "utf8",
    ).trim();
    return text || undefined;
  } catch {
    return undefined;
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const fixture = slug ? fixtureBySlug(slug) : undefined;
  if (!fixture) {
    return new Response("fixture not found", { status: 404 });
  }

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  // Demo fiction: the briefing is always generated "the day before kickoff",
  // so played fixtures still preview instead of tripping the post-match guardrail.
  const now = new Date(fixture.kickoffISO);
  now.setUTCDate(now.getUTCDate() - 1);
  const today = now.toISOString().slice(0, 10);

  const userText = buildFirstUserMessage({
    fixture,
    home,
    away,
    today,
    now,
    verifiedFacts: readPipelineArtifact(fixture.slug, "facts.md"),
    marketSnapshot: readPipelineArtifact(fixture.slug, "market.md"),
  });
  const stream = streamMessages({
    system: getSystemPrompt(),
    messages: [{ role: "user", content: userText }],
    maxTokens: 1500,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
