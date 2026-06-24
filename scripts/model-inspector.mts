// scripts/model-inspector.mts
//
// WC26 Model-Quality Inspector — sibling to design-inspector.mts / execution-inspector.mts.
// Guards the MODEL: a shipped regime model must trace to a real harness verdict, must not
// regress draw calibration, must respect leakage constants, and must keep clearing the
// standing backtest gates. Pure `inspectModel` + thin CLI guard (design-inspector pattern).
//
//   npm run model:inspect
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = join(fileURLToPath(new URL(".", import.meta.url)), "..");
const SEED = 42;
const BOOTSTRAP_N = 5000;
const ECE_MAX = 0.03;
const BRIER_CEILING = 0.51;

type ModelLike = {
  backtest?: { brier?: number; uniformBrier?: number; ece?: number };
  regimeParams?: { tournament?: unknown };
  promotion?: { shipped?: boolean; rule?: string; drawGap?: number; seed?: number; harnessGeneratedAt?: string };
};
type VerdictLike = {
  config?: { generatedAt?: string; seed?: number; bootstrapSamples?: number };
  drawGap?: { baseline?: number; regime?: number };
  regimePromotion?: { primary?: { ship?: boolean }; secondary?: { ship?: boolean } };
};

export function inspectModel(args: { model: ModelLike; verdict: VerdictLike | null }): string[] {
  const { model, verdict } = args;
  const fails: string[] = [];

  // Standing backtest gates (always enforced).
  const bt = model.backtest ?? {};
  if (bt.brier === undefined || bt.uniformBrier === undefined || bt.brier >= bt.uniformBrier) {
    fails.push(`backtest Brier ${bt.brier} does not beat uniform ${bt.uniformBrier}`);
  }
  if (bt.brier !== undefined && bt.brier >= BRIER_CEILING) {
    fails.push(`backtest Brier ${bt.brier} ≥ ceiling ${BRIER_CEILING}`);
  }
  if (bt.ece === undefined || bt.ece >= ECE_MAX) {
    fails.push(`backtest ECE ${bt.ece} ≥ ${ECE_MAX}`);
  }

  // Shipped-regime provenance checks.
  if (model.promotion?.shipped) {
    if (!model.regimeParams?.tournament) {
      fails.push("promotion.shipped is true but regimeParams.tournament is missing");
    }
    if (!verdict) {
      fails.push("promotion.shipped is true but no harness verdict artifact was found");
    } else {
      const firedPrimary = verdict.regimePromotion?.primary?.ship === true;
      const firedSecondary = verdict.regimePromotion?.secondary?.ship === true;
      if (!firedPrimary && !firedSecondary) {
        fails.push("promotion.shipped is true but neither pre-registered rule shipped in the verdict");
      }
      if (verdict.config?.seed !== SEED) {
        fails.push(`verdict seed ${verdict.config?.seed} ≠ pre-registered ${SEED}`);
      }
      if (verdict.config?.bootstrapSamples !== BOOTSTRAP_N) {
        fails.push(`verdict bootstrapSamples ${verdict.config?.bootstrapSamples} ≠ pre-registered ${BOOTSTRAP_N}`);
      }
      if (model.promotion?.seed !== SEED) {
        fails.push(`model.promotion.seed ${model.promotion?.seed} ≠ pre-registered ${SEED}`);
      }
      if (!model.promotion?.harnessGeneratedAt || !verdict.config?.generatedAt ||
          model.promotion.harnessGeneratedAt !== verdict.config.generatedAt) {
        fails.push("model.promotion.harnessGeneratedAt does not match the verdict artifact");
      }
      const base = verdict.drawGap?.baseline;
      const reg = verdict.drawGap?.regime;
      if (base === undefined || reg === undefined || reg > base) {
        fails.push(`regime draw-gap ${reg} is not better than baseline ${base}`);
      }
    }
  }
  return fails;
}

// ── CLI guard (design-inspector pattern) ─────────────────────────────────────
if (import.meta.url === `file://${process.argv[1]}`) {
  const modelPath = join(ROOT, "data", "model.json");
  const verdictPath = join(ROOT, "docs", "validation", "tournament-validation.json");
  const model = JSON.parse(readFileSync(modelPath, "utf8")) as ModelLike;
  const verdict = existsSync(verdictPath)
    ? (JSON.parse(readFileSync(verdictPath, "utf8")) as VerdictLike)
    : null;
  const fails = inspectModel({ model, verdict });
  console.log("\nWC26 Model-Quality Inspector");
  console.log("────────────────────────────");
  console.log(`  promotion: ${model.promotion?.shipped ? `SHIPPED (${model.promotion.rule})` : "candidate (global params live)"}`);
  if (fails.length) {
    for (const f of fails) console.error(`  ✗ ${f}`);
    console.error(`\n✗ Model inspector: ${fails.length} violation(s).`);
    process.exit(1);
  }
  console.log("\n✓ Model inspector passed.");
}
