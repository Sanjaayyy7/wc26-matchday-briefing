# Architecture Decision Records

Nygard-format ADRs for heavyweight WC26 choices (plan §L). Lightweight decisions live in `../decision-log.md`.

| ADR | Title | Status | Date |
|-----|-------|--------|------|
| [0001](0001-task1-model-variant.md) | Ship Platt-calibrated model; evidence-based Brier gate | accepted | 2026-06-18 |
| [0003](0003-sentiment-transformers-swap.md) | Use @huggingface/transformers (not deprecated @xenova/transformers) | accepted | 2026-06-18 |
| [0004](0004-sentiment-config.md) | Sentiment model id, 5-min bucket size, 10-min shift window | accepted | 2026-06-18 |

Mandatory ADRs for this effort: Task-1 chosen model variant + params; K-Means k + feature set; sentiment model id + bucket size + shift window; the `@huggingface/transformers` library swap.
