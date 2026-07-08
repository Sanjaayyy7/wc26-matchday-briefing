// View model for the /parlay page: ledger rows + fixtures → slip cards +
// running record. Pure functions take rows as arguments; loaders at the
// bottom bind them to the committed data files (single source of truth).
import "server-only";
import parlaysJson from "@/data/parlays.json";
import { allFixtures, clubById } from "@/lib/data";

export type ParlayLegRow = {
  ticker: string;
  side: "yes" | "no";
  title: string;
  modelProb: number;
  kalshiMid: number | null;
  reasoning: string;
};

export type ParlaySlipRow = {
  slug: string;
  lockedAt: string;
  verdict?: "no-slip";
  reason?: string;
  modelDataThrough?: string;
  legs?: ParlayLegRow[];
  jointProb?: number;
  result?: { legs: Array<{ ticker: string; hit: boolean }>; slipHit: boolean; gradedAt: string };
};

export type ParlayLegView = ParlayLegRow & { hit: boolean | null };

export type ParlaySlipView = {
  slug: string;
  matchup: string;
  stage?: string;
  kickoffISO: string;
  lockedAt: string;
  status: "open" | "hit" | "miss" | "no-slip";
  reason?: string;
  legs: ParlayLegView[];
  jointProb?: number;
};

export type ParlayRecord = {
  slips: number;
  noSlips: number;
  graded: number;
  slipHits: number;
  slipHitRate: number | null;
  legs: number;
  legHits: number;
  legHitRate: number | null;
  meanLockedJoint: number | null;
};

export function buildParlayViews(
  rows: ParlaySlipRow[],
  fixtures: Array<{ slug: string; homeId: string; awayId: string; kickoffISO: string; stage?: string }>,
  clubName: (id: string) => string,
): ParlaySlipView[] {
  const bySlug = new Map(fixtures.map((f) => [f.slug, f]));
  const views: ParlaySlipView[] = [];
  for (const row of rows) {
    const f = bySlug.get(row.slug);
    if (!f) continue; // ledger row without a fixture: never render fabricated context
    const hitBy = new Map((row.result?.legs ?? []).map((l) => [l.ticker, l.hit]));
    const status: ParlaySlipView["status"] =
      row.verdict === "no-slip" ? "no-slip" : row.result ? (row.result.slipHit ? "hit" : "miss") : "open";
    views.push({
      slug: row.slug,
      matchup: `${clubName(f.homeId)} vs ${clubName(f.awayId)}`,
      stage: f.stage,
      kickoffISO: f.kickoffISO,
      lockedAt: row.lockedAt,
      status,
      ...(row.reason !== undefined ? { reason: row.reason } : {}),
      legs: (row.legs ?? []).map((leg) => ({ ...leg, hit: hitBy.get(leg.ticker) ?? null })),
      ...(row.jointProb !== undefined ? { jointProb: row.jointProb } : {}),
    });
  }
  return views.sort(
    (a, b) => new Date(a.kickoffISO).getTime() - new Date(b.kickoffISO).getTime() || a.slug.localeCompare(b.slug),
  );
}

export function parlayRecord(rows: ParlaySlipRow[]): ParlayRecord {
  const locked = rows.filter((r) => r.verdict !== "no-slip");
  const graded = locked.filter((r) => r.result);
  const slipHits = graded.filter((r) => r.result?.slipHit).length;
  const legRows = graded.flatMap((r) => r.result?.legs ?? []);
  const legHits = legRows.filter((l) => l.hit).length;
  const joints = graded.map((r) => r.jointProb).filter((j): j is number => typeof j === "number");
  return {
    slips: locked.length,
    noSlips: rows.length - locked.length,
    graded: graded.length,
    slipHits,
    slipHitRate: graded.length > 0 ? slipHits / graded.length : null,
    legs: legRows.length,
    legHits,
    legHitRate: legRows.length > 0 ? legHits / legRows.length : null,
    meanLockedJoint: joints.length > 0 ? joints.reduce((a, b) => a + b, 0) / joints.length : null,
  };
}

export function parlayLedger(): ParlaySlipRow[] {
  return parlaysJson as unknown as ParlaySlipRow[];
}

export function parlayViews(): ParlaySlipView[] {
  return buildParlayViews(parlayLedger(), allFixtures(), (id) => clubById(id).name);
}
