import type { NextRequest } from "next/server";
import { getSystemPrompt } from "@/lib/prompt-loader";
import { buildFirstUserMessage } from "@/lib/fixture-template";
import { streamMessages, type Msg } from "@/lib/anthropic";
import { fixtureBySlug, clubById } from "@/lib/data";

export const runtime = "nodejs";

type Body = {
  slug?: string;
  history?: Msg[];
  question?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { slug, history, question } = body;
  const fixture = typeof slug === "string" ? fixtureBySlug(slug) : undefined;
  if (!fixture || !question) {
    return new Response("bad request", { status: 400 });
  }

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  const kickoff = new Date(fixture.kickoffISO);
  kickoff.setUTCDate(kickoff.getUTCDate() - 1);
  const today = kickoff.toISOString().slice(0, 10);

  const firstUser: Msg = {
    role: "user",
    content: buildFirstUserMessage({ fixture, home, away, today }),
  };
  const messages: Msg[] = [
    firstUser,
    ...(history ?? []),
    { role: "user", content: question },
  ];

  const stream = streamMessages({
    system: getSystemPrompt(),
    messages,
    maxTokens: 400,
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
