// Locks one model-optimized parlay slip per upcoming fixture into
// data/parlays.json (immutable, append-only) + full market snapshot per slug.
// Selection is pure model (hit-max); Kalshi mids are display/benchmark only.
// Refuses past kickoffs. Idempotent per (slug, engineVersion).
// v2.1: lock emits engineVersion "v2.1-combo" — one leg per series, per
// Kalshi's combo rule (per-event size_max=1, collections API 2026-07-09).
// v1 and v2-combo entries are history.
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { appDir, fixtures, teams, kalshiEventCode } from "./shared.mts";
import { lambdasFromElo, scoreGrid, advancementProb, summarizeGrid, type ModelParams } from "../lib/poisson-model";
import type { KalshiMarket } from "../lib/parlay";
import {
  COMBO_SERIES, ENGINE_VERSION_V2_1, MAX_LEGS_PER_SERIES, Q_FIRST_HALF, V2_FLOORS,
  candidateLegsV2, comboImpliedProb, halfLattice, legProbV2, legReasoningV2, selectSlipV2,
} from "../lib/parlay-v2";

const API = "https://api.elections.kalshi.com/trade-api/v2";
const HOSTS = ["United States", "Canada", "Mexico"];
export const PARLAY_SERIES_V2 = COMBO_SERIES;

export function lockedSlugs(existing: Array<{ slug: string; engineVersion?: string }>, version: string): Set<string> {
  return new Set(existing.filter((e) => e.engineVersion === version).map((e) => e.slug));
}

/** @deprecated legacy v2-combo snapshot filename — inspector-compat only. */
export const snapshotFileV2 = (slug: string): string => `${slug}-v2.json`;
export const snapshotFileV21 = (slug: string): string => `${slug}-v2.1.json`;

export function marketMid(m: { yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }): number | null {
  const bid = Number(m.yes_bid_dollars ?? "0");
  const ask = Number(m.yes_ask_dollars ?? "0");
  if (bid > 0 && ask > 0) return (bid + ask) / 2;
  const last = Number(m.last_price_dollars ?? "0");
  return last > 0 ? last : null;
}

async function fetchSeries(series: string, code: string): Promise<KalshiMarket[]> {
  try {
    const res = await fetch(`${API}/markets?event_ticker=${series}-${code}&limit=100`, {
      signal: AbortSignal.timeout(8000),
    });
    if (!res.ok) return [];
    const { markets } = (await res.json()) as {
      markets?: Array<{ ticker: string; title?: string; yes_bid_dollars?: string; yes_ask_dollars?: string; last_price_dollars?: string }>;
    };
    return (markets ?? []).map((m) => ({ ticker: m.ticker, title: m.title ?? m.ticker, yesMid: marketMid(m) }));
  } catch {
    return [];
  }
}

const PARLAYS_PATH = path.join(appDir, "data", "parlays.json");
const SNAP_DIR = path.join(appDir, "data", "markets", "parlay-snapshots");

