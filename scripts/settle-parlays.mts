// Grades locked parlay slips post-FT. Reg-time legs grade on the 90' score
// (same knockout semantics as prediction grading); ADVANCE legs on winnerId;
// v2 first-half legs on the half-time score (ht in knockout-results.json) —
// missing HT leaves the slip pending, never guessed from the FT score.
// Appends `result` only — locked fields are immutable. Idempotent.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, fixtures } from "./shared.mts";
import { parseMarket } from "../lib/parlay";
import { ENGINE_VERSION_V2, parseMarketV2 } from "../lib/parlay-v2";

export function gradeLeg(
  leg: { ticker: string; side: "yes" | "no" },
  ctx: { h90: number; a90: number; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string },
): boolean | null {
  const parsed = parseMarket({ ticker: leg.ticker, title: "", yesMid: null }, ctx.homeAbbr, ctx.awayAbbr);
  if (!parsed) return null;
  if (parsed.kind === "advance") {
    if (ctx.advancedHome === null) return null;
    const yesOutcome = parsed.advanceSide === "home" ? ctx.advancedHome : !ctx.advancedHome;
    return leg.side === "yes" ? yesOutcome : !yesOutcome;
  }
  const yesOutcome = parsed.pred(ctx.h90, ctx.a90);
  return leg.side === "yes" ? yesOutcome : !yesOutcome;
}

export function gradeLegV2(
  leg: { ticker: string; side: "yes" | "no" },
  ctx: { h90: number; a90: number; h1: number | null; a1: number | null; advancedHome: boolean | null; homeAbbr: string; awayAbbr: string },
): boolean | null {
  const parsed = parseMarketV2({ ticker: leg.ticker, title: "", yesMid: null }, ctx.homeAbbr, ctx.awayAbbr);
  if (!parsed) return null;
  if (parsed.kind === "advance") {
    if (ctx.advancedHome === null) return null;
    const yesOutcome = parsed.advanceSide === "home" ? ctx.advancedHome : !ctx.advancedHome;
    return leg.side === "yes" ? yesOutcome : !yesOutcome;
  }
  if (parsed.window === "1h" && (ctx.h1 === null || ctx.a1 === null)) return null;
  const yesOutcome = parsed.pred({ h1: ctx.h1 ?? 0, a1: ctx.a1 ?? 0, h: ctx.h90, a: ctx.a90 });
  return leg.side === "yes" ? yesOutcome : !yesOutcome;
}

const PARLAYS_PATH = path.join(appDir, "data", "parlays.json");

function main(): void {
  if (!existsSync(PARLAYS_PATH)) {
    console.log("no parlays.json yet — nothing to grade");
    return;
  }
  const slips = JSON.parse(readFileSync(PARLAYS_PATH, "utf8")) as Array<Record<string, unknown>>;
  const fx = new Map(fixtures().map((f) => [f.slug, f]));
  const ko = JSON.parse(readFileSync(path.join(appDir, "data", "knockout-results.json"), "utf8")) as Record<string, unknown>;
  const koRows = Object.values(ko).flatMap((v) => (Array.isArray(v) ? v : [])) as Array<{
    homeId: string;
    awayId: string;
    homeScore90?: number;
    awayScore90?: number;
    winnerId: string;
    after: string;
    ht?: { home: number; away: number };
  }>;
  let graded = 0;
  for (const slip of slips) {
    if (slip.result || slip.verdict === "no-slip") continue;
    const f = fx.get(slip.slug as string);
    if (!f || f.homeScore === undefined || f.awayScore === undefined) continue;
    const row = koRows.find((r) => r.homeId === f.homeId && r.awayId === f.awayId);
    const h90 = row && row.after !== "90" ? (row.homeScore90 as number) : (f.homeScore as number);
    const a90 = row && row.after !== "90" ? (row.awayScore90 as number) : (f.awayScore as number);
    const advancedHome = row ? row.winnerId === f.homeId : null;
    const h1 = row?.ht ? row.ht.home : null;
    const a1 = row?.ht ? row.ht.away : null;
    const ctx = { h90, a90, advancedHome, homeAbbr: f.homeId.toUpperCase(), awayAbbr: f.awayId.toUpperCase() };
    const isV2 = (slip as { engineVersion?: string }).engineVersion === ENGINE_VERSION_V2;
    const legs = (slip.legs as Array<{ ticker: string; side: "yes" | "no" }>).map((l) => ({
      ticker: l.ticker,
      hit: isV2 ? gradeLegV2(l, { ...ctx, h1, a1 }) : gradeLeg(l, ctx),
    }));
    if (legs.some((l) => l.hit === null)) {
      console.error(
        `[settle-parlays] ${slip.slug}${isV2 ? " (v2)" : ""}: ungradable leg — skipped` +
        (isV2 && h1 === null ? " (1H legs need ht: {home, away} in knockout-results.json)" : ""),
      );
      continue;
    }
    const result = { legs, slipHit: legs.every((l) => l.hit === true), gradedAt: new Date().toISOString() };
    slip.result = result;
    graded += 1;
    console.log(`[settle-parlays] ${slip.slug}: ${legs.filter((l) => l.hit).length}/${legs.length} legs, slip ${result.slipHit ? "HIT" : "MISS"}`);
  }
  writeFileSync(PARLAYS_PATH, `${JSON.stringify(slips, null, 1)}\n`);
  console.log(`[settle-parlays] graded ${graded} new`);
}

if (process.argv[1] && process.argv[1].endsWith("settle-parlays.mts")) main();
