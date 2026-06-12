// Generate a briefing for a fixture with the v2 prompt + pipeline artifacts,
// validate it against the Output Contract parser, and save it.
//
//   npm run pipeline:run -- <fixture-slug>
//
// Requires ANTHROPIC_API_KEY (read from .env.local). Costs one API call.
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, existsSync } from "node:fs";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { buildFirstUserMessage } from "../lib/fixture-template";
import { parsePreview } from "../lib/preview-parser";
import type { Club, Fixture } from "../lib/data";
import { appDir, fixtureBySlugOrDie, loadEnv, outDir, teams } from "./shared.mts";

loadEnv();
const MODEL = "claude-opus-4-7";

const slug = process.argv[2];
if (!slug) {
  console.error("usage: pipeline:run -- <fixture-slug>");
  process.exit(1);
}
const fixture = fixtureBySlugOrDie(slug) as unknown as Fixture;
const allTeams = teams() as unknown as Club[];
const team = (id: string) => {
  const t = allTeams.find((x) => x.id === id);
  if (!t) throw new Error(`unknown team ${id}`);
  return t;
};

const promptPath = path.resolve(
  appDir,
  process.env.PROMPT_FILE ?? "../wc-analyst-system-prompt-v2.md",
);
const system = readFileSync(promptPath, "utf8");

const dir = outDir(slug);
const readArtifact = (file: string): string | undefined => {
  const p = path.join(dir, file);
  return existsSync(p) ? readFileSync(p, "utf8").trim() || undefined : undefined;
};

const now = new Date();
const userText = buildFirstUserMessage({
  fixture,
  home: team(fixture.homeId),
  away: team(fixture.awayId),
  today: now.toISOString().slice(0, 10),
  now,
  verifiedFacts: readArtifact("facts.md"),
  marketSnapshot: readArtifact("market.md"),
});

console.log(`prompt: ${path.basename(promptPath)} | model: ${MODEL}`);
const client = new Anthropic();
const resp = await client.messages.create({
  model: MODEL,
  max_tokens: 1500,
  system,
  messages: [{ role: "user", content: userText }],
});
const text = resp.content
  .filter((b) => b.type === "text")
  .map((b) => (b as { text: string }).text)
  .join("");

writeFileSync(path.join(dir, "preview.md"), text);
writeFileSync(
  path.join(dir, "run-meta.json"),
  JSON.stringify(
    {
      model: MODEL,
      promptFile: path.basename(promptPath),
      generatedAt: now.toISOString(),
      usage: resp.usage,
      userText,
    },
    null,
    2,
  ),
);

const parsed = parsePreview(text);
const sum = parsed.probabilities
  ? parsed.probabilities.home + parsed.probabilities.draw + parsed.probabilities.away
  : NaN;
console.log(`wrote ${dir}/preview.md`);
console.log(
  `contract ok=${parsed.ok} | split=${JSON.stringify(parsed.probabilities)} | sum=${sum}`,
);
if (!parsed.ok || Number.isNaN(sum) || sum < 98 || sum > 102) {
  console.error("CONTRACT VIOLATION — preview failed structural validation");
  process.exit(2);
}
