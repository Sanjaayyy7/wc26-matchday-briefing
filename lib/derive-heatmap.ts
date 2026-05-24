function poissonPmf(k: number, lambda: number): number {
  if (lambda <= 0) return k === 0 ? 1 : 0;
  let logP = -lambda + k * Math.log(lambda);
  for (let i = 2; i <= k; i++) logP -= Math.log(i);
  return Math.exp(logP);
}

function buildGrid(lh: number, la: number): number[][] {
  const grid: number[][] = Array.from({ length: 6 }, () => Array(6).fill(0));
  const hp = Array.from({ length: 6 }, (_, k) => poissonPmf(k, lh));
  const ap = Array.from({ length: 6 }, (_, k) => poissonPmf(k, la));
  let sum = 0;
  for (let h = 0; h < 6; h++) {
    for (let a = 0; a < 6; a++) {
      grid[h][a] = hp[h] * ap[a];
      sum += grid[h][a];
    }
  }
  if (sum < 1) grid[5][5] += 1 - sum;
  return grid;
}

function findMode(grid: number[][]): { home: number; away: number } {
  let best = { home: 0, away: 0, p: -1 };
  for (let h = 0; h < 6; h++) {
    for (let a = 0; a < 6; a++) {
      if (grid[h][a] > best.p) best = { home: h, away: a, p: grid[h][a] };
    }
  }
  return { home: best.home, away: best.away };
}

function marginals(grid: number[][]) {
  let hWin = 0;
  let draw = 0;
  let aWin = 0;
  for (let h = 0; h < 6; h++) {
    for (let a = 0; a < 6; a++) {
      if (h > a) hWin += grid[h][a];
      else if (h === a) draw += grid[h][a];
      else aWin += grid[h][a];
    }
  }
  return { hWin, draw, aWin };
}

export type Heatmap = {
  grid: number[][];
  mode: { home: number; away: number };
  lambdaHome: number;
  lambdaAway: number;
};

export function deriveHeatmap(input: {
  scoreline: { home: number; away: number };
  probabilities: { home: number; draw: number; away: number };
}): Heatmap {
  const { scoreline, probabilities } = input;
  const tgt = {
    h: probabilities.home / 100,
    d: probabilities.draw / 100,
    a: probabilities.away / 100,
  };

  const range = (center: number): number[] => {
    const lo = Math.max(0.3, center - 1.0);
    const hi = Math.min(4.0, center + 1.5);
    const out: number[] = [];
    for (let v = lo; v <= hi + 1e-9; v += 0.1) {
      out.push(Math.round(v * 10) / 10);
    }
    return out;
  };

  const lhCands = range(scoreline.home);
  const laCands = range(scoreline.away);

  let best: Heatmap | null = null;
  let bestScore = Infinity;
  let modeOk = false;

  for (const lh of lhCands) {
    for (const la of laCands) {
      const grid = buildGrid(lh, la);
      const mode = findMode(grid);
      const m = marginals(grid);
      const err =
        Math.pow(m.hWin - tgt.h, 2) +
        Math.pow(m.draw - tgt.d, 2) +
        Math.pow(m.aWin - tgt.a, 2);
      const matchesMode =
        mode.home === scoreline.home && mode.away === scoreline.away;
      if (matchesMode) {
        if (!modeOk || err < bestScore) {
          modeOk = true;
          bestScore = err;
          best = { grid, mode, lambdaHome: lh, lambdaAway: la };
        }
      } else if (!modeOk && err < bestScore) {
        bestScore = err;
        best = { grid, mode, lambdaHome: lh, lambdaAway: la };
      }
    }
  }

  if (!best) {
    const lh = Math.max(0.3, scoreline.home);
    const la = Math.max(0.3, scoreline.away);
    const grid = buildGrid(lh, la);
    best = { grid, mode: findMode(grid), lambdaHome: lh, lambdaAway: la };
  }

  // Pin the rendered mode to the stated scoreline regardless of whether the
  // grid search found a candidate that exactly matched.
  best.mode = { home: scoreline.home, away: scoreline.away };
  return best;
}
