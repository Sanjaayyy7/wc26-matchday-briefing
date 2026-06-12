# Data provenance — eyeball before any demo

Seeded 2026-06-11 from web sources fetched live in-session (FIFA.com schedule pages, Sky Sports day-by-day fixture list, Yahoo/CBS schedules). **No fixture, team, or kickoff was recalled from model memory.**

## Known discrepancies to verify by hand

- **Brazil vs Morocco kickoff:** RESOLVED 2026-06-12 — ESPN match preview confirms 18:00 EDT (`2026-06-13T22:00:00Z`); Sky's 16:00 listing was wrong. Updated.
- **Australia vs Türkiye:** Sky's "2:00 AM local" Vancouver time is implausible and inconsistent with its own 5:00 AM UK listing; seeded 21:00 PDT Jun 13 (`2026-06-14T04:00:00Z`), which matches the UK time. Verify.
- **Mexico vs South Africa kickoff:** Sky says 14:00 local but the opening-ceremony reporting (11:30 ceremony + 90 min) implies ~13:00. Seeded 14:00 CST (`2026-06-11T20:00:00Z`). Match already played — Mexico won 2–0 (CBS/Today reports) — so this row is backtest material.
- **Venue names:** FIFA uses sponsored-name-free venue names ("Mexico City Stadium"); seeded FIFA-style with the familiar name in parentheses. Verify the exact FIFA strings if they're user-facing.

## Intentionally blank fields

`manager`, `lastFiveResults`, `goalsForLast5/AgainstLast5` are placeholders (`TBC — verify`, `—`, `0`). Current national-team staff and form postdate the model's training data and were NOT fetched per-team. Fill from FIFA/ESPN before a demo, or ignore — the v2 prompt takes form data only via `VERIFIED_FACTS`, never from these display fields.

## Backtest set

`backtest/pl-md38-{clubs,fixtures}.json` — the original Premier League MD-38 seed (played 2026-05-24). Frozen for the calibration backtest (`scripts/calibrate.mts`): results are known, so model probability splits can be scored against reality.
