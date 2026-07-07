//
// Phase 3 feature signals: rest-days and goal-form, computed walk-forward
// from results rows. Pure — no I/O. State is pushed AFTER a match is scored
// so features for date D only ever see matches strictly before D.
// Pre-registered: rest clamp [3,14] days; form = last-5 mean goal diff,
// minimum 3 matches; both scaled to [-1, 1].

import { scoreGrid, type ModelParams } from "./poisson-model";

export type TeamFeatState = { lastDate: string | null; recentGd: number[] };
export type FeatureState = Map<string, TeamFeatState>;

const REST_MIN = 3;
const REST_MAX = 14;
const FORM_WINDOW = 5;
const FORM_MIN = 3;

export function newFeatureState(): FeatureState {
  return new Map();
}

const teamState = (state: FeatureState, team: string): TeamFeatState => {
  let t = state.get(team);
  if (!t) {
    t = { lastDate: null, recentGd: [] };
    state.set(team, t);
  }
  return t;
};

const restDays = (t: TeamFeatState, date: string): number => {
  if (t.lastDate === null) return REST_MAX;
  const days = (Date.parse(date) - Date.parse(t.lastDate)) / 86_400_000;
  return Math.max(REST_MIN, Math.min(REST_MAX, days));
};

const form = (t: TeamFeatState): number =>
  t.recentGd.length < FORM_MIN
    ? 0
    : t.recentGd.reduce((a, b) => a + b, 0) / t.recentGd.length;

export function matchFeatures(
  state: FeatureState,
  row: { date: string; home: string; away: string },
): { restF: number; formF: number } {
  const h = teamState(state, row.home);
  const a = teamState(state, row.away);
  const restF = (restDays(h, row.date) - restDays(a, row.date)) / (REST_MAX - REST_MIN);
  const rawForm = (form(h) - form(a)) / 3;
  const formF = Math.max(-1, Math.min(1, rawForm));
  return { restF, formF };
}

export function pushMatch(
  state: FeatureState,
  row: { date: string; home: string; away: string; hs: number; as: number },
): void {
  const h = teamState(state, row.home);
  const a = teamState(state, row.away);
  h.lastDate = row.date;
  a.lastDate = row.date;
  h.recentGd.push(row.hs - row.as);
  a.recentGd.push(row.as - row.hs);
  if (h.recentGd.length > FORM_WINDOW) h.recentGd.shift();
  if (a.recentGd.length > FORM_WINDOW) a.recentGd.shift();
}

export type FeatureLikRow = {
  diff: number;
  hs: number;
  as: number;
  restF: number;
  formF: number;
};
export type FeatureBetas = { betaRest: number; betaForm: number };

const BETA_MIN = -0.3;
const BETA_MAX = 0.3;
const BETA_STEP = 0.02;

export function applyFeatureAdjust(
  lambdas: { home: number; away: number },
  feats: { restF: number; formF: number },
  betas: FeatureBetas,
): { home: number; away: number } {
  const shift = betas.betaRest * feats.restF + betas.betaForm * feats.formF;
  if (shift === 0) return lambdas;
  return { home: lambdas.home * Math.exp(shift), away: lambdas.away * Math.exp(-shift) };
}

function featureLL(likRows: FeatureLikRow[], params: ModelParams, betas: FeatureBetas): number {
  let ll = 0;
  for (const m of likRows) {
    if (m.hs >= 9 || m.as >= 9) continue;
    const base = {
      home: Math.exp(params.baseLogGoals + params.eloSlope * m.diff),
      away: Math.exp(params.baseLogGoals - params.eloSlope * m.diff),
    };
    const l = applyFeatureAdjust(base, m, betas);
    const grid = scoreGrid(l.home, l.away, params.rho);
    ll += Math.log(Math.max(grid[m.hs][m.as], 1e-12));
  }
  return ll;
}

/** Coordinate grid search (two sweeps over betaRest then betaForm) maximizing
 *  Dixon-Coles exact-score log-likelihood — same objective and grid idiom as
 *  fitRho. Deterministic. */
export function fitFeatureBetas(likRows: FeatureLikRow[], params: ModelParams): FeatureBetas {
  const betas: FeatureBetas = { betaRest: 0, betaForm: 0 };
  for (let sweep = 0; sweep < 2; sweep++) {
    for (const key of ["betaRest", "betaForm"] as const) {
      // Seed with the incumbent value and replace only on STRICT improvement:
      // when a feature is constant (all-tied likelihoods) the beta stays put
      // instead of drifting to a grid endpoint.
      let best = { v: betas[key], ll: featureLL(likRows, params, betas) };
      for (let v = BETA_MIN; v <= BETA_MAX + 1e-9; v += BETA_STEP) {
        const ll = featureLL(likRows, params, { ...betas, [key]: v });
        if (ll > best.ll) best = { v, ll };
      }
      betas[key] = Number(best.v.toFixed(2));
    }
  }
  return betas;
}
