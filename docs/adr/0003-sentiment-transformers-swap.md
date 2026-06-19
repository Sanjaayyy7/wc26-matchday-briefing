# ADR-0003: Use @huggingface/transformers instead of @xenova/transformers

**Date**: 2026-06-18
**Status**: accepted
**Deciders**: sentiment-agent + controller

## Context

The original Task 3 spec referenced `@xenova/transformers` for local HuggingFace model
inference. This package has been deprecated in favour of `@huggingface/transformers`
(the official successor, same maintainer, same `pipeline()` API surface). Both load
ONNX models from the HuggingFace Hub and run inference locally with no API key.

`@huggingface/transformers` is already on Next.js 16's automatic `serverExternalPackages`
opt-out list, meaning it is never bundled into the client bundle.

## Decision

Use `@huggingface/transformers` (the maintained successor) in `scripts/score-sentiment.mts`.
Import only inside `scripts/`; the UI reads pre-generated `data/sentiment/<slug>.json` and
never touches the model at runtime.

Model used: `Xenova/twitter-roberta-base-sentiment-latest` (available on both packages;
weights are the same ONNX artifact regardless of which JS wrapper is used).

## Alternatives Considered

### Keep @xenova/transformers
- **Cons**: deprecated; maintainer migration notice points to `@huggingface/transformers`.
  New PRs not merged; bugs accumulate.
- **Why not**: would use a dead package when the replacement is API-compatible.

### Use a cloud API (OpenAI, Hugging Face Inference API)
- **Cons**: requires an API key; adds network dependency to the build pipeline; cost.
- **Why not**: spec explicitly asked for a local model; offline capability was a requirement.

### Use a pure lexicon scorer only
- **Pros**: zero dependency, fully offline.
- **Cons**: lower accuracy, no contextual understanding.
- **Why not**: kept as a fallback (model="lexicon-fallback") when the transformer is
  unreachable, but not as the primary path.

## Consequences

### Positive
- Transformers confirmed working: model downloaded and scored 60 posts in `npm run sentiment:score`.
- No API key; fully offline after first download; model cached at `.cache/huggingface/`.
- Model weights are identical to `@xenova/transformers` (same ONNX files).
- `@huggingface/transformers` is automatically externalized by Next.js 16; also listed
  explicitly in `next.config.ts` `serverExternalPackages`.

### Negative
- First run downloads ~200 MB of ONNX weights (cached after that).
- Model cache (`.cache/huggingface/`) excluded from git via `.gitignore`.

### Risks
- If the HuggingFace Hub is unreachable, the lexicon fallback runs instead
  (`model:"lexicon-fallback"`). The page still renders; the accuracy is lower.
