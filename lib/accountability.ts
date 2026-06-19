/**
 * Accountability module — pure function, no filesystem access.
 *
 * buildAccountability(ledger, matchFacts, kalshiResolutions, polymarketEntries)
 *
 * Separates results into two rigorously distinct categories:
 *   1. Official locked record: entries that have BOTH a `result` AND a locked
 *      pre-kickoff `split` in predictions.json. These are the only graded
 *      predictions.
 *   2. Informational: matches played before the lock window — shown only for
 *      completeness with actual results and market resolutions. No model grades.
 *
 * Verdict definition:
 *   - "hit"   → correctPick is true (model's top bucket matched realized outcome)
 *   - "close" → correctPick is false AND (realized outcome is the model's
 *               2nd-most-likely bucket OR the scoreline is within 1 goal on both
 *               home and away components vs mostLikely scoreline)
 *   - "miss"  → otherwise
 *
 * "Within 1 goal" means |mostLikely.home − actual.home| ≤ 1 AND
 *                        |mostLikely.away − actual.away| ≤ 1.
 */

export type Outcome = "home" | "draw" | "away";

export type Split = {
  home: number;
  draw: number;
  away: number;
};

export type BttsInfo = {
  prob: number;
  actual: boolean;
  brier: number;
  derivedPostHoc: boolean;
};

export type OuInfo = {
  prob: number;
  actual: boolean;
  brier: number;
  derivedPostHoc: boolean;
};

export type MarketBook = {
  probs: { home: number; draw: number; away: number };
  brier?: number;
  rps?: number;
};

export type LockedEntry = {
  slug: string;
  lockedAt: string;
  split: Split;
  mostLikely: { home: number; away: number };
  result?: string;
  realized?: Outcome;
  correctPick?: boolean;
  modelBrier?: number;
  modelRps?: number;
  logLoss?: number;
  scorelineHit?: boolean;
  top3ScorelineHit?: boolean;
  marketBrier?: number;
  marketRps?: number;
  markets?: {
    kalshi?: MarketBook;
    polymarket?: MarketBook;
  };
  btts?: BttsInfo;
  ou25?: OuInfo;
  resolutionCheck?: {
    kalshi?: string;
    polymarket?: string;
    agreesWithResult?: boolean;
  };
};

export type MatchFacts = {
  score?: { home: number; away: number };
  btts?: boolean;
  totalGoals?: number;
  scorers?: unknown[];
  facts?: unknown;
};

export type KalshiResolution = {
  ticker: string;
  resolved: { home: 0 | 1; draw: 0 | 1; away: 0 | 1 };
  settledTime?: string;
  _source?: string;
};

export type PolymarketEntry = {
  probs?: { home: number; draw: number; away: number };
  resolved?: { home: 0 | 1; draw: 0 | 1; away: 0 | 1 } | null;
};

export type Verdict = "hit" | "close" | "miss";

export type OfficialRow = {
  slug: string;
  locked: Split;
  actual: string;
  grades: {
    modelBrier: number;
    modelRps: number;
    scorelineHit: boolean;
    top3ScorelineHit: boolean;
    correctPick: boolean;
    bttsBrier?: number;
    bttsDerivedPostHoc?: boolean;
  };
  verdict: Verdict;
  kalshi?: {
    brier: number;
    rps: number;
  };
};

export type InformationalRow = {
  slug: string;
  actual: string;
  btts?: boolean;
  totalGoals?: number;
  kalshiResolution?: string;
  polymarketResolution?: string;
  note: string;
};

export type VsMarket = {
  n: number;
  modelBrier: number | null;
  marketBrier: number | null;
  edge: number | null; // marketBrier − modelBrier; positive = model better
};

export type CalibrationBin = {
  midpoint: number;  // center of probability bucket (e.g. 0.05 for [0, 0.10))
  predicted: number; // mean predicted probability in this bin
  observed: number;  // fraction of events that actually occurred
  n: number;         // number of (outcome, prediction) pairs in this bin
};

export type Aggregates = {
  n: number;
  accuracy: number | null;
  meanBrier: number | null;
  meanRps: number | null;
  bttsAccuracy: number | null;
  scorelineHitRate: number | null;
  top3Rate: number | null;
  vsKalshi: VsMarket;
  vsPolymarket: VsMarket;
};

export type AccountabilityOutput = {
  generatedAt: string;
  official: {
    rows: OfficialRow[];
    aggregates: Aggregates;
    calibrationBins: CalibrationBin[];
  };
  informational: {
    rows: InformationalRow[];
  };
  caveats: string[];
};

// ---------------------------------------------------------------------------
// Verdict helper
// ---------------------------------------------------------------------------

/**
 * Determine the 2nd-most-likely outcome bucket from a split.
 * (Most likely = highest percentage; 2nd = second-highest.)
 */
function secondMostLikely(split: Split): Outcome {
  const sorted = (["home", "draw", "away"] as Outcome[]).sort(
    (a, b) => split[b] - split[a],
  );
  return sorted[1];
}

