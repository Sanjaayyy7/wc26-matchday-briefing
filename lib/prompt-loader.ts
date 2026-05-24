import "server-only";
import { readFileSync } from "node:fs";
import path from "node:path";

let cached: string | null = null;

export function getSystemPrompt(): string {
  if (cached) return cached;
  const filePath = path.resolve(process.cwd(), "..", "pl-analyst-system-prompt.md");
  cached = readFileSync(filePath, "utf8");
  return cached;
}
