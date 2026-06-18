// Platt / logistic calibration on the logit of p. Standard increasing form
// `1/(1+exp(-(a*logit+b)))` so it is monotonic in p and matches fitPlatt's
// gradient `(q-y)*logit`. (a=1, b=0 is the identity in logit space.)
export function applyPlatt(p: number, a: number, b: number): number {
  const c = Math.min(1 - 1e-6, Math.max(1e-6, p));
  return 1 / (1 + Math.exp(-(a * Math.log(c / (1 - c)) + b)));
}
export function fitPlatt(pairs: { p: number; y: 0 | 1 }[], iters = 300, lr = 0.1) {
  let a = 1, b = 0;
  const clamp = (x: number) => Math.min(1 - 1e-6, Math.max(1e-6, x));
  for (let it = 0; it < iters; it++) {
    let ga = 0, gb = 0;
    for (const { p, y } of pairs) {
      const logit = Math.log(clamp(p) / (1 - clamp(p)));
      const q = 1 / (1 + Math.exp(-(a * logit + b)));
      ga += (q - y) * logit; gb += (q - y);
    }
    a -= (lr * ga) / pairs.length; b -= (lr * gb) / pairs.length;
  }
  return { a, b };
}
export function timeDecayWeight(matchDate: number, asOfDate: number, halfLifeDays: number): number {
  return Math.pow(0.5, ((asOfDate - matchDate) / 86_400_000) / halfLifeDays);
}