/**
 * Parse a scoreline string like "4-1" into { home, away }.
 * Returns null if the string is malformed.
 */
function parseScore(result: string): { home: number; away: number } | null {
  const m = result.match(/^(\d+)-(\d+)$/);
  if (!m) return null;
  return { home: parseInt(m[1], 10), away: parseInt(m[2], 10) };
}

function classifyVerdict(entry: LockedEntry): Verdict {
  if (entry.correctPick) return "hit";

  // Check 2nd-most-likely bucket
  if (entry.realized && secondMostLikely(entry.split) === entry.realized) {
    return "close";
  }

  // Check scoreline closeness: |mostLikely.home − actual.home| ≤ 1 AND
  //                             |mostLikely.away − actual.away| ≤ 1
  if (entry.result) {
    const actual = parseScore(entry.result);
    if (actual) {
      const diffH = Math.abs(entry.mostLikely.home - actual.home);
      const diffA = Math.abs(entry.mostLikely.away - actual.away);
      if (diffH <= 1 && diffA <= 1) return "close";
    }
  }

  return "miss";
}

// ---------------------------------------------------------------------------
// Calibration bins
// ---------------------------------------------------------------------------

/** Pool all 3 outcome probabilities across settled entries into 10 bins.
 *  Each settled match contributes 3 (predicted, realized) pairs — one per outcome. */
function computeCalibrationBins(entries: LockedEntry[]): CalibrationBin[] {
  const NUM_BINS = 10;
  const bins = Array.from({ length: NUM_BINS }, (_, i) => ({
    midpoint: (i + 0.5) / NUM_BINS,
    sumPredicted: 0,
    sumObserved: 0,
    n: 0,
  }));

  for (const e of entries) {
    if (!e.split || !e.realized) continue;
    const outcomes: Array<{ outcome: "home" | "draw" | "away"; prob: number }> = [
      { outcome: "home", prob: e.split.home / 100 },
      { outcome: "draw", prob: e.split.draw / 100 },
      { outcome: "away", prob: e.split.away / 100 },
    ];
    for (const o of outcomes) {
      const binIdx = Math.min(Math.floor(o.prob * NUM_BINS), NUM_BINS - 1);
      bins[binIdx].sumPredicted += o.prob;
      bins[binIdx].sumObserved += o.outcome === e.realized ? 1 : 0;
      bins[binIdx].n += 1;
    }
  }

  return bins
    .filter((b) => b.n > 0)
    .map((b) => ({
      midpoint: b.midpoint,
      predicted: b.sumPredicted / b.n,
      observed: b.sumObserved / b.n,
      n: b.n,
    }));
}

// ---------------------------------------------------------------------------
// Main pure function
// ---------------------------------------------------------------------------

