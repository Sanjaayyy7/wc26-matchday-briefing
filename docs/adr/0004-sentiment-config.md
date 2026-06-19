# ADR-0004: Sentiment model config — model id, bucket size, shift window

**Date**: 2026-06-18
**Status**: accepted
**Deciders**: sentiment-agent + controller

## Context

Task 3 requires documenting the sentiment pipeline's key configuration choices:
the model identifier, the minute-bucket aggregation size, and the shift-detection window.

## Decisions

### Model ID: `Xenova/twitter-roberta-base-sentiment-latest`

A Twitter-domain fine-tune of RoBERTa-base, quantized to ONNX by Xenova.
Labels: `LABEL_0` (Negative), `LABEL_1` (Neutral), `LABEL_2` (Positive).
These are mapped to `NEG`/`NEU`/`POS` in `scripts/score-sentiment.mts`.

**Why this model:**
- Trained on tweets → domain match for fan social posts.
- Three-class output → distinguishes neutral from negative (critical for goal vs.
  red-card distinguishing, where neutral posts persist around both events).
- Small ONNX quantized artifact (~200 MB); runs on CPU without GPU.
- Free, no API key, cached after first download.

**Alternatives considered:**
- `distilbert-base-uncased-finetuned-sst-2-english`: binary (pos/neg only), no neutral.
  Rejected: can't distinguish relief/neutral commentary from negative reaction.
- `cardiffnlp/twitter-roberta-base-sentiment`: older checkpoint of same model family.
  Rejected: `twitter-roberta-base-sentiment-latest` is the current recommended checkpoint.

### Bucket size: 5 minutes

Posts are grouped into 5-minute windows for the timeline chart.

**Why 5 min:**
- A typical match has 90+ minutes. With 5-min buckets: 18–24 data points → readable chart.
- Short enough to show goal-reaction spikes (goals produce a 1–3 min burst of posts).
- `bucketByMinute(posts, 5)` is parameterized; callers can override for longer matches.

**Alternatives considered:**
- 1 min: 90+ bars, visually cluttered, many empty buckets with small post volumes.
- 10 min: smooths out goal-spike reactions; delta after goal minute would be diluted.

### Shift window: ±10 minutes

`detectShift(posts, eventMinute, 10)` measures:
- `before`: mean sentiment of posts in `[eventMinute - 10, eventMinute)`.
- `after`: mean sentiment of posts in `[eventMinute, eventMinute + 10)`.
- `delta`: `after - before`.

**Why 10 min:**
- Captures the immediate crowd reaction without bleeding into the next event.
- WC26 match-facts show goals and red cards are often within 15–20 minutes of each other.
  A larger window would mix events.
- Consistent with social-media sentiment research conventions (±10 min around events).

**Alternatives considered:**
- ±5 min: too narrow; with ~60 seeded posts over 95 min, ~3–4 posts per window → noisy.
- ±15 min: overlapping windows between events; confounds shift attribution.

## Consequences

- Pipeline: `npm run sentiment:score -- <slug>` outputs `data/sentiment/<slug>.json`
  containing `timeline` (5-min buckets), `events`, and `shifts` (10-min window).
- Confirmed on `mexico-vs-south-africa`:
  - Biggest shift: min 9 (goal) delta = −0.889 (fans shifted from positive to negative
    after the opener — counterintuitive but reflects the South Africa fan base's dismay).
  - min 50 (red card): delta = −0.743 (further collapse in sentiment as Sithole is sent off).
- These parameters are not hard-coded in the route; `lib/sentiment.ts` `bucketByMinute` and
  `detectShift` accept `size` and `window` arguments for future experiments.
