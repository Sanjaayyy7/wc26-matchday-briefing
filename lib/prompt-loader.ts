import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

const cache = new Map<string, string>();

export function getSystemPrompt(): string {
  const filePath = path.resolve(
    process.cwd(),
    process.env.PROMPT_FILE ?? "../pl-analyst-system-prompt.md",
  );
  let text = cache.get(filePath);
  if (text === undefined) {
    text = readFileSync(filePath, "utf8");
    cache.set(filePath, text);
  }
  return text;
}