async function main(): Promise<void> {
  const model = JSON.parse(readFileSync(path.join(appDir, "data", "model.json"), "utf8")) as {
    params: ModelParams;
    dataThrough: string;
    ratings: Record<string, number>;
  };
  const nameOf = new Map(teams().map((t) => [t.id, t.name]));
  const existing: Array<{ slug: string; engineVersion?: string }> = existsSync(PARLAYS_PATH)
    ? JSON.parse(readFileSync(PARLAYS_PATH, "utf8"))
    : [];
  const have = lockedSlugs(existing, ENGINE_VERSION_V2_1);
  const now = Date.now();
  const upcoming = fixtures().filter(
    (f) => !have.has(f.slug) && new Date(f.kickoffISO).getTime() > now && f.stage !== "group",
  );

  const out: unknown[] = [...existing];
  let added = 0;
  for (const f of upcoming) {
    const code = kalshiEventCode(f);
    const all: KalshiMarket[] = [];
    for (const s of PARLAY_SERIES_V2) all.push(...(await fetchSeries(s, code)));
    if (all.length === 0) {
      console.error(`[lock-parlays] ${f.slug}: Kalshi returned no markets — skipping (retry later)`);
      continue;
    }
    mkdirSync(SNAP_DIR, { recursive: true });
    writeFileSync(
      path.join(SNAP_DIR, snapshotFileV21(f.slug)),
      `${JSON.stringify({ fetchedAt: new Date().toISOString(), markets: all }, null, 1)}\n`,
    );

    const homeName = nameOf.get(f.homeId) ?? "";
    const eloH = model.ratings[homeName] ?? 1500;
    const eloA = model.ratings[nameOf.get(f.awayId) ?? ""] ?? 1500;
    // Same neutral-site convention as lock-predictions: only host nations get home advantage.
    const lambdas = lambdasFromElo(eloH, eloA, !HOSTS.includes(homeName), model.params);
    const grid = scoreGrid(lambdas.home, lambdas.away, model.params.rho);
    const eloDiff = eloH - eloA;
    const s = summarizeGrid(grid);
    let etWinProbHome = 0.5;
    if (s.draw > 0) {
      etWinProbHome = (advancementProb(s.home, s.draw, eloDiff) - s.home) / s.draw;
    } else {
      console.error(`[lock-parlays] ${f.slug}: zero draw mass on grid — etWinProbHome defaulted to 0.5`);
    }

    const homeAbbr = f.homeId.toUpperCase();
    const awayAbbr = f.awayId.toUpperCase();
    const latticeCells = halfLattice(grid, Q_FIRST_HALF);
    const candidates = candidateLegsV2(all, homeAbbr, awayAbbr);

    const sel = selectSlipV2(candidates, latticeCells, etWinProbHome, V2_FLOORS);
    const lockedAt = new Date().toISOString();
    if (sel.verdict === "no-slip") {
      out.push({ slug: f.slug, engineVersion: ENGINE_VERSION_V2_1, lockedAt, verdict: "no-slip", reason: sel.reason });
      console.log(`[lock-parlays] ${f.slug}: v2.1 no-slip (${sel.reason})`);
    } else {
      const ctx = { eloDiff, homeAbbr, awayAbbr };
      const legs = sel.legs.map((leg) => ({
        ticker: leg.market.ticker,
        side: leg.side,
        title: leg.market.title,
        modelProb: legProbV2(leg, latticeCells, etWinProbHome),
        kalshiMid: leg.market.yesMid === null ? null : leg.side === "yes" ? leg.market.yesMid : 1 - leg.market.yesMid,
        reasoning: legReasoningV2(leg, latticeCells, etWinProbHome, ctx),
      }));
      out.push({
        slug: f.slug,
        engineVersion: ENGINE_VERSION_V2_1,
        lockedAt,
        modelDataThrough: model.dataThrough,
        eloDiff,
        lambdas,
        rho: model.params.rho,
        etWinProbHome,
        qFirstHalf: Q_FIRST_HALF,
        floors: { leg: V2_FLOORS.leg, joint: V2_FLOORS.joint, maxLegs: V2_FLOORS.maxLegs },
        maxLegsPerSeries: MAX_LEGS_PER_SERIES,
        legs,
        jointProb: sel.jointProb,
        comboImpliedProb: comboImpliedProb(legs.map((l) => l.kalshiMid)),
      });
      console.log(`[lock-parlays] ${f.slug}: v2.1 ${sel.legs.length}-leg slip, joint ${(sel.jointProb * 100).toFixed(1)}%`);
    }
    added += 1;
  }
  writeFileSync(PARLAYS_PATH, `${JSON.stringify(out, null, 1)}\n`);
  console.log(`[lock-parlays] locked ${added} new (total ${out.length})`);
}

if (process.argv[1] && process.argv[1].endsWith("lock-parlays.mts")) {
  main().catch((e) => {
    console.error("[lock-parlays] fatal:", e);
    process.exitCode = 1;
  });
}
