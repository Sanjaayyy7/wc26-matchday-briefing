// LLM-judge a generated preview against the reliability rubric.
// Gated: refuses to run without RUN_LIVE=1 (it costs an API call per preview).
//
//   RUN_LIVE=1 npm run eval:judge -- <fixture-slug> [more-slugs...]
import Anthropic from "@anthropic-ai/sdk";
import { readFileSync, appendFileSync, existsSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, loadEnv, outDir } from "./shared.mts";

loadEnv();
if (process.env.RUN_LIVE !== "1") {
  console.error("Refusing to run: set RUN_LIVE=1 to spend API calls on judging.");
  process.exit(1);
}

const MODEL = "claude-opus-4-7";
const slugs = process.argv.slice(2);
if (!slugs.length) {
  console.error("usage: RUN_LIVE=1 npm run eval:judge -- <fixture-slug> [...]");
  process.exit(1);
}

const RUBRIC = `You are auditing a football match preview produced by an AI analyst.
The generation-time inputs (VERIFIED_FACTS, MARKET_SNAPSHOT) are included below; treat any
factual claim NOT traceable to them as unverified.

Score 0-5 on each dimension (5 = flawless) and return ONLY JSON:
{"contract": n, "probability_discipline": n, "groundedness": n, "mechanism_specificity": n, "guardrails": n, "notes": "<=50 words"}

- contract: all required sections present, in order, correct shapes.
- probability_discipline: split sums 98-102; confidence word matches band (coin-flip <40, lean 40-55, fairly confident 55-70, strong >70); follow-the-number consistency.
- groundedness: precise stats only when in VERIFIED_FACTS; estimates hedged; unknowns declared, not invented; no player named outside provided facts.
- mechanism_specificity: names zones/mechanisms, not vibes ("concede half-spaces" beats "bad defence").
- guardrails: no bookmaker odds formats, no betting framing, market disagreement >10pts explained if present.`;

const client = new Anthropic();
const reportPath = path.join(appDir, "pipeline-output", "eval-report.md");
if (!existsSync(reportPath)) {
  writeFileSync(
    reportPath,
    "# LLM-judge eval report\n\n| When (UTC) | Fixture | Prompt | Contract | Prob | Grounded | Mechanism | Guardrails | Notes |\n|---|---|---|---|---|---|---|---|---|\n",
  );
}

for (const slug of slugs) {
  const dir = outDir(slug);
  const preview = readFileSync(path.join(dir, "preview.md"), "utf8");
  const meta = JSON.parse(readFileSync(path.join(dir, "run-meta.json"), "utf8")) as {
    promptFile: string;
    userText: string;
  };

  const resp = await client.messages.create({
    model: MODEL,
    max_tokens: 400,
    messages: [
      {
        role: "user",
        content: `${RUBRIC}\n\n=== GENERATION INPUTS ===\n${meta.userText}\n\n=== PREVIEW UNDER AUDIT ===\n${preview}`,
      },
    ],
  });
  const text = resp.content
    .filter((b) => b.type === "text")
    .map((b) => (b as { text: string }).text)
    .join("");
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) {
    console.error(`${slug}: judge returned no JSON:\n${text}`);
    continue;
  }
  const score = JSON.parse(jsonMatch[0]) as Record<string, number | string>;
  appendFileSync(
    reportPath,
    `| ${new Date().toISOString()} | ${slug} | ${meta.promptFile} | ${score.contract} | ${score.probability_discipline} | ${score.groundedness} | ${score.mechanism_specificity} | ${score.guardrails} | ${String(score.notes).replace(/\|/g, "/")} |\n`,
  );
  console.log(`${slug}: ${JSON.stringify(score)}`);
}
console.log(`appended ${reportPath}`);