export function buildAccountability(
  ledger: { entries: LockedEntry[] },
  matchFacts: Record<string, MatchFacts>,
  kalshiResolutions: Record<string, KalshiResolution>,
  polymarketEntries: Record<string, PolymarketEntry>,
): AccountabilityOutput {
  const generatedAt = new Date().toISOString();

  // Partition entries: official = has result + realized (fully settled + locked)
  const settledEntries = ledger.entries.filter(
    (e) => e.result !== undefined && e.realized !== undefined && e.modelBrier !== undefined,
  );
  const settledSlugs = new Set(settledEntries.map((e) => e.slug));

  // Informational: played matches (present in matchFacts or kalshiResolutions) but NOT in official
  // Filter out metadata keys (those starting with underscore)
  const playedSlugs = new Set([
    ...Object.keys(matchFacts).filter((k) => !k.startsWith("_")),
    ...Object.keys(kalshiResolutions).filter((k) => !k.startsWith("_")),
  ]);
  const informationalSlugs = [...playedSlugs].filter((s) => !settledSlugs.has(s));

  // ---------------------------------------------------------------------------
  // Build official rows
  // ---------------------------------------------------------------------------
  const officialRows: OfficialRow[] = settledEntries.map((entry) => {
    const verdict = classifyVerdict(entry);
    const kalshiMarket = entry.markets?.kalshi;

    const row: OfficialRow = {
      slug: entry.slug,
      locked: entry.split,
      actual: entry.result!,
      grades: {
        modelBrier: entry.modelBrier!,
        modelRps: entry.modelRps!,
        scorelineHit: entry.scorelineHit ?? false,
        top3ScorelineHit: entry.top3ScorelineHit ?? false,
        correctPick: entry.correctPick ?? false,
        ...(entry.btts !== undefined
          ? {
              bttsBrier: entry.btts.brier,
              bttsDerivedPostHoc: entry.btts.derivedPostHoc,
            }
          : {}),
      },
      verdict,
      ...(kalshiMarket?.brier !== undefined && kalshiMarket?.rps !== undefined
        ? { kalshi: { brier: kalshiMarket.brier, rps: kalshiMarket.rps } }
        : {}),
    };
    return row;
  });

  // ---------------------------------------------------------------------------
  // Build aggregates
  // ---------------------------------------------------------------------------
  const n = officialRows.length;

  const accuracy =
    n > 0
      ? settledEntries.filter((e) => e.correctPick).length / n
      : null;

  const meanBrier =
    n > 0
      ? settledEntries.reduce((sum, e) => sum + (e.modelBrier ?? 0), 0) / n
      : null;

  const meanRps =
    n > 0
      ? settledEntries.reduce((sum, e) => sum + (e.modelRps ?? 0), 0) / n
      : null;

  // BTTS accuracy covers all entries with btts.actual defined, including derivedPostHoc ones —
  // honesty disclosure is in the caveats array.
  const bttsEntries = settledEntries.filter((e) => e.btts?.actual !== undefined);
  const bttsCorrect = bttsEntries.filter((e) => {
    if (!e.btts) return false;
    const predBtts = e.btts.prob >= 0.5;
    return predBtts === e.btts.actual;
  });
  const bttsAccuracy =
    bttsEntries.length > 0 ? bttsCorrect.length / bttsEntries.length : null;

  const scorelineHitRate =
    n > 0
      ? settledEntries.filter((e) => e.scorelineHit).length / n
      : null;

  const top3Rate =
    n > 0
      ? settledEntries.filter((e) => e.top3ScorelineHit).length / n
      : null;

  // vsKalshi: use entries where kalshi market data was available at lock time
  const kalshiEntries = settledEntries.filter(
    (e) => e.markets?.kalshi?.brier !== undefined,
  );
  const vsKalshi: VsMarket =
    kalshiEntries.length > 0
      ? {
          n: kalshiEntries.length,
          modelBrier:
            kalshiEntries.reduce((s, e) => s + e.modelBrier!, 0) /
            kalshiEntries.length,
          marketBrier:
            kalshiEntries.reduce((s, e) => s + e.markets!.kalshi!.brier!, 0) /
            kalshiEntries.length,
          edge:
            kalshiEntries.reduce(
              (s, e) => s + (e.markets!.kalshi!.brier! - e.modelBrier!),
              0,
            ) / kalshiEntries.length,
        }
      : { n: 0, modelBrier: null, marketBrier: null, edge: null };

  // vsPolymarket: no pre-kickoff books exist for played matches yet
  // (Polymarket probs for played matches are post-resolution, not pre-kickoff)
  const vsPolymarket: VsMarket = { n: 0, modelBrier: null, marketBrier: null, edge: null };

  const aggregates: Aggregates = {
    n,
    accuracy,
    meanBrier,
    meanRps,
    bttsAccuracy,
    scorelineHitRate,
    top3Rate,
    vsKalshi,
    vsPolymarket,
  };

  // ---------------------------------------------------------------------------
  // Build informational rows
  // ---------------------------------------------------------------------------
  const informationalRows: InformationalRow[] = informationalSlugs.map((slug) => {
    const facts = matchFacts[slug];
    const kalshi = kalshiResolutions[slug];
    const pm = polymarketEntries[slug];

    let actual = "unknown";
    if (facts?.score) {
      actual = `${facts.score.home}-${facts.score.away}`;
    }

    const kalshiWinner = kalshi?.resolved
      ? kalshi.resolved.home === 1
        ? "home"
        : kalshi.resolved.draw === 1
          ? "draw"
          : "away"
      : undefined;

    const pmWinner = pm?.resolved
      ? pm.resolved.home === 1
        ? "home"
        : pm.resolved.draw === 1
          ? "draw"
          : "away"
      : undefined;

    return {
      slug,
      actual,
      ...(facts?.btts !== undefined ? { btts: facts.btts } : {}),
      ...(facts?.totalGoals !== undefined ? { totalGoals: facts.totalGoals } : {}),
      ...(kalshiWinner !== undefined ? { kalshiResolution: kalshiWinner } : {}),
      ...(pmWinner !== undefined ? { polymarketResolution: pmWinner } : {}),
      note: "No locked prediction (played before lock window) — shown for completeness, NOT scored against the model.",
    };
  });

  // ---------------------------------------------------------------------------
  // Caveats
  // ---------------------------------------------------------------------------
  const caveats = [
    `Official graded record contains n=${n} match(es). This is a very small sample — do not over-read the aggregate numbers.`,
    "BTTS and over/under probabilities are derived post-hoc from the same model that generated the 1X2 split; they are NOT separately validated predictions.",
    "No pre-kickoff Polymarket books exist for played matches — vsPolymarket comparisons are deferred to the Phase C backtest.",
    "Kalshi market Brier shown is computed from the pre-kickoff locked book; market edge from a single match is noise.",
    "Informational matches (played before lock window) have no model grades. Assigning grades retroactively would be in-sample and dishonest. The honest out-of-sample model assessment is in the Phase C backtest.",
    "All scoreline metrics (scorelineHit, top3ScorelineHit) come from the settlement script and are computed against the Poisson model's top predicted scoreline, not a separate forecast.",
  ];

  const calibrationBins = computeCalibrationBins(settledEntries);

  return {
    generatedAt,
    official: { rows: officialRows, aggregates, calibrationBins },
    informational: { rows: informationalRows },
    caveats,
  };
}
