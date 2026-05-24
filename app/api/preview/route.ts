import type { NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/prompt-loader";
import { buildFirstUserMessage } from "@/lib/fixture-template";
import { streamMessages } from "@/lib/anthropic";
import { fixtureBySlug, clubById } from "@/lib/data";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const slug = typeof body?.slug === "string" ? body.slug : null;
  const fixture = slug ? fixtureBySlug(slug) : undefined;
  if (!fixture) {
    return new Response("fixture not found", { status: 404 });
  }

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  const kickoff = new Date(fixture.kickoffISO);
  kickoff.setUTCDate(kickoff.getUTCDate() - 1);
  const today = kickoff.toISOString().slice(0, 10);

  const userText = buildFirstUserMessage({ fixture, home, away, today });
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
