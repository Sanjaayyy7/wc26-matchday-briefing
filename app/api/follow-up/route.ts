import type { NextRequest } from "next/server";
import { predictFixture } from "@/lib/predict";
import { buildFollowUpMarkdown } from "@/lib/briefing-template";
import { fixtureBySlug, clubById } from "@/lib/data";

export const runtime = "nodejs";

type Body = {
  slug?: string;
  question?: string;
};

export async function POST(req: NextRequest) {
  const body = (await req.json().catch(() => ({}))) as Body;
  const { slug, question } = body;
  const fixture = typeof slug === "string" ? fixtureBySlug(slug) : undefined;
  if (!fixture || !question) {
    return new Response("bad request", { status: 400 });
  }

  const home = clubById(fixture.homeId);
  const away = clubById(fixture.awayId);
  const HOSTS = ["United States", "Canada", "Mexico"];
  const prediction = predictFixture({
    home: home.name,
    away: away.name,
    neutral: !HOSTS.includes(home.name),
    stage: fixture.stage ?? "group",
  });
  const markdown = buildFollowUpMarkdown(question, prediction, {
    homeName: home.name,
    awayName: away.name,
  });

  return new Response(markdown, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
    },
  });
}
