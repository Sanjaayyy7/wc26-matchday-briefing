import type { NextRequest } from "next/server";
import { predictFixture } from "@/lib/predict";
import { buildPreviewMarkdown } from "@/lib/briefing-template";
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

  // Hosts keep home advantage (matches the dataset's neutral flags);
  // every other WC26 fixture is neutral-venue.
  const HOSTS = ["United States", "Canada", "Mexico"];
  const prediction = predictFixture({
    home: home.name,
    away: away.name,
    neutral: !HOSTS.includes(home.name),
    stage: fixture.stage ?? "group",
  });
  const markdown = buildPreviewMarkdown(prediction, {
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
