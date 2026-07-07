//
// Phase 3 feature signals: rest-days and goal-form, computed walk-forward
// from results rows. Pure — no I/O. State is pushed AFTER a match is scored
// so features for date D only ever see matches strictly before D.
// Pre-registered: rest clamp [3,14] days; form = last-5 mean goal diff,
// minimum 3 matches; both scaled to [-1, 1].

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
