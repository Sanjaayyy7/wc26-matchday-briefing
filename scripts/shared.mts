import { readFileSync, mkdirSync, existsSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const appDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

export type FixtureRow = {
  id: string;
  slug: string;
  homeId: string;
  awayId: string;
  kickoffISO: string;
  venue: string;
  competition: string;
  stakes: string;
  privateNotes: string | null;
  featured?: boolean;
  stage?: string;
  group?: string;
  homeScore?: number;
  awayScore?: number;
  tzOffsetMinutes?: number;
  tzLabel?: string;
};

export type TeamRow = { id: string; name: string };

/** Minimal .env.local loader — no dotenv dependency. */
export function loadEnv(): void {
  const envPath = path.join(appDir, ".env.local");
  if (!existsSync(envPath)) return;
  for (const line of readFileSync(envPath, "utf8").split("\n")) {
    const m = line.match(/^([A-Z_]+)=(.*)$/);
    if (m && process.env[m[1]] === undefined) process.env[m[1]] = m[2];
  }
}

export function fixtures(): FixtureRow[] {
  return JSON.parse(readFileSync(path.join(appDir, "data", "fixtures.json"), "utf8"));
}

export function teams(): TeamRow[] {
  return JSON.parse(readFileSync(path.join(appDir, "data", "clubs.json"), "utf8"));
}

export function fixtureBySlugOrDie(slug: string): FixtureRow {
  const f = fixtures().find((x) => x.slug === slug);
  if (!f) {
    console.error(`Unknown fixture slug: ${slug}`);
    console.error(`Known: ${fixtures().map((x) => x.slug).join(", ")}`);
    process.exit(1);
  }
  return f;
}

export function outDir(slug: string): string {
  const dir = path.join(appDir, "pipeline-output", slug);
  mkdirSync(dir, { recursive: true });
  return dir;
}

/** Kalshi event ticker for a fixture: KXWCGAME-<YY><MON><DD><HOME><AWAY> (venue-local date). */
export function kalshiEventTicker(f: FixtureRow): string {
  const local = new Date(
    new Date(f.kickoffISO).getTime() + (f.tzOffsetMinutes ?? 0) * 60 * 1000,
  );
  const months = ["JAN","FEB","MAR","APR","MAY","JUN","JUL","AUG","SEP","OCT","NOV","DEC"];
  const yy = String(local.getUTCFullYear()).slice(2);
  const mon = months[local.getUTCMonth()];
  const dd = String(local.getUTCDate()).padStart(2, "0");
  return `KXWCGAME-${yy}${mon}${dd}${f.homeId.toUpperCase()}${f.awayId.toUpperCase()}`;
}
